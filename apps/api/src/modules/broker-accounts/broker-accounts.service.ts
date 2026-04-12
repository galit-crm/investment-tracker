import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SyncStatus, TransactionSource, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ExchangeConnector } from './connectors/exchange-connector.interface';
import { BinanceConnector } from './connectors/binance.connector';
import { MockBrokerConnector } from './connectors/mock-broker.connector';
import { HoldingsCalculatorService } from '../holdings/holdings-calculator.service';

const ALGO = 'aes-256-gcm';

@Injectable()
export class BrokerAccountsService {
  private readonly logger = new Logger(BrokerAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly binance: BinanceConnector,
    private readonly mockBroker: MockBrokerConnector,
    private readonly calculator: HoldingsCalculatorService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(userId: string) {
    return this.prisma.brokerAccount.findMany({
      where: { userId },
      select: {
        id: true, name: true, brokerType: true, brokerSlug: true,
        isActive: true, autoSync: true, lastSyncedAt: true, createdAt: true,
        _count: { select: { holdings: true, transactions: true, syncJobs: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    userId: string,
    data: { name: string; brokerSlug: string; brokerType: string; credentials?: Record<string, string> },
  ) {
    const connector = this.getConnector(data.brokerSlug);

    if (data.credentials) {
      await connector.validateCredentials(data.credentials);
    }

    const account = await this.prisma.brokerAccount.create({
      data: {
        userId,
        name: data.name,
        brokerSlug: data.brokerSlug,
        brokerType: data.brokerType as any,
      },
    });

    if (data.credentials) {
      const encrypted = this.encryptCredentials(data.credentials);
      await this.prisma.exchangeCredential.create({
        data: { brokerAccountId: account.id, ...encrypted },
      });
    }

    return account;
  }

  async delete(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.brokerAccount.delete({ where: { id } });
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  async sync(userId: string, brokerAccountId: string): Promise<{ jobId: string }> {
    await this.assertOwner(userId, brokerAccountId);

    const account = await this.prisma.brokerAccount.findUnique({
      where: { id: brokerAccountId },
      include: { credentials: true },
    });

    if (!account) throw new NotFoundException('Broker account not found');
    if (!account.credentials) throw new BadRequestException('No credentials configured');

    const job = await this.prisma.syncJob.create({
      data: { brokerAccountId, status: SyncStatus.PENDING },
    });

    // Run sync asynchronously
    this.runSync(job.id, account, account.credentials.encryptedData, account.credentials.iv).catch(
      (err) => this.logger.error(`Sync job ${job.id} failed: ${err.message}`),
    );

    return { jobId: job.id };
  }

  async getSyncJobs(userId: string, brokerAccountId: string) {
    await this.assertOwner(userId, brokerAccountId);
    return this.prisma.syncJob.findMany({
      where: { brokerAccountId },
      include: { logs: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async runSync(
    jobId: string,
    account: any,
    encryptedData: string,
    iv: string,
  ): Promise<void> {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { status: SyncStatus.RUNNING, startedAt: new Date() },
    });

    try {
      const credentials = this.decryptCredentials(encryptedData, iv);
      const connector = this.getConnector(account.brokerSlug);

      await this.log(jobId, 'info', 'Starting sync');

      const transactions = await connector.fetchTransactions(credentials, account.lastSyncedAt ?? undefined);

      await this.log(jobId, 'info', `Fetched ${transactions.length} transactions`);

      let imported = 0;
      let skipped = 0;
      const importedAssetIds = new Set<string>();

      const defaultPortfolio = await this.prisma.portfolio.findFirst({
        where: { userId: account.userId, isDefault: true },
      });

      if (!defaultPortfolio) throw new Error('No default portfolio found');

      for (const tx of transactions) {
        // Check for duplicate
        const existing = await this.prisma.transaction.findFirst({
          where: { externalId: tx.externalId, portfolioId: defaultPortfolio.id },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Find or create asset
        let asset = await this.prisma.asset.findFirst({
          where: { symbol: tx.symbol },
        });

        if (!asset) {
          asset = await this.prisma.asset.create({
            data: {
              symbol: tx.symbol,
              name: tx.symbol,
              assetClass: 'OTHER',
              currency: tx.currency as any,
            },
          });
        }

        await this.prisma.transaction.create({
          data: {
            portfolioId: defaultPortfolio.id,
            assetId: asset.id,
            brokerAccountId: account.id,
            type: tx.type as TransactionType,
            quantity: tx.quantity,
            pricePerUnit: tx.pricePerUnit,
            totalAmount: tx.totalAmount,
            fee: tx.fee ?? 0,
            currency: tx.currency as any,
            source: TransactionSource.BROKER_SYNC,
            externalId: tx.externalId,
            executedAt: tx.executedAt,
          },
        });

        importedAssetIds.add(asset.id);
        imported++;
      }

      // Recalculate holdings for all assets touched by this sync
      for (const assetId of importedAssetIds) {
        try {
          await this.calculator.recalculateHolding(defaultPortfolio.id, assetId);
        } catch (err) {
          this.logger.warn(`Failed to recalculate holding ${assetId}: ${(err as Error).message}`);
        }
      }

      await this.prisma.brokerAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      });

      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncStatus.SUCCESS,
          finishedAt: new Date(),
          recordsImported: imported,
          recordsSkipped: skipped,
        },
      });

      await this.log(jobId, 'info', `Sync complete. Imported: ${imported}, Skipped: ${skipped}`);
    } catch (err) {
      const message = (err as Error).message;
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { status: SyncStatus.FAILED, finishedAt: new Date(), errorMessage: message },
      });
      await this.log(jobId, 'error', message);
    }
  }

  private async log(jobId: string, level: string, message: string) {
    await this.prisma.syncLog.create({ data: { syncJobId: jobId, level, message } });
  }

  private getConnector(brokerSlug: string): ExchangeConnector {
    const map: Record<string, ExchangeConnector> = {
      binance: this.binance,
      mock_broker: this.mockBroker,
    };
    const connector = map[brokerSlug];
    if (!connector) throw new BadRequestException(`Unknown broker: ${brokerSlug}`);
    return connector;
  }

  private encryptCredentials(data: Record<string, string>): { encryptedData: string; iv: string } {
    const rawKey = this.config.get<string>('encryption.key')!;
    const key = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const plaintext = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      encryptedData: Buffer.concat([encrypted, authTag]).toString('base64'),
      iv: iv.toString('base64'),
    };
  }

  private decryptCredentials(encryptedData: string, ivBase64: string): Record<string, string> {
    const rawKey = this.config.get<string>('encryption.key')!;
    const key = Buffer.from(rawKey.padEnd(32, '0').slice(0, 32), 'utf8');
    const iv = Buffer.from(ivBase64, 'base64');
    const data = Buffer.from(encryptedData, 'base64');
    const authTag = data.slice(-16);
    const encrypted = data.slice(0, -16);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  private async assertOwner(userId: string, brokerAccountId: string) {
    const account = await this.prisma.brokerAccount.findUnique({
      where: { id: brokerAccountId },
      select: { userId: true },
    });
    if (!account) throw new NotFoundException('Broker account not found');
    if (account.userId !== userId) throw new ForbiddenException();
  }
}

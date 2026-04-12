import { PrismaClient, AssetClass, Currency, TransactionType, TransactionSource, NewsCategory, ImpactLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Seed script must not run in production. Aborting.');
    process.exit(1);
  }

  console.log('Seeding database...');

  // ─── Demo User ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      passwordHash,
      displayName: 'Demo User',
      emailVerified: true,
      settings: {
        create: {
          baseCurrency: Currency.USD,
          displayTimezone: 'America/New_York',
        },
      },
    },
  });

  // ─── Assets ────────────────────────────────────────────────────────────────
  const assets = await Promise.all([
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'AAPL', exchange: 'NASDAQ' } },
      update: {},
      create: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetClass: AssetClass.STOCK,
        exchange: 'NASDAQ',
        currency: Currency.USD,
        yahooSymbol: 'AAPL',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'MSFT', exchange: 'NASDAQ' } },
      update: {},
      create: {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        assetClass: AssetClass.STOCK,
        exchange: 'NASDAQ',
        currency: Currency.USD,
        yahooSymbol: 'MSFT',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'NVDA', exchange: 'NASDAQ' } },
      update: {},
      create: {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        assetClass: AssetClass.STOCK,
        exchange: 'NASDAQ',
        currency: Currency.USD,
        yahooSymbol: 'NVDA',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'BTC', exchange: 'CRYPTO' } },
      update: {},
      create: {
        symbol: 'BTC',
        name: 'Bitcoin',
        assetClass: AssetClass.CRYPTO,
        exchange: 'CRYPTO',
        currency: Currency.USD,
        coingeckoId: 'bitcoin',
        yahooSymbol: 'BTC-USD',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'ETH', exchange: 'CRYPTO' } },
      update: {},
      create: {
        symbol: 'ETH',
        name: 'Ethereum',
        assetClass: AssetClass.CRYPTO,
        exchange: 'CRYPTO',
        currency: Currency.USD,
        coingeckoId: 'ethereum',
        yahooSymbol: 'ETH-USD',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'SPY', exchange: 'NYSE' } },
      update: {},
      create: {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        assetClass: AssetClass.ETF,
        exchange: 'NYSE',
        currency: Currency.USD,
        yahooSymbol: 'SPY',
      },
    }),
    prisma.asset.upsert({
      where: { symbol_exchange: { symbol: 'GLD', exchange: 'NYSE' } },
      update: {},
      create: {
        symbol: 'GLD',
        name: 'SPDR Gold Shares',
        assetClass: AssetClass.COMMODITY,
        exchange: 'NYSE',
        currency: Currency.USD,
        yahooSymbol: 'GLD',
      },
    }),
  ]);

  const [aapl, msft, nvda, btc, eth, spy, gld] = assets;

  // ─── Portfolio ─────────────────────────────────────────────────────────────
  const portfolio = await prisma.portfolio.upsert({
    where: { id: 'demo-portfolio-1' },
    update: {},
    create: {
      id: 'demo-portfolio-1',
      userId: user.id,
      name: 'Main Portfolio',
      description: 'My primary investment portfolio',
      currency: Currency.USD,
      isDefault: true,
    },
  });

  // ─── Transactions (idempotent: delete → recreate) ─────────────────────────
  await prisma.holding.deleteMany({ where: { portfolioId: portfolio.id } });
  await prisma.transaction.deleteMany({ where: { portfolioId: portfolio.id } });

  const txData = [
    // AAPL
    { assetId: aapl.id, type: TransactionType.BUY,  quantity: 10,   pricePerUnit: 150,   fee: 0,    executedAt: new Date('2023-01-15') },
    { assetId: aapl.id, type: TransactionType.BUY,  quantity: 5,    pricePerUnit: 165,   fee: 0,    executedAt: new Date('2023-06-10') },
    // MSFT
    { assetId: msft.id, type: TransactionType.BUY,  quantity: 8,    pricePerUnit: 280,   fee: 0,    executedAt: new Date('2023-02-20') },
    // NVDA
    { assetId: nvda.id, type: TransactionType.BUY,  quantity: 15,   pricePerUnit: 220,   fee: 0,    executedAt: new Date('2023-03-01') },
    { assetId: nvda.id, type: TransactionType.SELL, quantity: 5,    pricePerUnit: 480,   fee: 5,    executedAt: new Date('2023-11-15') },
    // BTC
    { assetId: btc.id,  type: TransactionType.BUY,  quantity: 0.5,  pricePerUnit: 25000, fee: 12.5, executedAt: new Date('2023-01-10') },
    { assetId: btc.id,  type: TransactionType.BUY,  quantity: 0.25, pricePerUnit: 29000, fee: 7.25, executedAt: new Date('2023-05-20') },
    // ETH
    { assetId: eth.id,  type: TransactionType.BUY,  quantity: 3,    pricePerUnit: 1600,  fee: 4.8,  executedAt: new Date('2023-02-14') },
    // SPY
    { assetId: spy.id,  type: TransactionType.BUY,  quantity: 5,    pricePerUnit: 390,   fee: 0,    executedAt: new Date('2023-04-01') },
    // GLD
    { assetId: gld.id,  type: TransactionType.BUY,  quantity: 10,   pricePerUnit: 175,   fee: 0,    executedAt: new Date('2023-07-01') },
  ];

  for (const tx of txData) {
    await prisma.transaction.create({
      data: {
        portfolioId: portfolio.id,
        assetId: tx.assetId,
        type: tx.type,
        quantity: tx.quantity,
        pricePerUnit: tx.pricePerUnit,
        totalAmount: tx.quantity * tx.pricePerUnit,
        fee: tx.fee,
        currency: Currency.USD,
        source: TransactionSource.MANUAL,
        executedAt: tx.executedAt,
      },
    });
  }

  // ─── Calculate and seed Holdings (FIFO, mirrors HoldingsCalculatorService) ─
  const BUY_TYPES = [TransactionType.BUY, TransactionType.TRANSFER_IN, TransactionType.AIRDROP, TransactionType.REWARD];
  const SELL_TYPES = [TransactionType.SELL, TransactionType.TRANSFER_OUT];
  const assetIds = [aapl.id, msft.id, nvda.id, btc.id, eth.id, spy.id, gld.id];

  for (const assetId of assetIds) {
    const txs = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id, assetId },
      orderBy: { executedAt: 'asc' },
    });

    const lots: { qty: number; price: number; fee: number }[] = [];
    let realizedPnl = 0;

    for (const tx of txs) {
      const qty   = Number(tx.quantity ?? 0);
      const price = Number(tx.pricePerUnit ?? 0);
      const fee   = Number(tx.fee ?? 0);

      if (BUY_TYPES.includes(tx.type)) {
        lots.push({ qty, price, fee });
      } else if (SELL_TYPES.includes(tx.type)) {
        let remaining = qty;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const consumed = Math.min(remaining, lot.qty);
          const costBasisPerUnit = lot.price + lot.fee / lot.qty;
          realizedPnl += price * consumed - costBasisPerUnit * consumed - (consumed / qty) * fee;
          lot.qty -= consumed;
          remaining -= consumed;
          if (lot.qty <= 1e-12) lots.shift();
        }
      }
    }

    const quantity = lots.reduce((s, l) => s + l.qty, 0);
    if (quantity <= 0) continue;

    const totalCost = lots.reduce((s, l) => s + l.qty * l.price + l.fee, 0);
    const averageBuyPrice = totalCost / quantity;

    await prisma.holding.upsert({
      where: { portfolioId_assetId: { portfolioId: portfolio.id, assetId } },
      update: { quantity, averageBuyPrice, totalCost, realizedPnl, lastCalculatedAt: new Date() },
      create: { portfolioId: portfolio.id, assetId, quantity, averageBuyPrice, totalCost, realizedPnl },
    });
  }
  console.log('Seeded holdings.');

  // ─── Seed mock quotes ──────────────────────────────────────────────────────
  const mockPrices = [
    { assetId: aapl.id, price: 189.5,  changePercent: 1.2,  priceChange: 2.27  },
    { assetId: msft.id, price: 415.0,  changePercent: 0.8,  priceChange: 3.32  },
    { assetId: nvda.id, price: 875.0,  changePercent: 3.1,  priceChange: 27.13 },
    { assetId: btc.id,  price: 67000,  changePercent: 2.5,  priceChange: 1675  },
    { assetId: eth.id,  price: 3500,   changePercent: 1.9,  priceChange: 66.5  },
    { assetId: spy.id,  price: 524.0,  changePercent: 0.5,  priceChange: 2.62  },
    { assetId: gld.id,  price: 222.0,  changePercent: 0.3,  priceChange: 0.67  },
  ];

  for (const q of mockPrices) {
    await prisma.quote.upsert({
      where: { assetId_provider: { assetId: q.assetId, provider: 'mock' } },
      update: { price: q.price, changePercent: q.changePercent, priceChange: q.priceChange, fetchedAt: new Date() },
      create: {
        assetId: q.assetId,
        provider: 'mock',
        price: q.price,
        changePercent: q.changePercent,
        priceChange: q.priceChange,
        currency: Currency.USD,
      },
    });
  }

  // ─── Currency rates ────────────────────────────────────────────────────────
  const rates = [
    { from: Currency.USD, to: Currency.EUR, rate: 0.92 },
    { from: Currency.USD, to: Currency.ILS, rate: 3.72 },
    { from: Currency.EUR, to: Currency.USD, rate: 1.087 },
    { from: Currency.ILS, to: Currency.USD, rate: 0.269 },
  ];

  for (const r of rates) {
    await prisma.currencyRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: r.from, toCurrency: r.to } },
      update: { rate: r.rate },
      create: { fromCurrency: r.from, toCurrency: r.to, rate: r.rate },
    });
  }

  // ─── Expanded asset catalogue ──────────────────────────────────────────────
  const extraAssets = [
    // Stocks – NASDAQ
    { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)',          assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'GOOGL' },
    { symbol: 'AMZN',  name: 'Amazon.com Inc.',                  assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'AMZN' },
    { symbol: 'META',  name: 'Meta Platforms Inc.',              assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'META' },
    { symbol: 'TSLA',  name: 'Tesla Inc.',                       assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'TSLA' },
    { symbol: 'AVGO',  name: 'Broadcom Inc.',                    assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'AVGO' },
    { symbol: 'COST',  name: 'Costco Wholesale Corporation',     assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'COST' },
    { symbol: 'NFLX',  name: 'Netflix Inc.',                     assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'NFLX' },
    { symbol: 'ADBE',  name: 'Adobe Inc.',                       assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'ADBE' },
    { symbol: 'AMD',   name: 'Advanced Micro Devices Inc.',      assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'AMD' },
    { symbol: 'QCOM',  name: 'Qualcomm Inc.',                    assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'QCOM' },
    { symbol: 'INTC',  name: 'Intel Corporation',                assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'INTC' },
    { symbol: 'CSCO',  name: 'Cisco Systems Inc.',               assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'CSCO' },
    { symbol: 'TXN',   name: 'Texas Instruments Inc.',           assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'TXN' },
    { symbol: 'AMAT',  name: 'Applied Materials Inc.',           assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'AMAT' },
    { symbol: 'MU',    name: 'Micron Technology Inc.',           assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'MU' },
    { symbol: 'PANW',  name: 'Palo Alto Networks Inc.',          assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'PANW' },
    { symbol: 'CRWD',  name: 'CrowdStrike Holdings Inc.',        assetClass: AssetClass.STOCK, exchange: 'NASDAQ', yahooSymbol: 'CRWD' },
    // Stocks – NYSE
    { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',             assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'JPM' },
    { symbol: 'V',     name: 'Visa Inc.',                        assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'V' },
    { symbol: 'MA',    name: 'Mastercard Inc.',                  assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'MA' },
    { symbol: 'BAC',   name: 'Bank of America Corporation',      assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'BAC' },
    { symbol: 'WMT',   name: 'Walmart Inc.',                     assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'WMT' },
    { symbol: 'XOM',   name: 'Exxon Mobil Corporation',          assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'XOM' },
    { symbol: 'CVX',   name: 'Chevron Corporation',              assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'CVX' },
    { symbol: 'UNH',   name: 'UnitedHealth Group Inc.',          assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'UNH' },
    { symbol: 'JNJ',   name: 'Johnson & Johnson',                assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'JNJ' },
    { symbol: 'PFE',   name: 'Pfizer Inc.',                      assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'PFE' },
    { symbol: 'MRK',   name: 'Merck & Co. Inc.',                 assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'MRK' },
    { symbol: 'ABBV',  name: 'AbbVie Inc.',                      assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'ABBV' },
    { symbol: 'LLY',   name: 'Eli Lilly and Company',            assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'LLY' },
    { symbol: 'KO',    name: 'The Coca-Cola Company',            assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'KO' },
    { symbol: 'PEP',   name: 'PepsiCo Inc.',                     assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'PEP' },
    { symbol: 'PG',    name: 'Procter & Gamble Co.',             assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'PG' },
    { symbol: 'HD',    name: 'The Home Depot Inc.',              assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'HD' },
    { symbol: 'MCD',   name: "McDonald's Corporation",           assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'MCD' },
    { symbol: 'NKE',   name: 'NIKE Inc.',                        assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'NKE' },
    { symbol: 'DIS',   name: 'The Walt Disney Company',          assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'DIS' },
    { symbol: 'CRM',   name: 'Salesforce Inc.',                  assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'CRM' },
    { symbol: 'ORCL',  name: 'Oracle Corporation',               assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'ORCL' },
    { symbol: 'ACN',   name: 'Accenture plc',                    assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'ACN' },
    { symbol: 'NEE',   name: 'NextEra Energy Inc.',              assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'NEE' },
    { symbol: 'DHR',   name: 'Danaher Corporation',              assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'DHR' },
    { symbol: 'TMO',   name: 'Thermo Fisher Scientific Inc.',    assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'TMO' },
    { symbol: 'ABT',   name: 'Abbott Laboratories',              assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'ABT' },
    { symbol: 'GS',    name: 'The Goldman Sachs Group Inc.',     assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'GS' },
    { symbol: 'MS',    name: 'Morgan Stanley',                   assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'MS' },
    { symbol: 'BRKB',  name: 'Berkshire Hathaway Inc. (Class B)', assetClass: AssetClass.STOCK, exchange: 'NYSE', yahooSymbol: 'BRK-B' },
    // ETFs
    { symbol: 'QQQ',   name: 'Invesco QQQ Trust (NASDAQ-100)',   assetClass: AssetClass.ETF, exchange: 'NASDAQ',    yahooSymbol: 'QQQ' },
    { symbol: 'VTI',   name: 'Vanguard Total Stock Market ETF',  assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'VTI' },
    { symbol: 'VOO',   name: 'Vanguard S&P 500 ETF',            assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'VOO' },
    { symbol: 'IWM',   name: 'iShares Russell 2000 ETF',        assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'IWM' },
    { symbol: 'EFA',   name: 'iShares MSCI EAFE ETF',           assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'EFA' },
    { symbol: 'SLV',   name: 'iShares Silver Trust',            assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'SLV' },
    { symbol: 'ARKK',  name: 'ARK Innovation ETF',              assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'ARKK' },
    { symbol: 'VNQ',   name: 'Vanguard Real Estate ETF',        assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'VNQ' },
    { symbol: 'AGG',   name: 'iShares Core U.S. Aggregate Bond ETF', assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'AGG' },
    { symbol: 'XLK',   name: 'Technology Select Sector SPDR Fund', assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'XLK' },
    { symbol: 'XLF',   name: 'Financial Select Sector SPDR Fund', assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'XLF' },
    { symbol: 'XLE',   name: 'Energy Select Sector SPDR Fund',  assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'XLE' },
    { symbol: 'VGT',   name: 'Vanguard Information Technology ETF', assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'VGT' },
    { symbol: 'SCHD',  name: 'Schwab U.S. Dividend Equity ETF', assetClass: AssetClass.ETF, exchange: 'NYSE Arca', yahooSymbol: 'SCHD' },
    { symbol: 'VXUS',  name: 'Vanguard Total International Stock ETF', assetClass: AssetClass.ETF, exchange: 'NASDAQ', yahooSymbol: 'VXUS' },
    // Crypto
    { symbol: 'BNB',   name: 'BNB',       assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'binancecoin' },
    { symbol: 'SOL',   name: 'Solana',    assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'solana' },
    { symbol: 'XRP',   name: 'XRP',       assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'ripple' },
    { symbol: 'ADA',   name: 'Cardano',   assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'cardano' },
    { symbol: 'DOGE',  name: 'Dogecoin',  assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'dogecoin' },
    { symbol: 'AVAX',  name: 'Avalanche', assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'avalanche-2' },
    { symbol: 'LINK',  name: 'Chainlink', assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'chainlink' },
    { symbol: 'DOT',   name: 'Polkadot',  assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'polkadot' },
    { symbol: 'UNI',   name: 'Uniswap',   assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'uniswap' },
    { symbol: 'LTC',   name: 'Litecoin',  assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'litecoin' },
    { symbol: 'ATOM',  name: 'Cosmos',    assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'cosmos' },
    { symbol: 'MATIC', name: 'Polygon',   assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'matic-network' },
    { symbol: 'SHIB',  name: 'Shiba Inu', assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'shiba-inu' },
    { symbol: 'TON',   name: 'Toncoin',   assetClass: AssetClass.CRYPTO, exchange: 'CRYPTO', coingeckoId: 'the-open-network' },
  ];

  for (const a of extraAssets) {
    await prisma.asset.upsert({
      where: { symbol_exchange: { symbol: a.symbol, exchange: a.exchange } },
      update: {},
      create: {
        symbol: a.symbol,
        name: a.name,
        assetClass: a.assetClass,
        exchange: a.exchange,
        currency: Currency.USD,
        yahooSymbol: (a as any).yahooSymbol ?? null,
        coingeckoId: (a as any).coingeckoId ?? null,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${extraAssets.length} additional assets.`);

  // ─── News Articles ─────────────────────────────────────────────────────────
  function hoursAgo(n: number): Date { return new Date(Date.now() - n * 3_600_000); }
  function daysAgo(n: number): Date {
    const d = new Date(); d.setDate(d.getDate() - n); d.setHours(9, 0, 0, 0); return d;
  }

  const newsArticles = [
    {
      title: 'Federal Reserve Holds Rates Steady, Signals Patience Before Cuts',
      summary: 'The FOMC voted unanimously to keep the federal funds rate in the 5.25–5.50% range. Chair Powell reiterated that the committee needs greater confidence that inflation is moving sustainably toward 2% before reducing rates, tempering market expectations for near-term easing.',
      url: 'https://www.reuters.com/markets/us/fed-holds-rates-signals-patience-cuts-demo',
      source: 'Reuters', category: NewsCategory.FED_CENTRAL_BANKS, impactLevel: ImpactLevel.HIGH,
      affectedMarkets: ['STOCKS', 'BONDS', 'CRYPTO', 'FOREX'], affectedAssets: ['SPY', 'QQQ', 'TLT', 'BTC'], tags: ['fed', 'rates', 'fomc'], publishedAt: hoursAgo(3),
    },
    {
      title: 'U.S. CPI Rises 3.4% YoY in March, Above Consensus Estimate of 3.2%',
      summary: 'The Consumer Price Index climbed 3.4% year-over-year in March, surpassing the 3.2% Wall Street consensus. Core CPI rose 3.8% annually. The hotter-than-expected print pushed Treasury yields sharply higher and dampened rate-cut optimism.',
      url: 'https://www.bloomberg.com/news/articles/us-cpi-march-above-estimates-demo',
      source: 'Bloomberg', category: NewsCategory.INFLATION_MACRO, impactLevel: ImpactLevel.HIGH,
      affectedMarkets: ['STOCKS', 'BONDS', 'FOREX'], affectedAssets: ['SPY', 'TLT', 'GLD'], tags: ['cpi', 'inflation', 'macro'], publishedAt: hoursAgo(7),
    },
    {
      title: 'NVIDIA Reports Record Q1 Revenue of $26B, Beats Estimates by 18%',
      summary: 'NVIDIA posted Q1 revenue of $26.04B, an 18% beat over analyst expectations and up 262% year-over-year. Data center revenue reached $22.6B. The company raised Q2 guidance to $28B, citing insatiable demand for H100 and Blackwell GPUs from hyperscalers.',
      url: 'https://www.wsj.com/articles/nvidia-q1-2025-earnings-record-revenue-demo',
      source: 'Wall Street Journal', category: NewsCategory.EARNINGS, impactLevel: ImpactLevel.HIGH,
      affectedMarkets: ['STOCKS'], affectedAssets: ['NVDA', 'AMD', 'INTC', 'TSM'], tags: ['nvda', 'earnings', 'ai', 'semiconductors'], publishedAt: hoursAgo(12),
    },
    {
      title: 'Bitcoin Spot ETFs See Record $1.3B Single-Day Inflow Across U.S. Issuers',
      summary: "U.S.-listed Bitcoin ETFs collectively attracted $1.3B in net inflows in a single session, shattering the previous record. BlackRock's IBIT led with $735M. Cumulative inflows since January have now surpassed $17 billion.",
      url: 'https://www.coindesk.com/markets/bitcoin-etf-record-inflow-demo',
      source: 'CoinDesk', category: NewsCategory.CRYPTO, impactLevel: ImpactLevel.HIGH,
      affectedMarkets: ['CRYPTO'], affectedAssets: ['BTC', 'ETH'], tags: ['bitcoin', 'etf', 'institutional'], publishedAt: hoursAgo(18),
    },
    {
      title: 'SEC Approves Spot Ethereum ETFs; Eight Products to Begin Trading',
      summary: 'The SEC approved 19b-4 filings for eight spot Ethereum ETF applications from BlackRock, Fidelity, VanEck, and others. Ethereum surged 15%, crossing $3,800, as analysts projected $5–15B in first-year inflows.',
      url: 'https://www.ft.com/content/sec-approves-spot-ethereum-etfs-demo',
      source: 'Financial Times', category: NewsCategory.REGULATORY, impactLevel: ImpactLevel.HIGH,
      affectedMarkets: ['CRYPTO'], affectedAssets: ['ETH', 'BTC', 'SOL'], tags: ['ethereum', 'etf', 'sec'], publishedAt: daysAgo(1),
    },
    {
      title: 'Apple Announces $110B Share Buyback — Largest in Corporate History',
      summary: 'Apple authorized a $110B stock repurchase program, eclipsing its prior record. The announcement accompanied Q2 results showing $90.8B in revenue. Services revenue hit an all-time record of $23.9B.',
      url: 'https://www.cnbc.com/apple-110b-buyback-record-q2-earnings-demo',
      source: 'CNBC', category: NewsCategory.EARNINGS, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['STOCKS'], affectedAssets: ['AAPL', 'QQQ'], tags: ['aapl', 'earnings', 'buyback'], publishedAt: daysAgo(1),
    },
    {
      title: 'ECB Cuts Rates by 25bps — First Reduction Since 2019',
      summary: 'The European Central Bank lowered its key deposit rate by 25bps to 3.75%, its first rate cut in nearly five years. President Lagarde stressed future cuts are not pre-committed. The euro weakened modestly against the dollar.',
      url: 'https://www.reuters.com/markets/europe/ecb-cuts-rates-25bps-first-time-2019-demo',
      source: 'Reuters', category: NewsCategory.FED_CENTRAL_BANKS, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['FOREX', 'BONDS', 'STOCKS'], affectedAssets: ['EUR'], tags: ['ecb', 'rates', 'europe'], publishedAt: daysAgo(2),
    },
    {
      title: 'U.S. Payrolls Add 272K in May, Unemployment Edges Up to 4.0%',
      summary: "May's nonfarm payrolls showed 272,000 jobs added, well above the 180,000 forecast. Average hourly earnings rose 4.1% YoY. The strong headline pushed back market pricing for the first Fed rate cut.",
      url: 'https://www.bloomberg.com/news/us-may-jobs-report-272k-payrolls-demo',
      source: 'Bloomberg', category: NewsCategory.INFLATION_MACRO, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['STOCKS', 'BONDS', 'FOREX'], affectedAssets: ['SPY', 'TLT'], tags: ['jobs', 'payrolls', 'macro'], publishedAt: daysAgo(2),
    },
    {
      title: 'Oil Prices Spike 4% as Middle East Tensions Escalate',
      summary: 'Brent crude surged above $92/barrel on geopolitical tensions raising supply disruption concerns. Energy stocks outperformed. Goldman Sachs raised its year-end Brent forecast to $96.',
      url: 'https://www.wsj.com/articles/oil-prices-spike-geopolitics-middle-east-demo',
      source: 'Wall Street Journal', category: NewsCategory.GEOPOLITICS, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['COMMODITIES', 'STOCKS'], affectedAssets: ['USO', 'XOM', 'CVX', 'GLD'], tags: ['oil', 'geopolitics', 'energy'], publishedAt: daysAgo(2),
    },
    {
      title: 'Ethereum Gas Fees Plunge 85% Following Dencun Upgrade',
      summary: 'Average Ethereum fees fell 85% after the Dencun upgrade activated EIP-4844. Layer-2 networks saw costs drop below $0.01. Developer activity on L2s hit an all-time high post-upgrade.',
      url: 'https://www.coindesk.com/tech/ethereum-dencun-gas-fees-l2-demo',
      source: 'CoinDesk', category: NewsCategory.CRYPTO, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['CRYPTO'], affectedAssets: ['ETH', 'ARB', 'OP'], tags: ['ethereum', 'dencun', 'l2'], publishedAt: daysAgo(3),
    },
    {
      title: 'Microsoft Azure Revenue Grows 31% YoY; AI Adoption Accelerates',
      summary: "Microsoft reported fiscal Q3 revenue of $61.9B (+17% YoY), with Azure growing 31%. AI-integrated products show strong enterprise adoption. Operating income rose 23% to $27.6B.",
      url: 'https://www.cnbc.com/microsoft-q3-azure-cloud-revenue-demo',
      source: 'CNBC', category: NewsCategory.EARNINGS, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['STOCKS'], affectedAssets: ['MSFT', 'AMZN', 'GOOGL'], tags: ['msft', 'earnings', 'cloud', 'ai'], publishedAt: daysAgo(3),
    },
    {
      title: 'Gold Hits All-Time High of $2,450/oz Amid Rate Cut Expectations',
      summary: 'Gold futures reached a new all-time high of $2,450/oz, supported by central bank buying, geopolitical uncertainty, and growing expectations for Fed rate cuts. ETF outflows stabilized.',
      url: 'https://www.ft.com/content/gold-all-time-high-rate-cuts-demo',
      source: 'Financial Times', category: NewsCategory.MARKET_NEWS, impactLevel: ImpactLevel.MEDIUM,
      affectedMarkets: ['COMMODITIES'], affectedAssets: ['GLD', 'SLV', 'GDX'], tags: ['gold', 'commodities', 'inflation-hedge'], publishedAt: daysAgo(4),
    },
    {
      title: 'S&P 500 Closes Above 5,300 for First Time on AI Enthusiasm',
      summary: 'The S&P 500 crossed 5,300 for the first time, driven by AI enthusiasm and strong tech earnings. The index is up ~12% YTD, with the Magnificent Seven contributing disproportionately.',
      url: 'https://www.bloomberg.com/news/sp500-5300-record-ai-demo',
      source: 'Bloomberg', category: NewsCategory.MARKET_NEWS, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['STOCKS'], affectedAssets: ['SPY', 'QQQ', 'NVDA', 'MSFT', 'AAPL'], tags: ['sp500', 'all-time-high', 'ai'], publishedAt: daysAgo(4),
    },
    {
      title: 'Solana DEX Volume Surpasses Ethereum for First Time',
      summary: "On-chain data shows Solana DEX volume exceeded Ethereum's for the first time, driven by memecoin trading and Jupiter's growth. Solana processed $4.2B vs Ethereum-mainnet's $3.8B in 24h.",
      url: 'https://www.coindesk.com/markets/solana-dex-volume-surpasses-ethereum-demo',
      source: 'CoinDesk', category: NewsCategory.CRYPTO, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['CRYPTO'], affectedAssets: ['SOL', 'ETH'], tags: ['solana', 'dex', 'defi'], publishedAt: daysAgo(5),
    },
    {
      title: 'EU AI Act Enters Into Force — Tech Giants Face Compliance Deadlines',
      summary: "The EU AI Act formally entered into force, establishing the world's first comprehensive AI regulatory framework. Prohibited systems must be shut down within six months. Fines can reach €35M or 7% of global revenue.",
      url: 'https://www.ft.com/content/eu-ai-act-enters-force-demo',
      source: 'Financial Times', category: NewsCategory.REGULATORY, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['STOCKS'], affectedAssets: ['MSFT', 'GOOGL', 'META', 'AMZN'], tags: ['eu', 'ai-regulation', 'compliance'], publishedAt: daysAgo(5),
    },
    {
      title: 'Palantir Added to S&P 500, Shares Surge 12%',
      summary: "Palantir Technologies was added to the S&P 500 index, triggering a 12% surge as index funds bought the stock. The inclusion reflects sustained profitability driven by strong demand for its AI Platform.",
      url: 'https://www.cnbc.com/palantir-sp500-index-inclusion-demo',
      source: 'CNBC', category: NewsCategory.MARKET_NEWS, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['STOCKS'], affectedAssets: ['PLTR', 'SPY'], tags: ['pltr', 'sp500', 'index-inclusion'], publishedAt: daysAgo(5),
    },
    {
      title: "China's Manufacturing PMI Rebounds to 51.7, Beating Expectations",
      summary: "China's official manufacturing PMI rose to 51.7 in May from 50.4 in April, the strongest reading in 14 months. New export orders expanded for the first time since January, lifting risk sentiment in Asian markets.",
      url: 'https://www.reuters.com/world/china/china-manufacturing-pmi-rebounds-may-demo',
      source: 'Reuters', category: NewsCategory.INFLATION_MACRO, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['COMMODITIES', 'STOCKS', 'FOREX'], affectedAssets: ['GLD', 'USO', 'FXI'], tags: ['china', 'pmi', 'manufacturing'], publishedAt: daysAgo(6),
    },
    {
      title: 'BlackRock Files to Launch Bitcoin ETF Options on Nasdaq',
      summary: 'BlackRock filed with the SEC to allow options trading on its iShares Bitcoin Trust (IBIT) on Nasdaq. If approved, investors could use leverage and hedging strategies on Bitcoin through regulated options contracts.',
      url: 'https://www.coindesk.com/policy/blackrock-bitcoin-etf-options-nasdaq-demo',
      source: 'CoinDesk', category: NewsCategory.CRYPTO, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['CRYPTO'], affectedAssets: ['BTC'], tags: ['bitcoin', 'etf', 'options', 'blackrock'], publishedAt: daysAgo(6),
    },
    {
      title: 'Weekly Jobless Claims Fall to 210K, Labor Market Resilient',
      summary: 'Initial jobless claims for the week ending June 1 came in at 210,000, below the 218,000 consensus. Continuing claims also declined, reinforcing the narrative of a resilient U.S. labor market.',
      url: 'https://www.reuters.com/markets/us/weekly-jobless-claims-210k-demo',
      source: 'Reuters', category: NewsCategory.INFLATION_MACRO, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['STOCKS', 'BONDS'], affectedAssets: ['SPY'], tags: ['jobless-claims', 'labor-market'], publishedAt: daysAgo(7),
    },
    {
      title: 'Amazon Completes $4B Investment in Anthropic, Deepening AI Partnership',
      summary: "Amazon completed its $4B investment in Anthropic, granting priority access to Claude models via AWS. The deal reflects the accelerating race among cloud giants to secure AI model access and differentiate platforms.",
      url: 'https://www.wsj.com/articles/amazon-anthropic-4b-investment-demo',
      source: 'Wall Street Journal', category: NewsCategory.MARKET_NEWS, impactLevel: ImpactLevel.LOW,
      affectedMarkets: ['STOCKS'], affectedAssets: ['AMZN', 'GOOGL', 'MSFT'], tags: ['amazon', 'ai', 'cloud'], publishedAt: daysAgo(7),
    },
  ];

  for (const article of newsArticles) {
    await prisma.newsArticle.upsert({
      where: { url: article.url },
      update: {},
      create: article,
    });
  }
  console.log(`Seeded ${newsArticles.length} news articles.`);

  console.log('Seed complete ✓');
  console.log('Demo login: demo@example.com / Demo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

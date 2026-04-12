import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ImportService, PreviewRow } from './import.service';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('csv/preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.importService.previewCsv(file.buffer);
  }

  @Post('csv/execute')
  execute(
    @CurrentUser() user: JwtPayload,
    @Body('portfolioId') portfolioId: string,
    @Body('rows') rows: PreviewRow[],
  ) {
    return this.importService.executeCsv(user.sub, portfolioId, rows);
  }
}

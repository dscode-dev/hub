import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ImportCommitResponseDto,
  ImportPreviewResponseDto,
  ImportUploadResponseDto,
} from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { ApplyImportMappingDto } from './dto/import-mapping.dto';
import { ProductImportService } from './product-import.service';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@ApiTags('products')
@Controller('products/import')
@Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK')
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Envia um CSV e retorna colunas + sugestao de mapeamento' })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ImportUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo CSV');
    }

    if (!/\.csv$/i.test(file.originalname)) {
      throw new BadRequestException('Formato nao suportado. Envie um arquivo .csv');
    }

    return this.importService.upload(user, file);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Valida as linhas com o mapeamento escolhido, sem gravar' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyImportMappingDto,
  ): Promise<ImportPreviewResponseDto> {
    return this.importService.preview(user, id, dto.mapping);
  }

  @Post(':id/commit')
  @ApiOperation({ summary: 'Confirma a importacao e cria os produtos validos' })
  commit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyImportMappingDto,
  ): Promise<ImportCommitResponseDto> {
    return this.importService.commit(user, id, dto.mapping);
  }
}

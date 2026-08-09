import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';
import { toNullableNumber } from '@/common/utils/transforms';

export class CountItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Produto invalido' })
  productId!: string;

  /** null limpa a contagem do item (volta a "nao contado"). */
  @ApiProperty({ example: 8, nullable: true })
  @Transform(toNullableNumber)
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe uma quantidade valida' })
  @Min(0, { message: 'A quantidade contada nao pode ser negativa' })
  counted!: number | null;
}

export class SaveCountItemsDto {
  @ApiProperty({ type: [CountItemDto] })
  @IsArray()
  // Teto defensivo: o wizard envia lotes, nao o inventario inteiro de uma vez.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items!: CountItemDto[];
}

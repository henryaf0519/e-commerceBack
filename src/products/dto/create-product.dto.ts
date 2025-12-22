/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsArray,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  ArrayMaxSize,
} from 'class-validator';

export class CreateProductDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  name: string;

  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  description: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @IsArray({ message: 'Images debe ser un arreglo de strings' })
  @IsString({
    each: true,
    message: 'Cada imagen debe ser una URL válida (string)',
  })
  @ArrayMaxSize(4, { message: 'Un producto no puede tener más de 4 imágenes' })
  images: string[];

  @IsNumber({}, { message: 'El stock debe ser un número' })
  @Min(0, { message: 'El inventario no puede ser negativo' })
  stock: number;

  @IsBoolean({ message: 'isNew debe ser un valor booleano' })
  @IsOptional()
  isNew?: boolean;

  @IsBoolean({ message: 'show debe ser un valor booleano' })
  @IsOptional()
  show: boolean = true;
}

export class UpdateProductDto extends CreateProductDto {}

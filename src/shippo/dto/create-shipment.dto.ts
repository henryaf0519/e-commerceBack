import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsNumber,
  IsArray,
} from 'class-validator';

// 1. Definimos la estructura del objeto Dirección (INTACTO)
class AddressPartDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  street1: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

// 2. NUEVO: Definimos la estructura para las Parcelas (Dimensiones)
class ParcelPartDto {
  @IsNumber()
  @IsNotEmpty()
  length: number;

  @IsNumber()
  @IsNotEmpty()
  width: number;

  @IsNumber()
  @IsNotEmpty()
  height: number;

  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class CreateShipmentDto {
  @ValidateNested()
  @Type(() => AddressPartDto)
  @IsNotEmpty()
  addressTo: AddressPartDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParcelPartDto)
  @IsNotEmpty()
  parcels: ParcelPartDto[];

  @IsBoolean()
  @IsOptional()
  async?: boolean;
}

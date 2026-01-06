import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';

// 1. Definimos la estructura del objeto Dirección
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

// 3. DTO Principal para el Envío
export class CreateShipmentDto {
  @ValidateNested()
  @Type(() => AddressPartDto)
  @IsNotEmpty()
  addressTo: AddressPartDto;

  @IsBoolean()
  @IsOptional()
  async?: boolean;
}

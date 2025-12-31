import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
  IsEnum,
} from 'class-validator';
import { DistanceUnitEnum, WeightUnitEnum } from 'shippo/models/components';

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

// 2. Definimos la estructura del objeto Paquete
class ParcelDto {
  @IsString()
  @IsNotEmpty()
  length: string;

  @IsString()
  @IsNotEmpty()
  width: string;

  @IsString()
  @IsNotEmpty()
  height: string;

  // Valida que sea 'in', 'cm', etc.
  @IsEnum(DistanceUnitEnum)
  distanceUnit: DistanceUnitEnum;

  @IsString()
  @IsNotEmpty()
  weight: string;

  // Valida que sea 'lb', 'kg', etc.
  @IsEnum(WeightUnitEnum)
  massUnit: WeightUnitEnum;
}

// 3. DTO Principal para el Envío
export class CreateShipmentDto {
  // Acepta un OBJETO (AddressPartDto)
  @ValidateNested()
  @Type(() => AddressPartDto)
  @IsNotEmpty()
  addressFrom: AddressPartDto;

  // Acepta un OBJETO (AddressPartDto)
  @ValidateNested()
  @Type(() => AddressPartDto)
  @IsNotEmpty()
  addressTo: AddressPartDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  @IsNotEmpty()
  parcels: ParcelDto[];

  @IsBoolean()
  @IsOptional()
  async?: boolean;
}

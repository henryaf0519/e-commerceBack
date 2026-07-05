import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsNumber,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { isNull } from 'util';

class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  title: string;

  @IsNumber()
  price: number;

  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  shippoRateId?: string; // El ID de la tarifa seleccionada en el paso anterior

  @IsString()
  @IsOptional()
  paymentIntentId?: string; // ID de Stripe para referencia

  @IsString()
  @IsOptional()
  discountCode?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNotEmpty()
  shippingAddress: any; // Puedes detallar esto más si quieres validación estricta
}

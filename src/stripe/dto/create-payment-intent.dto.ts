import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @Min(1, { message: 'El monto debe ser al menos 0.50 USD (50 centavos)' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  businessId: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;
}

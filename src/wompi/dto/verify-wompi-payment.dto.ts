import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyWompiPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'El ID de la transacción es requerido' })
  transactionId: string;
}

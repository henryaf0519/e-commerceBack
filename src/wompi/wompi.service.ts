/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerifyWompiPaymentDto } from './dto/verify-wompi-payment.dto';
import { createHash } from 'crypto';

@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);
  private readonly privateKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Leemos la llave privada desde el archivo .env
    this.privateKey =
      this.configService.getOrThrow<string>('WOMPI_PRIVATE_KEY');

    // Leemos el entorno (sandbox o production), por defecto sandbox
    const env = this.configService.get<string>('WOMPI_ENVIRONMENT', 'sandbox');

    this.baseUrl =
      env === 'production'
        ? 'https://production.wompi.co/v1'
        : 'https://sandbox.wompi.co/v1';
  }

  async verifyPayment(dto: VerifyWompiPaymentDto) {
    const { transactionId } = dto;
    this.logger.log(`🔍 Verificando transacción en Wompi: ${transactionId}`);

    try {
      // Hacemos la petición a la API de Wompi
      const response = await fetch(
        `${this.baseUrl}/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.privateKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Wompi API respondió con status: ${response.status}`);
      }

      const responseData = await response.json();
      const transaction = responseData.data;

      // Verificamos si la transacción fue aprobada
      if (transaction.status !== 'APPROVED') {
        throw new BadRequestException(
          `El pago no está aprobado. Estado actual: ${transaction.status}`,
        );
      }

      this.logger.log(
        `✅ Transacción ${transactionId} aprobada por un valor de $${transaction.amount_in_cents / 100} ${transaction.currency}`,
      );

      // Retornamos la info lista para que tu OrdersService la use
      return {
        success: true,
        status: transaction.status,
        paymentMethod: transaction.payment_method_type,
        amount: transaction.amount_in_cents / 100, // Lo pasamos a COP normal
        currency: transaction.currency,
        reference: transaction.reference,
        customerEmail: transaction.customer_email,
      };
    } catch (error) {
      this.logger.error(`❌ Error Verificando Pago en Wompi: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al comunicarse con la pasarela de Wompi',
      );
    }
  }

  generateSignature(
    reference: string,
    amountInCents: number,
    currency: string,
  ): string {
    const integritySecret = this.configService
      .getOrThrow<string>('WOMPI_INTEGRITY_SECRET')
      .trim();

    // El orden es estricto: Referencia + Monto + Moneda + Secreto
    const chain = `${reference}${amountInCents}${currency}${integritySecret}`;

    this.logger.debug(`Cadena a cifrar: ${chain}`);

    return createHash('sha256').update(chain).digest('hex');
  }
}

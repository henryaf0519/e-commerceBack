/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly CURRENCY = 'usd';
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2025-01-27.acacia' as any,
      },
    );
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto) {
    const { amount, businessId, customerEmail } = dto;
    const amountInCents = Math.round(amount * 100);

    this.logger.log(
      `💳 Iniciando pago de $${amount} USD (Business: ${businessId})`,
    );

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: this.CURRENCY,
        automatic_payment_methods: { enabled: true },
        metadata: {
          businessId,
          customerEmail: customerEmail || 'N/A',
        },
        receipt_email: customerEmail,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: this.CURRENCY,
      };
    } catch (error) {
      this.logger.error(`❌ Error Stripe: ${error.message}`);

      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(
        'Error procesando el pago con Stripe',
      );
    }
  }

  /**
   * Verifica si un pago fue exitoso y recupera la URL de la factura.
   * Se llama desde OrdersService cuando se va a crear la orden.
   */
  async verifyPayment(paymentIntentId: string) {
    try {
      this.logger.log(`🔍 Verificando pago: ${paymentIntentId}`);

      // 1. Recuperamos el pago y EXPANDIMOS 'latest_charge' para ver el recibo
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] }, // <--- ESTO TRAE LA FACTURA
      );

      // 2. Verificamos que el estado sea 'succeeded'
      if (paymentIntent.status !== 'succeeded') {
        throw new BadRequestException(
          `El pago no es válido. Estado actual: ${paymentIntent.status}`,
        );
      }

      // 3. Extraemos la URL de la factura
      let receiptUrl: any = null;

      // TypeScript necesita ayuda aquí porque latest_charge puede ser string u objeto
      const charge = paymentIntent.latest_charge as Stripe.Charge;

      if (charge && charge.receipt_url) {
        receiptUrl = charge.receipt_url;
      }

      return {
        success: true,
        status: paymentIntent.status,
        receiptUrl: receiptUrl,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      this.logger.error(`❌ Error Verificando Pago: ${error.message}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('No se pudo verificar el pago con Stripe');
    }
  }
}

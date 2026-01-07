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

}

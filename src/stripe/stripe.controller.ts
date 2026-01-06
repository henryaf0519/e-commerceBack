import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-payment-intent')
  @HttpCode(HttpStatus.OK)
  async createIntent(@Body() dto: CreatePaymentIntentDto) {
    return await this.stripeService.createPaymentIntent(dto);
  }
}

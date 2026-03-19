import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { WompiService } from './wompi.service';
import { VerifyWompiPaymentDto } from './dto/verify-wompi-payment.dto';

@Controller('wompi')
export class WompiController {
  constructor(private readonly wompiService: WompiService) {}

  @Post('verify-payment')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(@Body() dto: VerifyWompiPaymentDto) {
    return await this.wompiService.verifyPayment(dto);
  }

  @Get('generate-signature')
  getSignature(
    @Query('reference') reference: string,
    @Query('amountInCents') amount: string,
    @Query('currency') currency: string,
  ) {
    return {
      signature: this.wompiService.generateSignature(
        reference,
        +amount,
        currency,
      ),
    };
  }
}

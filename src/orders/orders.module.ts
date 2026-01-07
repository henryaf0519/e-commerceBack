import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ShippoModule } from 'src/shippo/shippo.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { EmailsModule } from 'src/emails/emails.module';

@Module({
  imports: [ShippoModule, StripeModule, EmailsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}

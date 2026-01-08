import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { ShippoModule } from './shippo/shippo.module';
import { StripeModule } from './stripe/stripe.module';
import { OrdersModule } from './orders/orders.module';
import { EmailsModule } from './emails/emails.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CommonModule,
    ProductsModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ShippoModule,
    StripeModule,
    OrdersModule,
    EmailsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

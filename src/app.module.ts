import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    CommonModule,
    ProductsModule,
    ConfigModule.forRoot({
      isGlobal: true, // Esto soluciona el error de dependencias globalmente
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

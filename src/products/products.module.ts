import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { SectionsController } from './sections.controller';

@Module({
  controllers: [ProductsController, SectionsController],
  providers: [ProductsService],
})
export class ProductsModule {}

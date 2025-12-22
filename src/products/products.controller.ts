import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto'; // Importa el DTO
import { UpdateProductDto } from './dto/create-product.dto'; // O desde su propio archivo

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() createProductDto: CreateProductDto, // Usa el DTO aquí
  ) {
    return this.productsService.create(businessId, createProductDto);
  }

  @Put(':id')
  update(
    @Headers('x-business-id') bId: string,
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto, // Usa el DTO aquí
  ) {
    return this.productsService.update(bId, productId, dto);
  }

  @Get()
  findAll(@Headers('x-business-id') businessId: string) {
    // Retorna solo los visibles según la lógica del servicio
    return this.productsService.findAllVisible(businessId);
  }

  @Get('admin/all')
  findAllForAdmin(@Headers('x-business-id') businessId: string) {
    return this.productsService.findAllByBusiness(businessId);
  }

  @Get(':id')
  findOne(
    @Headers('x-business-id') businessId: string,
    @Param('id') productId: string,
  ) {
    return this.productsService.findOne(businessId, productId);
  }

  @Delete(':id')
  remove(
    @Headers('x-business-id') businessId: string,
    @Param('id') productId: string,
  ) {
    return this.productsService.remove(businessId, productId);
  }
}

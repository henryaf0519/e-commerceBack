import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('sections')
export class SectionsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async create(
    @Headers('x-business-id') businessId: string,
    @Body('name') sectionName: string,
  ) {
    if (!businessId)
      throw new BadRequestException('Falta el header x-business-id');
    if (!sectionName)
      throw new BadRequestException('El nombre de la sección es obligatorio');

    return this.productsService.createSection(businessId, sectionName);
  }

  @Get()
  async findAll(@Headers('x-business-id') businessId: string) {
    if (!businessId)
      throw new BadRequestException('Falta el header x-business-id');

    // Retorna el array de strings ["Uvasadas", "Carnes"]
    return this.productsService.findAllSections(businessId);
  }
}

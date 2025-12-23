/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Put,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { UpdateProductDto } from './dto/create-product.dto'; // O desde su propio archivo
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/common/services/s3.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly s3Service: S3Service,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  async create(
    @Headers('x-business-id') businessId: string,
    @Body() body: any,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    files: Array<Express.Multer.File>,
  ) {
    // 1. Subir imágenes a S3
    const imageUrls = await Promise.all(
      files.map((file) => this.s3Service.uploadFile(file)),
    );

    // 2. Preparar el DTO de datos (sin el businessId aquí dentro)
    const productDto = {
      name: body.name,
      description: body.description,
      price: parseFloat(body.price),
      stock: parseInt(body.stock),
      show: body.show === 'true',
      isNew: body.isNew === 'true',
      size: '',
      color: '',
      images: imageUrls,
    };

    return this.productsService.create(businessId, productDto);
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

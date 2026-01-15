/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
  Patch,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/common/services/s3.service';
import { AuthGuard } from '@nestjs/passport';

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
      section: body.section,
      show: body.show === 'true',
      isNew: body.isNew === 'true',
      size: '',
      color: '',
      images: imageUrls,
    };

    return this.productsService.create(businessId, productDto);
  }

  @Get()
  findAll(@Headers('x-business-id') businessId: string) {
    // Retorna solo los visibles según la lógica del servicio
    return this.productsService.findAllVisible(businessId);
  }

  @UseGuards(AuthGuard('jwt')) // 🔒 Solo usuarios logueados
  @Get('admin/all')
  async findAllForAdmin(
    @Request() req,
    @Headers('x-business-id') businessId: string,
  ) {
    // 1. Validar que el usuario sea Admin
    const user = req.user;
    if (user.businessId !== businessId) {
      throw new UnauthorizedException(
        'No tienes acceso a los datos de este negocio',
      );
    }

    return this.productsService.findAllByBusiness(businessId);
  }

  @Get(':id')
  findOne(
    @Headers('x-business-id') businessId: string,
    @Param('id') productId: string,
  ) {
    return this.productsService.findOne(businessId, productId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('files'))
  async update(
    @Param('id') productId: string,
    @Headers('x-business-id') businessId: string,
    @Request() req,
    @Body() body: any,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false, // 👈 Importante: En update puede que no suban fotos nuevas
        }),
    )
    files: Array<Express.Multer.File> = [],
  ) {
    let existingImages: string[] = [];
    if (body.existingImages) {
      existingImages = Array.isArray(body.existingImages)
        ? body.existingImages
        : [body.existingImages];
    }

    // 3. Subir las NUEVAS imágenes binarias a S3
    const newImageUrls = await Promise.all(
      files.map((file) => this.s3Service.uploadFile(file)),
    );

    // 4. Combinar: URLs viejas que se quedan + URLs nuevas recién subidas
    const finalImages = [...existingImages, ...newImageUrls];

    // 5. Preparar el objeto para actualizar (parsing de tipos igual que en create)
    const updateProductDto = {
      name: body.name,
      description: body.description,
      price: body.price ? parseFloat(body.price) : undefined,
      stock: body.stock ? parseInt(body.stock) : undefined,
      section: body.section,
      show: body.show === 'true',
      isNew: body.isNew === 'true',
      size: body.size || '',
      color: body.color || '',
      images: finalImages,
    };

    return this.productsService.update(businessId, productId, updateProductDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async remove(
    @Param('id') productId: string,
    @Headers('x-business-id') businessId: string,
  ) {
    return this.productsService.remove(businessId, productId);
  }
}

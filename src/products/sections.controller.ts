/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/common/services/s3.service';

@Controller('sections')
export class SectionsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly s3Service: S3Service,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @UseInterceptors(FileInterceptor('image')) // 'image' debe coincidir con el nombre usado en formData.append('image', ...)
  async create(
    @Headers('x-business-id') businessId: string,
    @Body() body: any,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 1024 * 1024 * 2.5 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }

    // Validar que vengan los textos
    if (!body.title || !body.subtitle || !body.tagline) {
      throw new BadRequestException(
        'Los campos title, subtitle y tagline son obligatorios',
      );
    }

    // Validar que venga la imagen
    if (!file) {
      throw new BadRequestException('La imagen de la sección es obligatoria');
    }

    // 1. Subir la imagen a S3
    const imageUrl = await this.s3Service.uploadFile(file);

    // 2. Preparar el objeto con los datos de la sección
    const sectionDto = {
      title: body.title,
      subtitle: body.subtitle,
      tagline: body.tagline,
      image: imageUrl,
    };

    // 3. Llamar a tu servicio pasando el objeto completo
    // Nota: Deberás asegurarte de que this.productsService.createSection ahora
    // reciba este objeto (sectionDto) en lugar del string sectionName.
    return this.productsService.createSection(businessId, sectionDto);
  }

  @Get()
  async findAll(@Headers('x-business-id') businessId: string) {
    if (!businessId)
      throw new BadRequestException('Falta el header x-business-id');
    return this.productsService.findAllSections(businessId);
  }
}

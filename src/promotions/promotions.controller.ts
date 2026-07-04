import {
  Controller,
  Post,
  Body,
  Headers,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  UseGuards,
  Get,
  BadRequestException,
  Patch,
  Param,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from 'src/common/services/s3.service';
import { PromotionsService } from './promotions.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly s3Service: S3Service,
  ) { }

  @UseGuards(AuthGuard('jwt'))
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

    // 2. Preparar el DTO de datos
    const promotionDto = {
      title: body.title,
      code: body.code,
      startDate: body.startDate,
      endDate: body.endDate,
      images: imageUrls,
      isActive: false,
      percentage:body.percentage,
    };

    return this.promotionsService.create(businessId, promotionDto);
  }


  @Get('all')
  async findAll(@Headers('x-business-id') businessId: string) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.findAll(businessId);
  }

  // promotions.controller.ts
  @UseGuards(AuthGuard('jwt'))
  @Patch(':code/activate')
  async activate(
    @Headers('x-business-id') businessId: string,
    @Param('code') promotionCode: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.activate(businessId, promotionCode);
  }


  @UseGuards(AuthGuard('jwt'))
  @Patch(':code/deactivate')
  async deactivate(
    @Headers('x-business-id') businessId: string,
    @Param('code') promotionCode: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.deactivate(businessId, promotionCode);
  }
}
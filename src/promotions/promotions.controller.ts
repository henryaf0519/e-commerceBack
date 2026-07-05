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
  Query,
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

  // --- RUTAS PÚBLICAS (Sin AuthGuard) ---

  @Get('user/active')
  async findActive(@Headers('x-business-id') businessId: string) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.findActivePromotions(businessId);
  }

  @Post('user/send')
  async sendPromotion(
    @Headers('x-business-id') businessId: string,
    @Body() body: { email: string; code: string; percentage?: string },
  ) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.sendPromotionToUser(businessId, body.email, body.code, Number(body.percentage));
  }

  @Get('user/validate')
  async validatePromotion(
    @Query('code') code: string,
  ) {
    if (!code) {
      throw new BadRequestException('El parámetro code es requerido');
    }
    return this.promotionsService.validateUniqueCode(code);
  }

  // --- RUTAS DE ADMINISTRACIÓN (Con AuthGuard) ---

  @UseGuards(AuthGuard('jwt'))
  @Post('admin')
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
    const imageUrls = await Promise.all(
      files.map((file) => this.s3Service.uploadFile(file)),
    );

    const promotionDto = {
      title: body.title,
      code: body.code,
      startDate: body.startDate,
      endDate: body.endDate,
      images: imageUrls,
      isActive: false,
      percentage: body.percentage,
    };

    return this.promotionsService.create(businessId, promotionDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/all')
  async findAll(@Headers('x-business-id') businessId: string) {
    if (!businessId) {
      throw new BadRequestException('Falta el header x-business-id');
    }
    return this.promotionsService.findAll(businessId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('admin/:code/activate')
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
  @Patch('admin/:code/deactivate')
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
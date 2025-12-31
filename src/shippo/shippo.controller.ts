// src/shippo/shippo.controller.ts
import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { ShippoService } from './shippo.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';

@Controller('shippo')
export class ShippoController {
  constructor(private readonly shippoService: ShippoService) {}

  @Post('shipment')
  createShipment(@Body() createShipmentDto: CreateShipmentDto) {
    return this.shippoService.createShipment(createShipmentDto);
  }

  @Post('transaction')
  purchaseLabel(@Body('rateId') rateId: string) {
    return this.shippoService.purchaseLabel(rateId);
  }

  @Get('transaction/:id')
  getTransaction(@Param('id') id: string) {
    return this.shippoService.getTransaction(id);
  }

  @Get('track')
  async trackShipment(
    @Query('number') number: string,
    @Query('carrier') carrier: string,
  ) {
    return await this.shippoService.trackShipment(number, carrier);
  }
}

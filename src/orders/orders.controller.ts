import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.createOrder(createOrderDto);
  }

  @Get('user')
  findByUser(
    @Query('businessId') businessId: string,
    @Query('email') email: string,
  ) {
    return this.ordersService.getOrdersByUser(businessId, email);
  }
}

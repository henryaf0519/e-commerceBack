/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';

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

  @UseGuards(AuthGuard('jwt'))
  @Get('my-orders')
  async getMyOrders(@Request() req) {
    const { email, businessId } = req.user;
    return this.ordersService.getOrdersByUser(email, businessId);
  }
}

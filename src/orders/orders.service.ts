/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { ShippoService } from '../shippo/shippo.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { StripeService } from 'src/stripe/stripe.service';
import { EmailsService } from 'src/emails/emails.service';

@Injectable()
export class OrdersService {
  private readonly tableName: string;
  private readonly docClient: DynamoDBDocumentClient;
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private configService: ConfigService,
    private shippoService: ShippoService,
    private stripeService: StripeService,
    private emailService: EmailsService,
  ) {
    const client = new DynamoDBClient({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
    this.tableName = this.configService.getOrThrow<string>('ORDERS');
  }

  async createOrder(data: CreateOrderDto) {
    const {
      businessId,
      email,
      shippoRateId,
      items,
      shippingAddress,
      paymentIntentId,
    } = data;
    const orderId = uuidv4();
    const now = new Date().toISOString();

    try {
      // 1. VERIFICAR PAGO CON STRIPE PRIMERO
      if (!paymentIntentId) {
        throw new BadRequestException('ID de pago de Stripe es requerido');
      }
      const paymentVerification =
        await this.stripeService.verifyPayment(paymentIntentId);

      console.log('Payment Verification:', paymentVerification);

      // 2. Generar la etiqueta con Shippo
      const shippingLabel =
        await this.shippoService.purchaseLabel(shippoRateId);
      console.log('Shipping Label:', shippingLabel);

      // 3. Calcular totales para la factura interna
      const subtotal = items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0,
      );

      const invoice = {
        invoiceId: `INV-${orderId.slice(0, 8).toUpperCase()}`,
        date: now,
        items,
        subtotal,
        total: subtotal,
        currency: 'USD',
        status: 'PAID',
        paymentRef: paymentIntentId,
        stripeReceiptUrl: paymentVerification.receiptUrl,
      };
      const shippingData = {
        transactionId: shippingLabel.transactionId,
        trackingNumber: shippingLabel.trackingNumber,
        trackingUrl: shippingLabel.trackingUrl,
        labelUrl: shippingLabel.labelUrl,
        carrier: shippingLabel.carrier,
        address: shippingAddress,
      };

      const dbItem = {
        PK: `BUSINESS#${businessId}`,
        SK: `USER#${email}#ORDER#${orderId}`,
        entityType: 'order',
        createdAt: now,
        email,
        orderId,
        shipping: {
          transactionId: shippingLabel.transactionId,
          trackingNumber: shippingLabel.trackingNumber,
          trackingUrl: shippingLabel.trackingUrl,
          labelUrl: shippingLabel.labelUrl,
          carrier: shippingLabel.carrier,
          address: shippingAddress,
        },
        invoice,
        status: 'PAID_AND_SHIPPED',
      };

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dbItem,
        }),
      );
      await this.emailService.sendOrderConfirmation(email, {
        orderId,
        invoice,
        shipping: shippingData,
      });
      return {
        success: true,
        orderId,
        invoice,
        shipping: {
          trackingUrl: shippingLabel.trackingUrl,
          trackingNumber: shippingLabel.trackingNumber,
          labelUrl: shippingLabel.labelUrl,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error creando orden: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Error procesando la orden');
    }
  }

  async getOrdersByUser(email: string, businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':skPrefix': `USER#${email}#ORDER#`,
      },
    });

    try {
      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      this.logger.error(`Error buscando ordenes: ${error.message}`);
      throw new InternalServerErrorException('Error recuperando tus pedidos');
    }
  }
}

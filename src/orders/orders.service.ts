/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { WompiService } from 'src/wompi/wompi.service';

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
    private wompiService: WompiService,
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

  async createWompiOrder(data: CreateWompiOrderDto) {
    const { businessId, email, items, shippingAddress, transactionId } = data;
    const orderId = uuidv4();
    const now = new Date().toISOString();

    try {
      this.logger.log(`Procesando nueva orden de Wompi: ${transactionId}`);

      // 1. Validar el pago directamente con el módulo de Wompi
      const paymentVerification = await this.wompiService.verifyPayment({
        transactionId,
      });

      // 2. Calcular subtotales
      const subtotal = items.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0,
      );

      // 3. Crear el objeto de factura (Usamos el monto real que Wompi cobró)
      const invoice = {
        invoiceId: `INV-${orderId.slice(0, 8).toUpperCase()}`,
        date: now,
        items,
        subtotal,
        total: paymentVerification.amount,
        currency: paymentVerification.currency,
        status: 'PAID',
        paymentRef: transactionId,
        paymentGateway: 'WOMPI',
        paymentMethod: paymentVerification.paymentMethod, // ej: NEQUI, CARD
      };

      // 4. Datos de envío temporales (Ya que no usamos Shippo aquí)
      const shippingData = {
        transactionId: 'PENDING_MANUAL',
        trackingNumber: 'Por confirmar',
        trackingUrl: null,
        labelUrl: null,
        carrier: 'Logística Interna',
        address: shippingAddress,
      };

      // 5. Construir el registro para DynamoDB
      const dbItem = {
        PK: `BUSINESS#${businessId}`,
        SK: `USER#${email}#ORDER#${orderId}`,
        entityType: 'order',
        createdAt: now,
        email,
        orderId,
        shipping: shippingData,
        invoice,
        status: 'PAID_PENDING_SHIPMENT', // Estado distinto para saber que falta el envío
      };

      // 6. Guardar en base de datos
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dbItem,
        }),
      );

      // 7. Enviar correo de confirmación
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
          trackingUrl: null,
          trackingNumber: 'Por confirmar',
          labelUrl: null,
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error creando orden Wompi: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Error procesando la orden con Wompi',
      );
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

  async findAllByBusiness(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      // 1. Solo usamos la PK en la condición de llave
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
      },
    });

    try {
      const result = await this.docClient.send(command);
      const allItems = result.Items || [];

      // 2. Filtramos en memoria (JavaScript) para obtener solo las órdenes
      // Buscamos que el SK contenga "#ORDER#"
      const orders = allItems.filter(
        (item) => item.SK && item.SK.includes('#ORDER#'),
      );

      // 3. Ordenamos por fecha (descendente: más reciente primero)
      return orders.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      // Ahora el log te dará el error real si algo más falla
      console.error('Error fetching admin orders:', error);
      throw new InternalServerErrorException(
        'Error al cargar las órdenes de la tienda',
      );
    }
  }
}

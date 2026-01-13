/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  private readonly tableName: string;
  private readonly docClient: DynamoDBDocumentClient;

  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.getOrThrow<string>('PRODUCTS');
  }

  async create(businessId: string, productData: CreateProductDto) {
    const productId = uuidv4();
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
        entityType: 'product',
        createdAt: new Date().toISOString(),
        id: productId,
        ...productData,
        show: productData.show ?? true,
      },
    });
    await this.docClient.send(command);
    return { id: productId, ...productData };
  }

  async findAllByBusiness(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      // PK es el negocio, SK empieza por PRODUCT#
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':skPrefix': 'PRODUCT#',
      },
    });

    try {
      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('Error fetching admin inventory:', error);
      throw new InternalServerErrorException(
        'Error al obtener el inventario completo',
      );
    }
  }

  // NUEVO: Método para el cliente final (solo productos con show: true)
  async findAllVisible(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: '#showAttr = :showValue',
      ExpressionAttributeNames: {
        '#showAttr': 'show', // Alias porque 'show' es palabra reservada
      },
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':sk': 'PRODUCT#',
        ':showValue': true,
      },
    });

    const response = await this.docClient.send(command);
    return response.Items;
  }

  async findOne(businessId: string, productId: string) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
      },
    });

    const response = await this.docClient.send(command);
    return response.Item;
  }

  async update(businessId: string, productId: string, updateData: any) {
    // 1. Obtener el producto actual para saber qué imágenes tenía antes
    const currentProduct = await this.findOne(businessId, productId);
    if (!currentProduct) throw new NotFoundException('Producto no encontrado');

    // 3. Actualizar DynamoDB
    // Filtramos campos undefined (por si no enviaron todos los campos en el PATCH)
    const filteredData = Object.fromEntries(
      Object.entries(updateData).filter(([_, v]) => v !== undefined),
    );

    const entries = Object.entries(filteredData);
    const UpdateExpression =
      'set ' + entries.map(([key]) => `#${key} = :${key}`).join(', ');
    const ExpressionAttributeNames = entries.reduce(
      (acc, [key]) => ({ ...acc, [`#${key}`]: key }),
      {},
    );
    const ExpressionAttributeValues = entries.reduce(
      (acc, [key, value]) => ({ ...acc, [`:${key}`]: value }),
      {},
    );

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
      },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await this.docClient.send(command);
    return result.Attributes;
  }

  async remove(businessId: string, productId: string) {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
      },
    });

    try {
      await this.docClient.send(command);
      return { success: true, message: `Producto ${productId} eliminado` };
    } catch (error) {
      console.error('Error deleting product:', error);
      throw new InternalServerErrorException('No se pudo eliminar el producto');
    }
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

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

  async update(
    businessId: string,
    productId: string,
    updateData: UpdateProductDto,
  ) {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
        entityType: 'product',
        updatedAt: new Date().toISOString(),
        ...updateData,
        id: productId,
      },
    });

    await this.docClient.send(command);
    return { id: productId, ...updateData };
  }

  // Este método devuelve TODOS los productos (útil para el panel Admin)
  async findAllByBusiness(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':sk': 'PRODUCT#',
      },
    });

    const response = await this.docClient.send(command);
    return response.Items;
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

  async remove(businessId: string, productId: string) {
    const command = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PRODUCT#${productId}`,
      },
    });

    await this.docClient.send(command);
    return { deleted: true, productId };
  }
}

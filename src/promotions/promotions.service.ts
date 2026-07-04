import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PromotionsService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = 'promotions';
  }

  async create(businessId: string, data: any) {
    const command = new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `BUSINESS#${businessId}`,
        SK: `PROMOTION#${data.code}`,
        entityType: 'promotion',
        createdAt: new Date().toISOString(),
        ...data,
      },
    });
    await this.docClient.send(command);
    return { success: true, ...data };
  }

  async findAll(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':skPrefix': 'PROMOTION#',
      } as any,
      // 👈 Esto excluye el campo conflictivo de la consulta
      ProjectionExpression: '#title, #code, #startDate, #endDate, #createdAt, #isActive',
      ExpressionAttributeNames: {
        '#title': 'title',
        '#code': 'code',
        '#startDate': 'startDate',
        '#endDate': 'endDate',
        '#createdAt': 'createdAt',
        '#isActive': 'isActive',
      },
    });

    try {
      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('Error fetching promotions:', error);
      throw new InternalServerErrorException('Error al obtener las promociones');
    }
  }


  // promotions.service.ts
  async activate(businessId: string, promotionCode: string) {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PROMOTION#${promotionCode}`,
      },
      // Cambiamos el estado 'active' a true
      UpdateExpression: 'set #isActiveAttr = :activeValue',
      ExpressionAttributeNames: {
        '#isActiveAttr': 'isActive', // 'isActive' puede ser palabra reservada
      },
      ExpressionAttributeValues: {
        ':activeValue': true,
      },
      ReturnValues: 'ALL_NEW',
    });

    try {
      const result = await this.docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Error activating promotion:', error);
      throw new InternalServerErrorException('No se pudo activar la promoción');
    }
  }

  async deactivate(businessId: string, promotionCode: string) {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PROMOTION#${promotionCode}`,
      },
      // Cambiamos el estado 'active' a true
      UpdateExpression: 'set #isActiveAttr = :activeValue',
      ExpressionAttributeNames: {
        '#isActiveAttr': 'isActive', // 'isActive' puede ser palabra reservada
      },
      ExpressionAttributeValues: {
        ':activeValue': false,
      },
      ReturnValues: 'ALL_NEW',
    });

    try {
      const result = await this.docClient.send(command);
      return result.Attributes;
    } catch (error) {
      console.error('Error activating promotion:', error);
      throw new InternalServerErrorException('No se pudo activar la promoción');
    }
  }
}
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConfigService } from '@nestjs/config';
import { EmailsService } from 'src/emails/emails.service';

@Injectable()
export class PromotionsService {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(
    private configService: ConfigService,
    private emailService: EmailsService,
  ) {
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

  // promotions.service.ts
  async findActivePromotions(businessId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      // Filtramos para traer solo las que tienen isActive = true
      FilterExpression: '#isActiveAttr = :trueValue',
      ExpressionAttributeNames: {
        '#isActiveAttr': 'isActive',
      },
      ExpressionAttributeValues: {
        ':pk': `BUSINESS#${businessId}`,
        ':skPrefix': 'PROMOTION#',
        ':trueValue': true,
      } as any,
    });

    try {
      const result = await this.docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('Error fetching active promotions:', error);
      throw new InternalServerErrorException('Error al obtener promociones activas');
    }
  }


  // promotions.service.ts

  private async getPromotion(businessId: string, code: string) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `BUSINESS#${businessId}`,
        SK: `PROMOTION#${code}`,
      },
    });

    const result = await this.docClient.send(command);
    return result.Item; // Retorna el objeto si existe, o undefined si no
  }

  // En tu PromotionsService
  async sendPromotionToUser(businessId: string, email: string, campaignCode: string, percentage?: number) {
    const promo = await this.getPromotion(businessId, campaignCode);
    if (!promo) throw new Error('La promoción no existe');

    // 1. Verificar si este email ya tiene un registro en esta campaña usando el índice
    const existing = await this.docClient.send(new QueryCommand({
      TableName: 'PromotionUsage',
      IndexName: 'EmailCampaignIndex', // GSI por email y campaña
      KeyConditionExpression: 'email = :email AND campaign = :campaign',
      ExpressionAttributeValues: { ':email': email, ':campaign': campaignCode }
    }));

    if (existing.Items && existing.Items.length > 0) {
      throw new ConflictException('Ya tienes un código activo para esta campaña');
    }

    // 2. Generar código y guardar usando el código como PK
    const uniqueCode = `${campaignCode}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await this.docClient.send(new PutCommand({
      TableName: 'PromotionUsage',
      Item: {
        PK: uniqueCode, // EL CÓDIGO ES LA LLAVE
        email: email,
        campaign: campaignCode,
        isUsed: false,
        percentage: percentage ?? promo.percentage,
        createdAt: new Date().toISOString(),
      }
    }));

    await this.emailService.sendPromotionEmail(email, uniqueCode);
    return { success: true, uniqueCode };
  }

  // Método para cuando el usuario quiera aplicar el código




  // promotions.service.ts
  async markPromotionAsUsed(uniqueCode: string) {
    const command = new UpdateCommand({
      TableName: 'PromotionUsage',
      Key: { PK: uniqueCode },
      UpdateExpression: 'set isUsed = :val',
      ExpressionAttributeValues: { ':val': true },
      ConditionExpression: 'attribute_exists(PK)' // Solo actualiza si existe
    });

    try {
      await this.docClient.send(command);
    } catch (error) {
      throw new InternalServerErrorException('Error al marcar el código como usado');
    }
  }


  // promotions.service.ts

  async validateUniqueCode(uniqueCode: string) {
    // Realizamos la consulta usando el índice GSI
    const result = await this.docClient.send(new GetCommand({
      TableName: 'PromotionUsage',
      Key: { PK: uniqueCode },
    }));

    if (!result.Item) throw new NotFoundException('Código no encontrado');
    if (result.Item.isUsed) throw new ConflictException('Código ya utilizado');

    return result.Item;
  }



}
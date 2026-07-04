import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
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

  async sendPromotionToUser(businessId: string, email: string, code: string, percentage?: number) {
    // 1. Verificar si la promoción existe (código existente en tabla 'promotions')
    const promo = await this.getPromotion(businessId, code);
    if (!promo) throw new Error('La promoción no existe');

    // 2. Verificar si el email ya usó este código en la tabla 'PromotionUsage'
    // Estructura sugerida: PK=EMAIL#email, SK=PROMO#code
    const usageKey = {
      PK: `EMAIL#${email}`,
      SK: `PROMO#${code}`
    };

    const checkCommand = new GetCommand({
      TableName: 'PromotionUsage', // Asegúrate de crear esta tabla
      Key: usageKey,
    });

    const existingUsage = await this.docClient.send(checkCommand);

    if (existingUsage.Item) {
      throw new ConflictException({
        statusCode: 409,
        message: 'El correo electrónico ya ha solicitado este código anteriormente',
        error: 'PROMOTION_ALREADY_REQUESTED', // Código para que el front sepa qué hacer
      });
    }

    // 3. Registrar el uso inicial (isUsed: false)
    const putUsageCommand = new PutCommand({
      TableName: 'PromotionUsage',
      Item: {
        ...usageKey,
        isUsed: false,
        percentage: percentage || promo.percentage || null,
        createdAt: new Date().toISOString(),
      },
    });

    await this.docClient.send(putUsageCommand);

    // 4. Enviar el correo
    await this.emailService.sendPromotionEmail(email, code);

    return { success: true, message: 'Código enviado correctamente' };
  }


  async markPromotionAsUsed(email: string, code: string) {
    const command = new UpdateCommand({
      TableName: 'PromotionUsage',
      Key: {
        PK: `EMAIL#${email}`,
        SK: `PROMO#${code}`,
      },
      UpdateExpression: 'set isUsed = :val',
      ExpressionAttributeValues: {
        ':val': true,
      },
    });

    await this.docClient.send(command);
  }



}
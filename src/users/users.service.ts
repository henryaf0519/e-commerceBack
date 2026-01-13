/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../auth/dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly tableName: string;
  private readonly docClient: DynamoDBDocumentClient;

  constructor(private configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = this.configService.getOrThrow<string>('USERS');
  }

  // Helper para buscar si el email ya existe
  async findOneByEmail(email: string) {
    const command = new GetCommand({
      TableName: this.tableName,
      Key: {
        PK: `USER#${email}`,
        SK: `PROFILE`,
      },
    });
    const result = await this.docClient.send(command);
    return result.Item;
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, businessId, ...profileData } = createUserDto;

    // 1. Verificar si ya existe
    const existingUser = await this.findOneByEmail(email);
    if (existingUser) {
      throw new ConflictException('Este correo ya está registrado.');
    }

    // 2. Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Armar el objeto para DynamoDB
    const newUser = {
      PK: `USER#${email}`,
      SK: `PROFILE`,
      entityType: 'user',
      createdAt: new Date().toISOString(),
      email,
      password: hashedPassword, // 🔒 Guardamos hash, no texto plano
      businessId,
      name: profileData.name,
      phone: profileData.phone,
      // Agrupamos la dirección para mantener orden
      address: {
        street1: profileData.street1,
        city: profileData.city,
        state: profileData.state,
        zip: profileData.zip,
        country: profileData.country,
      },
      roles: ['customer'],
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: newUser,
        }),
      );

      const { ...result } = newUser;
      return result;
    } catch (error) {
      throw new InternalServerErrorException('Error al crear el usuario en DB');
    }
  }

  async createAdmin(createUserDto: CreateUserDto) {
    const { email, password, businessId, ...profileData } = createUserDto;

    const existingUser = await this.findOneByEmail(email);
    if (existingUser) {
      throw new ConflictException('Este correo ya está registrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = {
      PK: `USER#${email}`,
      SK: `PROFILE`,
      entityType: 'admin',
      createdAt: new Date().toISOString(),
      email,
      password: hashedPassword,
      businessId,
      name: profileData.name,
      phone: profileData.phone,
      address: {
        street1: profileData.street1,
        city: profileData.city,
        state: profileData.state,
        zip: profileData.zip,
        country: profileData.country,
      },
      roles: ['admin'],
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: newAdmin,
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = newAdmin;
      return result;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error al crear el admin en DB');
    }
  }

  async updateProfile(email: string, data: any) {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: `USER#${email}`, SK: 'PROFILE' },
      UpdateExpression: `set #n = :n, phone = :p, address = :addr`,
      ExpressionAttributeNames: { '#n': 'name' }, // 'name' es palabra reservada en Dynamo a veces
      ExpressionAttributeValues: {
        ':n': data.name,
        ':p': data.phone,
        ':addr': {
          // Actualizamos el objeto address completo
          street1: data.street1,
          city: data.city,
          state: data.state,
          zip: data.zip,
          country: data.country,
        },
      },
      ReturnValues: 'ALL_NEW',
    });
    const res = await this.docClient.send(command);
    const { ...cleanUser } = res.Attributes;
    return cleanUser;
  }

  async updatePassword(email: string, newHash: string) {
    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: `USER#${email}`, SK: 'PROFILE' },
      UpdateExpression: 'set password = :p',
      ExpressionAttributeValues: { ':p': newHash },
    });
    await this.docClient.send(command);
  }
}

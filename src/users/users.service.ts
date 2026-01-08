/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { LoginUserDto } from 'src/auth/dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private readonly tableName: string;
  private readonly docClient: DynamoDBDocumentClient;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
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

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.findOneByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas (Email)');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas (Password)');
    }

    const payload = {
      sub: user.PK,
      email: user.email,
      roles: user.roles || ['customer'],
      businessId: user.businessId,
      name: user.name,
    };

    const token = this.jwtService.sign(payload);

    const userWithoutPassword = { ...user };
    delete userWithoutPassword.password;

    return {
      success: true,
      access_token: token,
      user: userWithoutPassword,
    };
  }
}

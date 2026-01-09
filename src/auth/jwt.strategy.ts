/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      // Extrae el token del header "Authorization: Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // La clave secreta debe ser la misma que usaste en AuthModule
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Si el token es válido, esto devuelve los datos del usuario
  validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      businessId: payload.businessId,
    };
  }
}

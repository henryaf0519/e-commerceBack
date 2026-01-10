/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginUserDto } from './dto/login-user.dto';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    // 1. Buscar
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas (Email)');
    }

    // 2. Comparar Password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas (Password)');
    }

    // 3. Generar Token
    const payload = {
      sub: user.PK,
      email: user.email,
      roles: user.roles || ['customer'],
      businessId: user.businessId,
      name: user.name,
    };

    const token = this.jwtService.sign(payload);

    // 4. Limpiar respuesta
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return {
      success: true,
      access_token: token,
      user: userWithoutPassword,
    };
  }

  async updateProfile(email: string, dto: UpdateProfileDto) {
    return this.usersService.updateProfile(email, dto);
  }

  async changePassword(email: string, dto: ChangePasswordDto) {
    // 1. Verificar contraseña actual
    const user = await this.usersService.findOneByEmail(email);
    const isValid = await bcrypt.compare(dto.currentPassword, user?.password);
    if (!isValid)
      throw new UnauthorizedException('La contraseña actual no es correcta');

    // 2. Hash nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(dto.newPassword, salt);

    // 3. Guardar
    await this.usersService.updatePassword(email, newHash);
    return { success: true, message: 'Contraseña actualizada' };
  }
}

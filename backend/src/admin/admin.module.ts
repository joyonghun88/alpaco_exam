import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import * as dotenv from 'dotenv';
dotenv.config();

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.ADMIN_JWT_SECRET || 'ADMIN_SECRET_KEY_CHANGEME',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthService, JwtStrategy],
  exports: [AdminAuthService],
})
export class AdminModule {}

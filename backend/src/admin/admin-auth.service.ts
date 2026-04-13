import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateAdmin(username: string, pass: string): Promise<any> {
    const admin = await this.prisma.admin.findUnique({ where: { username } });
    if (admin && (await bcrypt.compare(pass, admin.password))) {
      const { password, ...result } = admin;
      return result;
    }
    return null;
  }

  async login(admin: any, ip?: string) {
    const payload = { username: admin.username, sub: admin.id, role: admin.role };
    
    // 로깅 기록
    await this.createLog(admin.id, 'LOGIN', 'Successful administrative login', ip);

    return {
      access_token: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async createLog(adminId: string, action: string, details?: string, ip?: string) {
    return this.prisma.adminLog.create({
      data: {
        adminId,
        action,
        details,
        ipAddress: ip
      }
    });
  }

  async register(data: { username: string; password: string; name: string; role?: any }, creatorId?: string) {
    const existing = await this.prisma.admin.findUnique({ where: { username: data.username } });
    if (existing) {
      throw new ConflictException('이미 존재하는 아이디입니다.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const result = await this.prisma.admin.create({
      data: {
        ...data,
        password: hashedPassword,
        role: data.role || 'PROCTOR',
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
      },
    });

    if (creatorId) {
      await this.createLog(creatorId, 'REGISTER_ADMIN', `Registered new admin: ${result.username}`);
    }

    return result;
  }

  async getAllAdmins() {
    return this.prisma.admin.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(id: string, role: any, updaterId: string) {
    const result = await this.prisma.admin.update({
      where: { id },
      data: { role },
    });

    await this.createLog(updaterId, 'UPDATE_ROLE', `Updated role of ${result.username} to ${role}`);
    return result;
  }

  async getLogs(adminId?: string) {
    const where = adminId ? { adminId } : {};
    return this.prisma.adminLog.findMany({
      where,
      include: { admin: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}

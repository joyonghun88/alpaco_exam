import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export declare class AdminAuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    validateAdmin(username: string, pass: string): Promise<any>;
    login(admin: any, ip?: string): Promise<{
        access_token: string;
        admin: {
            id: any;
            username: any;
            name: any;
            role: any;
        };
    }>;
    createLog(adminId: string, action: string, details?: string, ip?: string): Promise<{
        id: string;
        createdAt: Date;
        action: string;
        targetId: string | null;
        details: string | null;
        ipAddress: string | null;
        adminId: string;
    }>;
    register(data: {
        username: string;
        password: string;
        name: string;
        role?: any;
    }, creatorId?: string): Promise<{
        id: string;
        name: string;
        username: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }>;
    getAllAdmins(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        username: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }[]>;
    updateRole(id: string, role: any, updaterId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        username: string;
        password: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }>;
    getLogs(adminId?: string): Promise<({
        admin: {
            name: string;
            username: string;
        };
    } & {
        id: string;
        createdAt: Date;
        action: string;
        targetId: string | null;
        details: string | null;
        ipAddress: string | null;
        adminId: string;
    })[]>;
}

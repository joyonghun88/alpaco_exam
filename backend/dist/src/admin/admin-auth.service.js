"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
let AdminAuthService = class AdminAuthService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async validateAdmin(username, pass) {
        const admin = await this.prisma.admin.findUnique({ where: { username } });
        if (admin && (await bcrypt.compare(pass, admin.password))) {
            const { password, ...result } = admin;
            return result;
        }
        return null;
    }
    async login(admin, ip) {
        const payload = { username: admin.username, sub: admin.id, role: admin.role };
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
    async createLog(adminId, action, details, ip) {
        return this.prisma.adminLog.create({
            data: {
                adminId,
                action,
                details,
                ipAddress: ip
            }
        });
    }
    async register(data, creatorId) {
        const existing = await this.prisma.admin.findUnique({ where: { username: data.username } });
        if (existing) {
            throw new common_1.ConflictException('이미 존재하는 아이디입니다.');
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
    async updateRole(id, role, updaterId) {
        const result = await this.prisma.admin.update({
            where: { id },
            data: { role },
        });
        await this.createLog(updaterId, 'UPDATE_ROLE', `Updated role of ${result.username} to ${role}`);
        return result;
    }
    async getLogs(adminId) {
        const where = adminId ? { adminId } : {};
        return this.prisma.adminLog.findMany({
            where,
            include: { admin: { select: { name: true, username: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }
};
exports.AdminAuthService = AdminAuthService;
exports.AdminAuthService = AdminAuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AdminAuthService);
//# sourceMappingURL=admin-auth.service.js.map
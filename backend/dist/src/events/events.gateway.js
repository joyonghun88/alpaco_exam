"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../prisma/prisma.service");
const presence_service_1 = require("../presence/presence.service");
const allowedSocketOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'https://main.d1jp391cw5p5y.amplifyapp.com'];
let EventsGateway = class EventsGateway {
    prisma;
    presence;
    server;
    constructor(prisma, presence) {
        this.prisma = prisma;
        this.presence = presence;
    }
    async handleConnection(client) {
        const participantIdRaw = client.handshake.auth?.participantId ??
            client.handshake.query?.participantId;
        const participantId = typeof participantIdRaw === 'string' ? participantIdRaw : '';
        if (!participantId)
            return;
        client.data.participantId = participantId;
        await this.presence.markOnline(participantId, client.id);
    }
    async handleDisconnect(client) {
        const participantId = client.data?.participantId;
        if (!participantId)
            return;
        await this.presence.markOffline(participantId, client.id);
    }
    async handleHeartbeat(data, client) {
        const participantId = data?.participantId || client.data?.participantId || '';
        if (!participantId)
            return;
        client.data.participantId = participantId;
        await this.presence.heartbeat(participantId, client.id);
    }
    async handleViolation(data, client) {
        if (!data.participantId)
            return;
        await this.prisma.securityLog.create({
            data: {
                participantId: data.participantId,
                violationType: data.type,
            }
        });
        this.server.emit('admin_update', { event: 'VIOLATION' });
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('presence_heartbeat'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handleHeartbeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('report_violation'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], EventsGateway.prototype, "handleViolation", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedSocketOrigins.some((o) => origin.startsWith(o))) {
                    callback(null, true);
                    return;
                }
                callback(null, false);
            },
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        presence_service_1.PresenceService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map
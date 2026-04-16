import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
export declare class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    private presence;
    server: Server;
    constructor(prisma: PrismaService, presence: PresenceService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleHeartbeat(data: {
        participantId?: string;
    }, client: Socket): Promise<void>;
    handleViolation(data: {
        participantId: string;
        type: string;
    }, client: Socket): Promise<void>;
}

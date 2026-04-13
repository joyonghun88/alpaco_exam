import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
export declare class EventsGateway {
    private prisma;
    server: Server;
    constructor(prisma: PrismaService);
    handleViolation(data: {
        participantId: string;
        type: string;
    }, client: Socket): Promise<void>;
}

import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

const allowedSocketOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'https://main.d1jp391cw5p5y.amplifyapp.com'];

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Allow server-to-server (origin is undefined) and explicitly configured browser origins.
      if (!origin || allowedSocketOrigins.some((o) => origin.startsWith(o))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const participantIdRaw =
      (client.handshake.auth as any)?.participantId ??
      (client.handshake.query as any)?.participantId;

    const participantId = typeof participantIdRaw === 'string' ? participantIdRaw : '';
    if (!participantId) return;

    client.data.participantId = participantId;
    await this.presence.markOnline(participantId, client.id);
  }

  async handleDisconnect(client: Socket) {
    const participantId = (client.data as any)?.participantId as string | undefined;
    if (!participantId) return;
    await this.presence.markOffline(participantId, client.id);
  }

  @SubscribeMessage('presence_heartbeat')
  async handleHeartbeat(
    @MessageBody() data: { participantId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const participantId = data?.participantId || ((client.data as any)?.participantId as string) || '';
    if (!participantId) return;
    client.data.participantId = participantId;
    await this.presence.heartbeat(participantId, client.id);
  }

  @SubscribeMessage('report_violation')
  async handleViolation(@MessageBody() data: { participantId: string; type: string }, @ConnectedSocket() client: Socket) {
    if (!data.participantId) return;

    await this.prisma.securityLog.create({
      data: {
        participantId: data.participantId,
        violationType: data.type,
      }
    });

    // 모든 관리자 대시보드 화면 갱신 트리거
    this.server.emit('admin_update', { event: 'VIOLATION' });
  }
}

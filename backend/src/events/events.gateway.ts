import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

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

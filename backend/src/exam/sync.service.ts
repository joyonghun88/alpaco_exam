import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSync() {
    this.logger.log('Starting background sync from Redis to PostgreSQL...');
    
    // 1. Redis에서 모든 answer 키 검색
    const keys = await this.redis.client.keys('answers:*');
    if (keys.length === 0) return;

    for (const key of keys) {
      const participantId = key.split(':')[1];
      const answers = await this.redis.getAnswers(participantId);
      
      if (Object.keys(answers).length === 0) continue;

      // 2. 각 답변에 대해 Upsert (성능을 위해 트랜잭션 사용 고려 가능하나 여기서는 단순화)
      for (const [questionId, answer] of Object.entries(answers)) {
        await this.prisma.submission.upsert({
          where: { participantId_questionId: { participantId, questionId } },
          create: {
            participantId,
            questionId,
            answerContent: { answer },
            gradingStatus: 'PENDING',
          },
          update: {
            answerContent: { answer },
            gradingStatus: 'PENDING',
          },
        });
      }
    }

    this.logger.log(`Sync completed for ${keys.length} participants.`);
  }
}

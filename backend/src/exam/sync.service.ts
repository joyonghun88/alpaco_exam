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

    const keys = await this.redis.client.keys('answers:*');
    if (keys.length === 0) return;

    for (const key of keys) {
      const participantId = key.split(':')[1];
      if (!participantId) {
        await this.redis.client.del(key);
        continue;
      }

      try {
        const participantExists = await this.prisma.participant.findUnique({
          where: { id: participantId },
          select: { id: true },
        });

        if (!participantExists) {
          this.logger.warn(`[Sync] Participant not found. Skip & delete redis key: ${participantId}`);
          await this.redis.client.del(key);
          continue;
        }

        const answers = await this.redis.getAnswers(participantId);
        if (Object.keys(answers).length === 0) continue;

        for (const [questionId, answer] of Object.entries(answers)) {
          try {
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
          } catch (e) {
            const msg = (e as any)?.message || String(e);
            this.logger.warn(`[Sync] Upsert failed (participant=${participantId}, question=${questionId}): ${msg}`);
          }
        }
      } catch (e) {
        const msg = (e as any)?.message || String(e);
        this.logger.error(`[Sync] Failed for participant=${participantId}: ${msg}`);
      }
    }

    this.logger.log(`Sync completed for ${keys.length} participants.`);
  }
}

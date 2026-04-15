import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  get client(): Redis {
    return this.redis;
  }

  async setAnswer(participantId: string, questionId: string, answer: any) {
    const key = `answers:${participantId}`;
    await this.redis.hset(key, questionId, JSON.stringify(answer));
  }

  async getAnswers(participantId: string) {
    const key = `answers:${participantId}`;
    const allAnswers = await this.redis.hgetall(key);
    const result: Record<string, any> = {};
    for (const [qId, ans] of Object.entries(allAnswers)) {
      result[qId] = JSON.parse(ans);
    }
    return result;
  }

  async clearAnswers(participantId: string) {
    const key = `answers:${participantId}`;
    await this.redis.del(key);
  }

  // --- 상태 정보 캐싱 ---

  async cacheParticipant(id: string, data: any) {
    await this.redis.set(`participant:${id}`, JSON.stringify(data), 'EX', 3600); // 1시간 캐시
  }

  async getParticipant(id: string) {
    const data = await this.redis.get(`participant:${id}`);
    return data ? JSON.parse(data) : null;
  }

  async cacheRoom(id: string, data: any) {
    await this.redis.set(`room:${id}`, JSON.stringify(data), 'EX', 3600);
  }

  async getRoom(id: string) {
    const data = await this.redis.get(`room:${id}`);
    return data ? JSON.parse(data) : null;
  }
}

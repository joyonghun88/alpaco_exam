import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly ttlSeconds: number;

  constructor(private readonly redis: RedisService) {
    const raw = (process.env.PRESENCE_TTL_SECONDS || '60').trim();
    const parsed = Number.parseInt(raw, 10);
    this.ttlSeconds = Number.isFinite(parsed) && parsed > 5 ? parsed : 60;
  }

  private socketsKey(participantId: string) {
    return `presence:sockets:${participantId}`;
  }

  private onlineKey(participantId: string) {
    return `presence:online:${participantId}`;
  }

  async markOnline(participantId: string, socketId: string) {
    if (!participantId || !socketId) return;
    const multi = this.redis.client.multi();
    multi.sadd(this.socketsKey(participantId), socketId);
    multi.expire(this.socketsKey(participantId), this.ttlSeconds);
    multi.set(this.onlineKey(participantId), '1', 'EX', this.ttlSeconds);
    await multi.exec();
  }

  async heartbeat(participantId: string, socketId: string) {
    return this.markOnline(participantId, socketId);
  }

  async markOffline(participantId: string, socketId: string) {
    if (!participantId || !socketId) return;

    const key = this.socketsKey(participantId);
    await this.redis.client.srem(key, socketId);

    const remaining = await this.redis.client.scard(key);
    if (remaining <= 0) {
      await this.redis.client.del(key, this.onlineKey(participantId));
      return;
    }

    // Keep TTL refreshed when there are still sockets.
    await this.redis.client.expire(key, this.ttlSeconds);
    await this.redis.client.set(this.onlineKey(participantId), '1', 'EX', this.ttlSeconds);
  }

  async getOnlineMap(participantIds: string[]) {
    const uniqueIds = Array.from(new Set((participantIds || []).filter(Boolean)));
    const result: Record<string, boolean> = {};
    if (uniqueIds.length === 0) return result;

    const pipeline = this.redis.client.pipeline();
    for (const id of uniqueIds) pipeline.exists(this.onlineKey(id));
    const replies = await pipeline.exec();

    for (let i = 0; i < uniqueIds.length; i++) {
      const existsValue = replies?.[i]?.[1];
      result[uniqueIds[i]] = Number(existsValue) === 1;
    }

    return result;
  }

  async isOnline(participantId: string) {
    if (!participantId) return false;
    return (await this.redis.client.exists(this.onlineKey(participantId))) === 1;
  }

  // Best-effort debug helper.
  async debugDump(participantId: string) {
    try {
      const sockets = await this.redis.client.smembers(this.socketsKey(participantId));
      const online = await this.redis.client.exists(this.onlineKey(participantId));
      return { participantId, online: online === 1, sockets };
    } catch (e) {
      this.logger.warn(`debugDump failed: ${(e as any)?.message || e}`);
      return { participantId, online: false, sockets: [] };
    }
  }
}


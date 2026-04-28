import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';
import { RedisService } from '../redis/redis.service';
import { GradingStatus } from '@prisma/client';

@Injectable()
export class ExamService {
  constructor(
    private prisma: PrismaService,
    private aws: AwsService,
    private redis: RedisService
  ) {}

  async getQuestions(participantId: string) {
    // 1. Redis 캐시 확인
    let p = await this.redis.getParticipant(participantId);
    
    if (!p) {
      // 캐시에 없으면 DB 조회 후 캐싱
      p = await this.prisma.participant.findUnique({
        where: { id: participantId }, 
        include: { room: true }
      });
      if (p) await this.redis.cacheParticipant(participantId, p);
    }
    
    if (!p) throw new NotFoundException('응시자 정보를 찾을 수 없습니다.');

    // 2. 보안 강화: 고시장 상태 및 시간 검증
    const now = new Date();
    // JSON 직렬화/역직렬화 시 Date 객체가 문자열로 변환되므로 변형 확인 필요
    const roomStart = new Date(p.room.startAt);
    const roomEnd = new Date(p.room.endAt);
    
    const isActiveStatus = p.room.status === 'READY' || p.room.status === 'IN_PROGRESS';
    if (!isActiveStatus || now < roomStart || now > roomEnd) {
      throw new ForbiddenException('현재는 시험 문제를 조회할 수 있는 시간이 아닙니다.');
    }

    if (p.status === 'COMPLETED' || p.status === 'DISQUALIFIED') {
      throw new ForbiddenException('이미 제출 완료되었거나 실격된 응시자입니다.');
    }

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: p.room.examId },
      orderBy: { orderNum: 'asc' },
      include: { 
        question: {
          include: { parent: true }
        }
      }
    });

    return examQuestions.map((eq, index) => {
      const q = eq.question as any;
      const content = { ...q.content };
      
      // 만약 연계 문항인데 현재 문항에 지문이 없다면 부모의 지문을 사용
      if (q.parentId && q.parent && !content.passage) {
        content.passage = q.parent.content?.passage;
      }

      return {
        id: q.id,
        type: q.type,
        content,
        // Taker UI displays this value directly. Use sequential numbering (1..N)
        // based on the sorted order to avoid gaps when orderNum has been edited.
        orderNum: index + 1,
        point: eq.point
      };
    });
  }

  async saveProgress(participantId: string, questionId: string, answer: any) {
    // 1. Redis 캐시에서 응시자 정보 확인
    let p = await this.redis.getParticipant(participantId);
    
    if (!p) {
      p = await this.prisma.participant.findUnique({ 
        where: { id: participantId }, 
        include: { room: true } 
      });
      if (p) await this.redis.cacheParticipant(participantId, p);
    }
    
    if (!p || p.status !== 'TESTING') return;

    const now = new Date();
    const roomEnd = new Date(p.room.endAt);
    if (now > roomEnd) return;

    // 2. DB 대신 Redis에 임시 저장 (Write-back 전략)
    await this.redis.setAnswer(participantId, questionId, answer);
    
    return { success: true };
  }

  async submitAnswers(participantId: string, manualAnswers?: Record<string, number>) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId }, include: { room: true }
    });
    if (!p) throw new NotFoundException('응시자 정보를 찾을 수 없습니다.');

    const now = new Date();
    if (p.room.status !== 'IN_PROGRESS' || now > p.room.endAt) {
      throw new ForbiddenException('시험 종료 후에는 답안을 제출할 수 없습니다.');
    }

    if (p.status !== 'TESTING') {
      throw new ForbiddenException('현재 응시 중 상태가 아닙니다.');
    }

    // 1. Redis에서 모든 임시 답안 가져오기
    const redisAnswers = await this.redis.getAnswers(participantId);
    // 프론트엔드에서 최종 전달된 답안이 있다면 우선순위 적용 (일종의 세이프티)
    const finalAnswers = { ...redisAnswers, ...manualAnswers };

    const examQuestions = await this.prisma.examQuestion.findMany({ 
      where: { examId: p.room.examId },
      include: { question: true }
    });
    
    let totalScore = 0;
    const submissionsData: any[] = [];

    const normalizeText = (value: any) =>
      String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    for (const eq of examQuestions) {
      const q: any = eq.question;
      const userAns = finalAnswers[q.id];

      let earnedPoint = 0;
      let gradingStatus: GradingStatus = GradingStatus.PENDING;

      const storedCorrect = q.correctAnswer;

      if (q.type === 'MULTIPLE_CHOICE') {
        gradingStatus = GradingStatus.AUTO_GRADED;

        const correctList = Array.isArray(storedCorrect)
          ? storedCorrect.map((v: any) => String(v)).sort()
          : storedCorrect !== undefined && storedCorrect !== null
            ? [String(storedCorrect)]
            : [];

        const userList = Array.isArray(userAns)
          ? userAns.map((v: any) => String(v)).sort()
          : userAns !== undefined && userAns !== null
            ? [String(userAns)]
            : [];

        const isCorrect = userList.length > 0 && userList.join(',') === correctList.join(',');
        earnedPoint = isCorrect ? eq.point : 0;
      } else if (q.type === 'FILL_IN_THE_BLANK') {
        gradingStatus = GradingStatus.AUTO_GRADED;

        const correctRaw = Array.isArray(storedCorrect)
          ? storedCorrect
          : (storedCorrect && typeof storedCorrect === 'object' && (storedCorrect as any).answer)
            ? (storedCorrect as any).answer
            : storedCorrect !== undefined && storedCorrect !== null
              ? [storedCorrect]
              : [];

        const correctVariants = (correctRaw || []).map(normalizeText).filter(Boolean);
        const userValue = normalizeText(userAns);
        const isCorrect = !!userValue && correctVariants.includes(userValue);
        earnedPoint = isCorrect ? eq.point : 0;
      } else if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
        gradingStatus = GradingStatus.PENDING;
        earnedPoint = 0;
      } else {
        gradingStatus = GradingStatus.PENDING;
        earnedPoint = 0;
      }

      if (gradingStatus === GradingStatus.AUTO_GRADED) totalScore += earnedPoint;

      submissionsData.push({
        participantId,
        questionId: q.id,
        answerContent: { answer: userAns ?? null },
        earnedPoint,
        gradingStatus
      });
    }

    // 2. 트랜잭션을 통한 Bulk Update 처리
    await this.prisma.$transaction(async (tx) => {
      // 기존 임시 저장본(혹시 있다면) 삭제 후 일괄 생성
      await tx.submission.deleteMany({ where: { participantId } });
      await tx.submission.createMany({ data: submissionsData });

      await tx.participant.update({
        where: { id: participantId },
        data: { status: 'COMPLETED', submittedAt: new Date() }
      });
    });

    // 3. 제출 완료 후 Redis 정리 (데이터 및 캐시)
    await this.redis.clearAnswers(participantId);
    await this.redis.client.del(`participant:${participantId}`);
    
    return { success: true, score: totalScore };
  }

  async getKvsCredentials(participantId: string, role: 'MASTER' | 'VIEWER' = 'VIEWER') {
    let p = await this.redis.getParticipant(participantId);
    if (!p) {
      p = await this.prisma.participant.findUnique({
        where: { id: participantId }
      });
      if (p) await this.redis.cacheParticipant(participantId, p);
    }
    if (!p) throw new NotFoundException('응시자 정보를 찾을 수 없습니다.');

    const channel = await this.aws.getOrCreateSignalingChannel(participantId);
    if (!channel) {
      throw new BadRequestException('KVS Signaling Channel을 찾거나 생성할 수 없습니다.');
    }
    console.log('[ExamService] KVS Channel Info:', JSON.stringify(channel, null, 2));

    const credentials = await this.aws.getTemporaryCredentials();
    const iceServers = await this.aws.getIceServers(channel.ChannelARN!);
    const signalingEndpoint = await this.aws.getSignalingEndpoint(channel.ChannelARN!, role);
    
    console.log(`[ExamService] Signaling Endpoint for ${role}:`, signalingEndpoint);

    return {
      channelArn: channel.ChannelARN,
      channelName: channel.ChannelName,
      signalingEndpoint,
      iceServers,
      ...credentials
    };
  }
}

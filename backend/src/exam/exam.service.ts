import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';

@Injectable()
export class ExamService {
  constructor(
    private prisma: PrismaService,
    private aws: AwsService
  ) {}

  async getQuestions(participantId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId }, 
      include: { room: true }
    });
    
    if (!p) throw new Error("Participant not found");

    // 보안 강화: 고시장 상태 및 시간 검증
    const now = new Date();
    const isActiveStatus = p.room.status === 'READY' || p.room.status === 'IN_PROGRESS';
    if (!isActiveStatus || now < p.room.startAt || now > p.room.endAt) {
      throw new Error("현재는 시험 문제를 조회할 수 있는 시간이 아닙니다.");
    }

    if (p.status === 'COMPLETED' || p.status === 'DISQUALIFIED') {
      throw new Error("이미 제출 완료되었거나 실격된 응시자입니다.");
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

    return examQuestions.map(eq => {
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
        orderNum: eq.orderNum,
        point: eq.point
      };
    });
  }

  async saveProgress(participantId: string, questionId: string, answer: any) {
    const p = await this.prisma.participant.findUnique({ where: { id: participantId }, include: { room: true } });
    if (!p || p.status !== 'TESTING') return;

    const now = new Date();
    if (now > p.room.endAt) return;

    return this.prisma.submission.upsert({
      where: { participantId_questionId: { participantId, questionId } },
      create: { 
        participantId, 
        questionId, 
        answerContent: { answer }, 
        gradingStatus: 'PENDING' 
      },
      update: { 
        answerContent: { answer },
        gradingStatus: 'PENDING'
      }
    });
  }

  async submitAnswers(participantId: string, answers: Record<string, number>) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId }, include: { room: true }
    });
    if (!p) throw new Error("Participant not found");

    const now = new Date();
    if (p.room.status !== 'IN_PROGRESS' || now > p.room.endAt) {
      throw new Error("시험 종료 후에는 답안을 제출할 수 없습니다.");
    }

    if (p.status !== 'TESTING') {
      throw new Error("현재 응시 중 상태가 아닙니다.");
    }

    const examQuestions = await this.prisma.examQuestion.findMany({ 
      where: { examId: p.room.examId },
      include: { question: true }
    });
    
    let totalScore = 0;
        for (const eq of examQuestions) {
        const q = eq.question;
        const userAns = answers[q.id];
        let isCorrect = false;
        
        // 정답 비교 로직 고도화
        const storedCorrect = q.correctAnswer;
        let actualCorrect: any = null;

        if (Array.isArray(storedCorrect)) {
          actualCorrect = storedCorrect[0];
        } else if (typeof storedCorrect === 'object' && (storedCorrect as any).answer) {
          actualCorrect = (storedCorrect as any).answer[0];
        } else {
          actualCorrect = storedCorrect;
        }

        // 타입 불일치 방지를 위해 문자열로 비교
        if (userAns !== undefined && String(userAns) === String(actualCorrect)) {
          isCorrect = true;
          totalScore += eq.point;
        }
       
       await this.prisma.submission.upsert({
         where: { participantId_questionId: { participantId, questionId: q.id } },
         create: { 
           participantId, 
           questionId: q.id, 
           answerContent: { answer: userAns ?? null }, 
           earnedPoint: isCorrect ? eq.point : 0, 
           gradingStatus: 'AUTO_GRADED' 
         },
         update: { 
           answerContent: { answer: userAns ?? null }, 
           earnedPoint: isCorrect ? eq.point : 0, 
           gradingStatus: 'AUTO_GRADED' 
         }
       });
    }

    await this.prisma.participant.update({
      where: { id: participantId },
      data: { status: 'COMPLETED', submittedAt: new Date() }
    });
    
    return { success: true, score: totalScore };
  }

  async getKvsCredentials(participantId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId }
    });
    if (!p) throw new Error("Participant not found");

    const channel = await this.aws.getOrCreateSignalingChannel(participantId);
    if (!channel) {
      throw new Error("KVS Signaling Channel을 찾거나 생성할 수 없습니다.");
    }
    const credentials = await this.aws.getTemporaryCredentials();
    const iceServers = await this.aws.getIceServers(channel.ChannelARN!);

    return {
      channelArn: channel.ChannelARN,
      channelName: channel.ChannelName,
      iceServers,
      ...credentials
    };
  }
}

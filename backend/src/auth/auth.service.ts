import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async verifyAndStartExam(inviteCode: string, agreedTerms?: boolean) {
    // 1. Participant(피시험자) 정보와 연결된 Room, Exam 정보까지 한 번에 Left Join
    const participant = await this.prisma.participant.findUnique({
      where: { invitationCode: inviteCode },
      include: { room: { include: { exam: true } } }
    });

    if (!participant) {
      throw new HttpException('유효하지 않은 초대코드입니다. 확인 후 다시 입력해 주세요.', HttpStatus.UNAUTHORIZED);
    }

    // 2. 시험 시작 가능 여부 확인 (READY 상태에서 시작 시각 전이면 대기)
    const now = new Date();
    const room = participant.room;
    if (room.status === 'READY' && now < room.startAt) {
      throw new HttpException({
        type: 'NOT_STARTED_YET',
        message: '시험이 아직 시작되지 않았습니다.',
        startTime: room.startAt,
        waitingMessage: room.waitingMessage || '시험 시작 시간까지 잠시 기다려 주세요.',
        waitingTitle: room.waitingTitle || 'AI 평가 샌드박스',
        iconType: room.iconType || 'Activity',
        isRequireCamera: room.isRequireCamera, // 카메라 설정 반환
        standardTerms: room.standardTerms,
        cameraTerms: room.cameraTerms
      }, HttpStatus.FORBIDDEN);
    }

    // 3. 최초 입장 시 상태 업데이트 및 시간 기록
    if (participant.status === 'READY') {
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: {
          status: 'TESTING',
          startedAt: new Date(),
          termsAgreedAt: agreedTerms ? new Date() : null // 동의한 경우 시각 기록
        }
      });
    } else if (agreedTerms && !participant.termsAgreedAt) {
      // 이미 시작했지만 동의 시점이 누락된 경우(업데이트 대응) 보완
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { termsAgreedAt: new Date() }
      });
    }

    // 3. 다시 최신화된 정보 가져오기
    const updated = await this.prisma.participant.findUnique({
      where: { id: participant.id },
      include: { room: { include: { exam: true } } }
    });

    return {
      message: '인증 성공 및 샌드박스 입장 승인',
      participantId: updated!.id,
      name: updated!.name,
      examRoom: {
        id: updated!.room.id,
        title: updated!.room.exam.title,
        durationMinutes: updated!.room.durationMinutes,
        isShuffleQuestions: updated!.room.isShuffleQuestions,
        isRequireCamera: updated!.room.isRequireCamera, // 입장 후에도 확인용
        standardTerms: updated!.room.standardTerms,
        cameraTerms: updated!.room.cameraTerms
      },
      startedAt: updated!.startedAt,
    };
  }
}

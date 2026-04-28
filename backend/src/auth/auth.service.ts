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

    const now = new Date();
    const room = participant.room;

    // A. 이미 시험을 제출한 인원인지 확인
    if (participant.status === 'COMPLETED') {
      throw new HttpException('이미 시험을 제출하셨습니다. 재입장이 불가능합니다.', HttpStatus.FORBIDDEN);
    }

    // B. 고사장 상태가 '종료'인 경우
    if (room.status === 'CLOSED') {
      throw new HttpException('이미 종료된 고사장입니다. 입장이 불가능합니다.', HttpStatus.FORBIDDEN);
    }

    // C. 종료 시간이 지난 경우 (상태가 종료가 아니더라도)
    if (now > room.endAt) {
      throw new HttpException('시험 응시 시간이 종료되었습니다.', HttpStatus.FORBIDDEN);
    }

    // D. 시험 시작 가능 여부 확인 (READY 상태에서 시작 시각 전이면 대기)
    if (room.status === 'READY') {
      if (now < room.startAt) {
        throw new HttpException({
          type: 'NOT_STARTED_YET',
          message: '시험이 아직 시작되지 않았습니다.',
          startTime: room.startAt,
          waitingMessage: room.waitingMessage || '시험 시작 시간까지 잠시 기다려 주세요.',
          waitingTitle: room.waitingTitle || 'AI 평가 샌드박스',
          iconType: room.iconType || 'Activity',
          isRequireCamera: room.isRequireCamera,
          standardTerms: room.standardTerms,
          cameraTerms: room.cameraTerms
        }, HttpStatus.FORBIDDEN);
      } else {
        // 이미 시작 시간이 지났는데 READY 상태인 경우 -> IN_PROGRESS로 자동 전환
        await this.prisma.examRoom.update({
          where: { id: room.id },
          data: { status: 'IN_PROGRESS' }
        });
      }
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
      expiresAt: (() => {
        const started = updated!.startedAt ? new Date(updated!.startedAt) : new Date();
        const byDuration = new Date(started.getTime() + updated!.room.durationMinutes * 60 * 1000);
        const roomEnd = new Date(updated!.room.endAt);
        return byDuration < roomEnd ? byDuration : roomEnd;
      })(),
    };
  }
}

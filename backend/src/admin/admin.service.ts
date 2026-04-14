import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private aws: AwsService
  ) {}

  // 감사 로그 기록 유틸리티 (개인정보보호법 준수용)
  async logAdminAction(adminId: string, action: string, targetId?: string, details?: string, ip?: string) {
    return this.prisma.adminLog.create({
      data: { adminId, action, targetId, details, ipAddress: ip }
    });
  }

  async getDashboardData(adminId: string, roomId?: string) {
    // 감사 로그 기록: 대시보드 접근
    await this.logAdminAction(adminId, 'DASHBOARD_VIEW', roomId, `RoomID: ${roomId || 'ALL'}`);

    const where: any = {};
    if (roomId) {
      where.roomId = roomId;
    }

    const participants = await this.prisma.participant.findMany({
      where,
      include: {
        room: { include: { exam: { include: { questions: true } } } },
        _count: { select: { securityLogs: true } },
        submissions: {
          include: { question: true }
        },
        securityLogs: {
          orderBy: { capturedAt: 'desc' }
        }
      },
      orderBy: { startedAt: 'desc' },
    });

    const results = await Promise.all(participants.map(async p => {
      const totalScore = p.submissions.reduce((sum, s) => sum + (s.earnedPoint || 0), 0);
      const questionResults = p.room.exam.questions.map(eq => {
        const sub = p.submissions.find(s => s.questionId === eq.questionId);
        return {
          questionId: eq.questionId,
          orderNum: eq.orderNum,
          point: eq.point,
          earnedPoint: sub ? sub.earnedPoint : 0,
          gradingStatus: sub ? sub.gradingStatus : 'PENDING'
        };
      });

      // 응시자 전체 영상 URL 조회
      const videoUrl = await this.aws.getVideoStreamUrl(p.id);

      // 위반 로그별 전후 10초 클립 URL 매핑
      const securityLogs = await Promise.all(p.securityLogs.map(async log => {
        const clipUrl = await this.aws.getViolationClipUrl(p.id, log.capturedAt);
        return {
          ...log,
          id: log.id.toString(),
          clipUrl // 전후 10초 영상 주소
        };
      }));

      return {
        id: p.id,
        name: p.name,
        email: p.email,
        roomName: p.room.roomName,
        status: p.status,
        startedAt: p.startedAt,
        violationCount: p._count.securityLogs,
        inviteCode: p.invitationCode,
        totalScore,
        questionResults,
        videoUrl, // 전체 다시보기 링크
        securityLogs
      };
    }));

    return results;
  }

  async getExams() {
    return this.prisma.exam.findMany({
      include: {
        _count: { select: { questions: true, examRooms: true } },
      },
      orderBy: { createdAt: 'desc' } as any
    });
  }

  async getExamDetail(id: string) {
    return (this.prisma as any).exam.findUnique({
      where: { id },
      include: {
        questions: {
          include: { question: true },
          orderBy: { orderNum: 'asc' }
        }
      }
    });
  }

  async createExam(title: string, description: string) {
    return this.prisma.exam.create({
      data: { title, description }
    });
  }

  async deleteExam(id: string) {
    return this.prisma.exam.delete({ where: { id } });
  }

  // 1. 문제 은행 조회
  async getQuestionPool() {
    return this.prisma.question.findMany({
      include: { parent: true },
      orderBy: { createdAt: 'desc' } as any
    });
  }

  // 2. 문제 은행 문항 추가
  async addQuestionToPool(category: string, type: string, content: any, correctAnswer: any, parentId?: string) {
    return this.prisma.question.create({
      data: { category, type: type as any, content, correctAnswer, parentId } as any
    });
  }

  // 2-1. 문제 은행 문항 수정
  async updateQuestion(id: string, category: string, type: string, content: any, correctAnswer: any, parentId?: string) {
    return this.prisma.question.update({
      where: { id },
      data: { category, type: type as any, content, correctAnswer, parentId } as any
    });
  }

  // 2-2. 문제 은행 문항 삭제
  async deleteQuestion(id: string) {
    return this.prisma.question.delete({ where: { id } });
  }

  // 2-2. 문제 대량 등록
  async bulkAddQuestions(questions: { category: string, type: string, content: any, correctAnswer: any }[]) {
    return this.prisma.question.createMany({
       data: questions.map(q => ({ ...q, type: q.type as any })) as any
    });
  }

  // 3. 시험지에 문제 등록
  async assignQuestionToExam(examId: string, questionId: string, orderNum: number, point: number) {
    return (this.prisma as any).examQuestion.upsert({
      where: { examId_questionId: { examId, questionId } },
      create: { examId, questionId, orderNum, point },
      update: { orderNum, point }
    });
  }

  async removeQuestionFromExam(examId: string, questionId: string) {
    return (this.prisma as any).examQuestion.delete({
      where: { examId_questionId: { examId, questionId } }
    });
  }

  async updateExamQuestion(examId: string, questionId: string, orderNum: number, point: number) {
    return (this.prisma as any).examQuestion.update({
      where: { examId_questionId: { examId, questionId } },
      data: { orderNum, point }
    });
  }

  async getRooms() {
    return this.prisma.examRoom.findMany({
      include: {
        exam: { 
          include: { 
            questions: { include: { question: true } } 
          } 
        },
        _count: { select: { participants: true } }
      },
      orderBy: { startAt: 'desc' }
    });
  }

  async createRoom(examId: string, roomName: string, durationMinutes: number, startAt?: string, isRequireCamera: boolean = false, standardTerms?: string, cameraTerms?: string) {
    const startDate = startAt ? new Date(startAt) : new Date();
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000); // 30분 여유 제거, 정규 시간으로 설정
    
    return this.prisma.examRoom.create({
      data: {
        examId,
        roomName,
        durationMinutes,
        violationLimit: 3,
        startAt: startDate,
        endAt: endDate,
        status: 'READY',
        isRequireCamera,
        waitingMessage: '시험 시작 전입니다. 잠시만 대기해 주세요.',
        standardTerms: standardTerms || '시험 본인 확인 및 부정행위 방지를 위해 성명, 이메일 정보를 수집합니다.',
        cameraTerms: cameraTerms || '실시간 감독을 위해 시험 중 수험생의 안면 및 주변 환경 영상을 수집 및 저장합니다.'
      }
    });
  }

  async deleteRoom(adminId: string, id: string) {
    // 권한 체크: 방 삭제는 SUPER_ADMIN만 가능 (예시)
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (admin?.role !== 'SUPER_ADMIN') throw new Error("방 삭제 권한이 없습니다.");

    await this.logAdminAction(adminId, 'ROOM_DELETE', id);
    return this.prisma.examRoom.delete({ where: { id } });
  }

  async getParticipants(adminId: string) {
    await this.logAdminAction(adminId, 'PARTICIPANT_LIST_VIEW');
    return this.prisma.participant.findMany({
      include: { room: true },
      orderBy: { name: 'asc' }
    });
  }

  async deleteParticipant(adminId: string, id: string) {
    await this.logAdminAction(adminId, 'PARTICIPANT_DELETE', id);
    return this.prisma.participant.delete({ where: { id } });
  }

  async addParticipant(name: string, email: string, roomId?: string) {
    let room;
    if (roomId) {
      room = await this.prisma.examRoom.findUnique({ where: { id: roomId } });
    } else {
      room = await this.prisma.examRoom.findFirst();
    }
    if (!room) throw new Error("시험장이 없습니다.");

    const CodeStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteCode = `ALPACO-${CodeStr}`;

    return this.prisma.participant.create({
      data: {
        roomId: room.id,
        name,
        email,
        invitationCode: inviteCode,
        status: 'READY' as any
      }
    });
  }

  // 4. 참가자 엑셀 대량 등록 (배열 파싱 결과 수신)
  async bulkAddParticipants(roomId: string, participants: { name: string, email: string }[]) {
    const data = participants.map(p => {
      const CodeStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      return {
        roomId,
        name: p.name,
        email: p.email,
        invitationCode: `ALPACO-${CodeStr}`,
        status: 'READY' as any
      };
    });

    return this.prisma.participant.createMany({ data });
  }

  async sendInvitation(participantId: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { room: true }
    });

    if (!p) throw new Error("Participant not found");

    // 실제 환경에서는 여기서 NodeMailer나 SES 등을 연계합니다.
    const inviteLink = `http://localhost:5173/exam?code=${p.invitationCode}`;
    
    console.log(`[EMAIL SEND] To: ${p.email}`);
    console.log(`[EMAIL BODY] 안녕하세요 ${p.name}님, [${p.room.roomName}] 초대 코드: ${p.invitationCode}`);
    console.log(`[EMAIL LINK] 접속 링크: ${inviteLink}`);

    return { success: true, message: `${p.email}로 초대 링크가 전송되었습니다.` };
  }

  async sendBulkInvitations(roomId: string, template: string) {
    const participants = await this.prisma.participant.findMany({
      where: { roomId },
      include: { room: true }
    });

    for (const p of participants) {
      const inviteLink = `http://localhost:5173/exam?code=${p.invitationCode}`;
      let content = template
        .replace(/{{name}}/g, p.name)
        .replace(/{{room}}/g, p.room.roomName)
        .replace(/{{code}}/g, p.invitationCode)
        .replace(/{{link}}/g, inviteLink);

      console.log(`[BULK EMAIL SEND] To: ${p.email}`);
      console.log(`[CONTENT]\n${content}\n-------------------`);
    }

    return { success: true, count: participants.length };
  }
  // 5. 고사장별 요약 통계 조회 (대시보드 초기 화면용)
  async getRoomSummary() {
    // 자동 상태 업데이트 보강
    const now = new Date();
    // 1. 시간이 지난 진행 중 시험은 CLOSED로
    await this.prisma.examRoom.updateMany({
      where: {
        status: 'IN_PROGRESS',
        endAt: { lt: now }
      },
      data: { status: 'CLOSED' }
    });
    // 2. 시작 시각이 된 대기 중 시험은 IN_PROGRESS로
    await this.prisma.examRoom.updateMany({
      where: {
        status: 'READY',
        startAt: { lte: now }
      },
      data: { status: 'IN_PROGRESS' }
    });

    const rooms = await this.prisma.examRoom.findMany({
      include: {
        exam: { select: { title: true } },
        _count: { select: { participants: true } },
        participants: {
          select: { status: true, _count: { select: { securityLogs: true } } }
        }
      },
      orderBy: { startAt: 'desc' }
    });

    return rooms.map(r => {
      const stats = {
        total: r._count.participants,
        testing: r.participants.filter(p => p.status === 'TESTING').length,
        completed: r.participants.filter(p => p.status === 'COMPLETED').length,
        violations: r.participants.reduce((sum, p) => sum + p._count.securityLogs, 0)
      };
      return {
        id: r.id,
        roomName: r.roomName,
        examTitle: r.exam.title,
        status: r.status,
        startAt: r.startAt,
        endAt: r.endAt,
        waitingMessage: r.waitingMessage,
        waitingTitle: r.waitingTitle,
        iconType: r.iconType,
        isRequireCamera: r.isRequireCamera,
        standardTerms: r.standardTerms,
        cameraTerms: r.cameraTerms,
        stats
      };
    });
  }

  async renameCategory(oldName: string, newName: string) {
    return this.prisma.question.updateMany({
      where: { category: oldName },
      data: { category: newName }
    });
  }

  async updateRoomStatus(id: string, status: string) {
    if (status === 'IN_PROGRESS') {
      const room = await this.prisma.examRoom.findUnique({ where: { id } });
      if (room && room.status === 'READY') {
        const start = new Date();
        const end = new Date(start.getTime() + room.durationMinutes * 60 * 1000);
        return this.prisma.examRoom.update({
          where: { id },
          data: { 
            status: 'IN_PROGRESS' as any, 
            startAt: start, 
            endAt: end 
          }
        });
      }
    }
    return this.prisma.examRoom.update({
      where: { id },
      data: { status: status as any }
    });
  }

  async updateRoomWaitingScreen(id: string, data: { message: string, title: string, icon: string, standardTerms?: string, cameraTerms?: string }) {
    return this.prisma.examRoom.update({
      where: { id },
      data: { 
        waitingMessage: data.message,
        waitingTitle: data.title,
        iconType: data.icon,
        standardTerms: data.standardTerms,
        cameraTerms: data.cameraTerms
      }
    });
  }

  async updateRoom(id: string, data: { roomName?: string, durationMinutes?: number, startAt?: string, endAt?: string, isRequireCamera?: boolean }) {
    const current = await this.prisma.examRoom.findUnique({ where: { id } });
    if (!current) throw new Error("고사장 정보가 존재하지 않습니다.");
    
    // 시작된 시험은 수정 불가능
    if (current.status !== 'READY') {
      throw new Error("이미 시작된 고사장은 정보를 수정할 수 없습니다.");
    }

    const updateData: any = { ...data };
    
    // 시간 관련 로직: 종료시간(endAt)이 직접 들어왔을 때 최우선 처리
    if (data.endAt || data.startAt || data.durationMinutes !== undefined) {
      const newStart = data.startAt ? new Date(data.startAt) : current.startAt;
      
      if (data.endAt) {
        // 종료 시각이 입력된 경우 -> duration을 역산
        const newEnd = new Date(data.endAt);
        const diffMs = newEnd.getTime() - newStart.getTime();
        updateData.startAt = newStart;
        updateData.endAt = newEnd;
        updateData.durationMinutes = Math.max(1, Math.round(diffMs / 60000));
      } else {
        // 종료 시각이 없고 소요시간이나 시작시각만 바뀐 경우 -> 이전 로직(시작+소요) 유지
        const newDuration = data.durationMinutes !== undefined ? data.durationMinutes : current.durationMinutes;
        updateData.startAt = newStart;
        updateData.durationMinutes = newDuration;
        updateData.endAt = new Date(newStart.getTime() + newDuration * 60 * 1000);
      }
    }
    
    return this.prisma.examRoom.update({
      where: { id },
      data: updateData
    });
  }
}

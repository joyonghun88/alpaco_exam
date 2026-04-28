import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';
import { EmailService } from '../email/email.service';
import { PresenceService } from '../presence/presence.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private aws: AwsService,
    private email: EmailService,
    private presence: PresenceService,
  ) {}

  private escapeHtml(value: string) {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private toSimpleHtmlFromText(text: string) {
    const safe = this.escapeHtml(text);
    return `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; white-space: pre-line; line-height: 1.5;">${safe}</div>`;
  }

  private getFrontendUrl() {
    return process.env.FRONTEND_URL || 'https://main.d1jfxpi9oo1uai.amplifyapp.com';
  }
  // 媛먯궗 濡쒓렇 湲곕줉 ?占쏀떥由ы떚 (媛쒖씤?占쎈낫蹂댄샇占?以?占쎌슜)
  async logAdminAction(adminId: string, action: string, targetId?: string, details?: string, ip?: string) {
    return this.prisma.adminLog.create({
      data: { adminId, action, targetId, details, ipAddress: ip }
    });
  }

  async getDashboardData(adminId: string, roomId?: string) {
    // 媛먯궗 濡쒓렇 湲곕줉: ?占?占쎈낫???占쎄렐
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

    const onlineMap = await this.presence.getOnlineMap(participants.map((p) => p.id));

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

      // ?占쎌떆???占쎌껜 ?占쎌긽 URL 議고쉶
      const videoUrl = await this.aws.getVideoStreamUrl(p.id);

      // ?占쎈컲 濡쒓렇占??占쏀썑 10占??占쎈┰ URL 留ㅽ븨
      const securityLogs = await Promise.all(p.securityLogs.map(async log => {
        const clipUrl = await this.aws.getViolationClipUrl(p.id, log.capturedAt);
        return {
          ...log,
          id: log.id.toString(),
          clipUrl // ?占쏀썑 10占??占쎌긽 二쇱냼
        };
      }));

      return {
        id: p.id,
        name: p.name,
        email: p.email,
        roomName: p.room.roomName,
        status: p.status,
        isOnline: onlineMap[p.id] ?? false,
        startedAt: p.startedAt,
        violationCount: p._count.securityLogs,
        inviteCode: p.invitationCode,
        totalScore,
        questionResults,
        videoUrl, // ?占쎌껜 ?占쎌떆蹂닿린 留곹겕
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

  // 1. 臾몄젣 ?占??議고쉶
  async getQuestionPool() {
    return this.prisma.question.findMany({
      include: { parent: true },
      orderBy: { createdAt: 'desc' } as any
    });
  }

  // 2. 臾몄젣 ?占??臾명빆 異뷂옙?
  async addQuestionToPool(category: string, type: string, content: any, correctAnswer: any, parentId?: string) {
    return this.prisma.question.create({
      data: { category, type: type as any, content, correctAnswer, parentId } as any
    });
  }

  // 2-1. 臾몄젣 ?占??臾명빆 ?占쎌젙
  async updateQuestion(id: string, category: string, type: string, content: any, correctAnswer: any, parentId?: string) {
    return this.prisma.question.update({
      where: { id },
      data: { category, type: type as any, content, correctAnswer, parentId } as any
    });
  }

  // 2-2. 臾몄젣 ?占??臾명빆 ??占쏙옙
  async deleteQuestion(id: string) {
    return this.prisma.question.delete({ where: { id } });
  }

  // 2-2. 臾몄젣 ?占???占쎈줉
  async bulkAddQuestions(questions: { category: string, type: string, content: any, correctAnswer: any }[]) {
    return this.prisma.question.createMany({
       data: questions.map(q => ({ ...q, type: q.type as any })) as any
    });
  }

  // 3. ?占쏀뿕吏??臾몄젣 ?占쎈줉
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
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000); // 30占??占쎌쑀 ?占쎄굅, ?占쎄퇋 ?占쎄컙?占쎈줈 ?占쎌젙
    
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
        waitingMessage: '?占쏀뿕 ?占쎌옉 ?占쎌엯?占쎈떎. ?占쎌떆占??占쎄린??二쇱꽭??',
        standardTerms: standardTerms || '?占쏀뿕 蹂몄씤 ?占쎌씤 占?遺?占쏀뻾??諛⑼옙?占??占쏀빐 ?占쎈챸, ?占쎈찓???占쎈낫占??占쎌쭛?占쎈땲??',
        cameraTerms: cameraTerms || '?占쎌떆占?媛먮룆???占쏀빐 ?占쏀뿕 占??占쏀뿕?占쎌쓽 ?占쎈㈃ 占?二쇽옙? ?占쎄꼍 ?占쎌긽???占쎌쭛 占??占?占쏀빀?占쎈떎.'
      }
    });
  }

  async deleteRoom(adminId: string, id: string) {
    // 沅뚰븳 泥댄겕: 占???占쏙옙??SUPER_ADMIN占?媛??(?占쎌떆)
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (admin?.role !== 'SUPER_ADMIN') throw new Error("占???占쏙옙 沅뚰븳???占쎌뒿?占쎈떎.");

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
    if (!room) throw new Error("?占쏀뿕?占쎌씠 ?占쎌뒿?占쎈떎.");

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

  // 4. 李몌옙????占쏙옙? ?占???占쎈줉 (諛곗뿴 ?占쎌떛 寃곌낵 ?占쎌떊)
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
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { room: true }
    });

    if (!participant) throw new Error('Participant not found');

    const frontendUrl = this.getFrontendUrl();
    const inviteLink = `${frontendUrl}/exam?code=${participant.invitationCode}`;

    const subject = `[Alpaco Exam] ${participant.room.roomName} 시험 초대 안내`;
    const html = this.email.getInvitationTemplate(
      participant.name,
      participant.room.roomName,
      participant.invitationCode,
      inviteLink,
    );

    const text = `안녕하세요 ${participant.name}님,\n\n[${participant.room.roomName}] 시험 초대 안내입니다.\n\n- 초대 코드: ${participant.invitationCode}\n- 접속 링크: ${inviteLink}\n`;

    try {
      await this.email.sendEmail(participant.email, subject, html);
      return { success: true, message: `${participant.email}로 초대 링크가 전송되었습니다.` };
    } catch (e) {
      const errorMessage = (e as any)?.message || String(e);
      return {
        success: false,
        message: `이메일 발송에 실패했습니다. (SES 권한/발신자 설정 확인 필요)\n- 초대코드: ${participant.invitationCode}\n- 링크: ${inviteLink}\n- 에러: ${errorMessage}`,
        inviteCode: participant.invitationCode,
        inviteLink,
      };
    }
  }

  async getParticipantGrading(adminId: string, participantId: string) {
    await this.logAdminAction(adminId, 'PARTICIPANT_GRADING_VIEW', participantId);

    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { room: { include: { exam: true } } },
    });
    if (!participant) throw new BadRequestException('participant not found');

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: participant.room.examId },
      orderBy: { orderNum: 'asc' },
      include: { question: { include: { parent: true } } },
    });

    const submissions = await this.prisma.submission.findMany({
      where: { participantId },
      include: { question: true },
    });

    const submissionsByQuestionId = new Map(submissions.map((s) => [s.questionId, s]));

    const items = examQuestions.map((eq) => {
      const q: any = eq.question;
      const sub = submissionsByQuestionId.get(q.id);

      const content = { ...(q.content || {}) };
      if (q.parentId && q.parent && !content.passage) {
        content.passage = q.parent.content?.passage;
      }

      return {
        questionId: q.id,
        orderNum: eq.orderNum,
        point: eq.point,
        type: q.type,
        content,
        correctAnswer: q.correctAnswer ?? null,
        submission: sub
          ? {
              answerContent: sub.answerContent,
              earnedPoint: sub.earnedPoint ?? 0,
              gradingStatus: sub.gradingStatus,
            }
          : {
              answerContent: { answer: null },
              earnedPoint: 0,
              gradingStatus: 'PENDING',
            },
      };
    });

    return {
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        status: participant.status,
        roomId: participant.roomId,
        roomName: participant.room.roomName,
        examTitle: participant.room.exam.title,
      },
      questions: items,
    };
  }

  async gradeParticipantAnswer(
    adminId: string,
    participantId: string,
    questionId: string,
    earnedPoint: number,
  ) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      include: { room: true },
    });
    if (!participant) throw new BadRequestException('participant not found');
    if (participant.status !== 'COMPLETED') {
      throw new BadRequestException('participant is not completed');
    }

    const eq = await this.prisma.examQuestion.findFirst({
      where: { examId: participant.room.examId, questionId },
      select: { point: true, orderNum: true },
    });
    if (!eq) throw new BadRequestException('question not found in exam');

    const point = eq.point;
    const value = Number.isFinite(earnedPoint) ? Math.round(earnedPoint) : 0;
    if (value < 0 || value > point) {
      throw new BadRequestException(`earnedPoint must be between 0 and ${point}`);
    }

    await this.prisma.submission.update({
      where: { participantId_questionId: { participantId, questionId } },
      data: {
        earnedPoint: value,
        gradingStatus: 'MANUAL_GRADED' as any,
        gradedById: adminId,
      },
    });

    await this.logAdminAction(adminId, 'PARTICIPANT_GRADED', participantId, `Q=${questionId} earnedPoint=${value}`);

    return { success: true, questionId, earnedPoint: value };
  }

  async sendSelectedInvitations(participantIds: string[], template: string) {
    const ids = (participantIds || []).map((id) => (id || '').trim()).filter(Boolean);
    if (ids.length === 0) throw new BadRequestException('participantIds is required');
    if (ids.length > 200) throw new BadRequestException('participantIds is too large (max 200)');

    const participants = await this.prisma.participant.findMany({
      where: { id: { in: ids } },
      include: { room: true }
    });

    const templateText = (template ?? '').trim();
    const results: any[] = [];

    for (const p of participants) {
      const frontendUrl = this.getFrontendUrl();
      const inviteLink = `${frontendUrl}/exam?code=${p.invitationCode}`;

      const subject = `[Alpaco Exam] ${p.room.roomName} 시험 초대 안내`;
      const contentText = templateText
        ? templateText
            .replace(/{{name}}/g, p.name)
            .replace(/{{room}}/g, p.room.roomName)
            .replace(/{{code}}/g, p.invitationCode)
            .replace(/{{link}}/g, inviteLink)
        : `占싫놂옙占싹쇽옙占쏙옙 ${p.name}占쏙옙,\n\n[${p.room.roomName}] 占쏙옙占쏙옙 占십댐옙 占싫놂옙占쌉니댐옙.\n\n- 占십댐옙 占쌘듸옙: ${p.invitationCode}\n- 占쏙옙占쏙옙 占쏙옙크: ${inviteLink}\n`;

      const html = templateText
        ? this.toSimpleHtmlFromText(contentText)
        : this.email.getInvitationTemplate(p.name, p.room.roomName, p.invitationCode, inviteLink);

      try {
        await this.email.sendEmail(p.email, subject, html);
        results.push({ participantId: p.id, email: p.email, status: 'SUCCESS' });
      } catch (e) {
        results.push({ participantId: p.id, email: p.email, status: 'FAILED', error: e?.message || String(e) });
      }
    }

    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;

    return {
      success: failedCount === 0,
      count: participants.length,
      successCount,
      failedCount,
      results,
    };
  }

  async sendBulkInvitations(roomId: string, template: string) {
    const participants = await this.prisma.participant.findMany({
      where: { roomId },
      include: { room: true }
    });

    const results: any[] = [];
    for (const p of participants) {
      const frontendUrl = this.getFrontendUrl();
      const inviteLink = `${frontendUrl}/exam?code=${p.invitationCode}`;
      
      let subject = `[Alpaco Exam] ${p.room.roomName} 시험 초대 안내`;
      let content = template
        .replace(/{{name}}/g, p.name)
        .replace(/{{room}}/g, p.room.roomName)
        .replace(/{{code}}/g, p.invitationCode)
        .replace(/{{link}}/g, inviteLink);

      try {
        const html = this.toSimpleHtmlFromText(content);
        await this.email.sendEmail(p.email, subject, html);
        results.push({ email: p.email, status: 'SUCCESS' });
      } catch (e) {
        results.push({ email: p.email, status: 'FAILED', error: e.message });
      }
    }

    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const successCount = results.filter((r) => r.status === 'SUCCESS').length;

    return {
      success: failedCount === 0,
      count: participants.length,
      successCount,
      failedCount,
      results,
    };
  }
  // 5. 怨좎궗?占쎈퀎 ?占쎌빟 ?占쎄퀎 議고쉶 (?占?占쎈낫??珥덇린 ?占쎈㈃??
  async getRoomSummary() {
    // ?占쎈룞 ?占쏀깭 ?占쎈뜲?占쏀듃 蹂닿컯
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

  async moveQuestionsToCategory(questionIds: string[], targetCategory: string) {
    const ids = (questionIds || []).map((id) => (id || '').trim()).filter(Boolean);
    const category = (targetCategory || '').trim();
    if (ids.length === 0) throw new BadRequestException('questionIds is required');
    if (!category) throw new BadRequestException('targetCategory is required');

    const result = await this.prisma.question.updateMany({
      where: { id: { in: ids } },
      data: { category },
    });

    return { moved: result.count };
  }

  // Category is a string field on Question; deleting a category deletes all questions in that category.
  // Also deletes any questions linked (via parentId) to questions in that category to avoid FK issues.
  async deleteCategory(category: string) {
    const name = (category || '').trim();
    if (!name) throw new BadRequestException('category is required');

    const ids = await this.prisma.question.findMany({
      where: { category: name },
      select: { id: true },
    });

    if (ids.length === 0) return { deleted: 0 };

    const idList = ids.map(i => i.id);

    const result = await this.prisma.$transaction(async (tx) => {
      // Delete descendants first (even if they are in other categories).
      await tx.question.deleteMany({ where: { parentId: { in: idList } } });
      return tx.question.deleteMany({ where: { category: name } });
    });

    return { deleted: result.count };
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
    if (!current) throw new Error("怨좎궗???占쎈낫媛 議댁옱?占쏙옙? ?占쎌뒿?占쎈떎.");
    
    // Room must be editable only before starting.
    if (current.status !== 'READY') {
      throw new Error("?占쏙옙? ?占쎌옉??怨좎궗?占쏙옙? ?占쎈낫占??占쎌젙?????占쎌뒿?占쎈떎.");
    }

    const updateData: any = { ...data };
    
    // ?占쎄컙 愿??濡쒖쭅: 醫낅즺?占쎄컙(endAt)??吏곸젒 ?占쎌뼱?占쎌쓣 ??理쒖슦??泥섎━
    if (data.endAt || data.startAt || data.durationMinutes !== undefined) {
      const newStart = data.startAt ? new Date(data.startAt) : current.startAt;
      
      if (data.endAt) {
        // 醫낅즺 ?占쎄컖???占쎈젰??寃쎌슦 -> duration????占쏙옙
        const newEnd = new Date(data.endAt);
        const diffMs = newEnd.getTime() - newStart.getTime();
        updateData.startAt = newStart;
        updateData.endAt = newEnd;
        updateData.durationMinutes = Math.max(1, Math.round(diffMs / 60000));
      } else {
        // 醫낅즺 ?占쎄컖???占쎄퀬 ?占쎌슂?占쎄컙?占쎈굹 ?占쎌옉?占쎄컖占?諛뷂옙?寃쎌슦 -> ?占쎌쟾 濡쒖쭅(?占쎌옉+?占쎌슂) ?占쏙옙?
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

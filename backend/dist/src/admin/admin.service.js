"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const aws_service_1 = require("../aws/aws.service");
let AdminService = class AdminService {
    prisma;
    aws;
    constructor(prisma, aws) {
        this.prisma = prisma;
        this.aws = aws;
    }
    async logAdminAction(adminId, action, targetId, details, ip) {
        return this.prisma.adminLog.create({
            data: { adminId, action, targetId, details, ipAddress: ip }
        });
    }
    async getDashboardData(adminId, roomId) {
        await this.logAdminAction(adminId, 'DASHBOARD_VIEW', roomId, `RoomID: ${roomId || 'ALL'}`);
        const where = {};
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
        const results = await Promise.all(participants.map(async (p) => {
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
            const videoUrl = await this.aws.getVideoStreamUrl(p.id);
            const securityLogs = await Promise.all(p.securityLogs.map(async (log) => {
                const clipUrl = await this.aws.getViolationClipUrl(p.id, log.capturedAt);
                return {
                    ...log,
                    id: log.id.toString(),
                    clipUrl
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
                videoUrl,
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
            orderBy: { createdAt: 'desc' }
        });
    }
    async getExamDetail(id) {
        return this.prisma.exam.findUnique({
            where: { id },
            include: {
                questions: {
                    include: { question: true },
                    orderBy: { orderNum: 'asc' }
                }
            }
        });
    }
    async createExam(title, description) {
        return this.prisma.exam.create({
            data: { title, description }
        });
    }
    async deleteExam(id) {
        return this.prisma.exam.delete({ where: { id } });
    }
    async getQuestionPool() {
        return this.prisma.question.findMany({
            include: { parent: true },
            orderBy: { createdAt: 'desc' }
        });
    }
    async addQuestionToPool(category, type, content, correctAnswer, parentId) {
        return this.prisma.question.create({
            data: { category, type: type, content, correctAnswer, parentId }
        });
    }
    async updateQuestion(id, category, type, content, correctAnswer, parentId) {
        return this.prisma.question.update({
            where: { id },
            data: { category, type: type, content, correctAnswer, parentId }
        });
    }
    async deleteQuestion(id) {
        return this.prisma.question.delete({ where: { id } });
    }
    async bulkAddQuestions(questions) {
        return this.prisma.question.createMany({
            data: questions.map(q => ({ ...q, type: q.type }))
        });
    }
    async assignQuestionToExam(examId, questionId, orderNum, point) {
        return this.prisma.examQuestion.upsert({
            where: { examId_questionId: { examId, questionId } },
            create: { examId, questionId, orderNum, point },
            update: { orderNum, point }
        });
    }
    async removeQuestionFromExam(examId, questionId) {
        return this.prisma.examQuestion.delete({
            where: { examId_questionId: { examId, questionId } }
        });
    }
    async updateExamQuestion(examId, questionId, orderNum, point) {
        return this.prisma.examQuestion.update({
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
    async createRoom(examId, roomName, durationMinutes, startAt, isRequireCamera = false, standardTerms, cameraTerms) {
        const startDate = startAt ? new Date(startAt) : new Date();
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
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
    async deleteRoom(adminId, id) {
        const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
        if (admin?.role !== 'SUPER_ADMIN')
            throw new Error("방 삭제 권한이 없습니다.");
        await this.logAdminAction(adminId, 'ROOM_DELETE', id);
        return this.prisma.examRoom.delete({ where: { id } });
    }
    async getParticipants(adminId) {
        await this.logAdminAction(adminId, 'PARTICIPANT_LIST_VIEW');
        return this.prisma.participant.findMany({
            include: { room: true },
            orderBy: { name: 'asc' }
        });
    }
    async deleteParticipant(adminId, id) {
        await this.logAdminAction(adminId, 'PARTICIPANT_DELETE', id);
        return this.prisma.participant.delete({ where: { id } });
    }
    async addParticipant(name, email, roomId) {
        let room;
        if (roomId) {
            room = await this.prisma.examRoom.findUnique({ where: { id: roomId } });
        }
        else {
            room = await this.prisma.examRoom.findFirst();
        }
        if (!room)
            throw new Error("시험장이 없습니다.");
        const CodeStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const inviteCode = `ALPACO-${CodeStr}`;
        return this.prisma.participant.create({
            data: {
                roomId: room.id,
                name,
                email,
                invitationCode: inviteCode,
                status: 'READY'
            }
        });
    }
    async bulkAddParticipants(roomId, participants) {
        const data = participants.map(p => {
            const CodeStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            return {
                roomId,
                name: p.name,
                email: p.email,
                invitationCode: `ALPACO-${CodeStr}`,
                status: 'READY'
            };
        });
        return this.prisma.participant.createMany({ data });
    }
    async sendInvitation(participantId) {
        const p = await this.prisma.participant.findUnique({
            where: { id: participantId },
            include: { room: true }
        });
        if (!p)
            throw new Error("Participant not found");
        const inviteLink = `http://localhost:5173/exam?code=${p.invitationCode}`;
        console.log(`[EMAIL SEND] To: ${p.email}`);
        console.log(`[EMAIL BODY] 안녕하세요 ${p.name}님, [${p.room.roomName}] 초대 코드: ${p.invitationCode}`);
        console.log(`[EMAIL LINK] 접속 링크: ${inviteLink}`);
        return { success: true, message: `${p.email}로 초대 링크가 전송되었습니다.` };
    }
    async sendBulkInvitations(roomId, template) {
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
    async getRoomSummary() {
        const now = new Date();
        await this.prisma.examRoom.updateMany({
            where: {
                status: 'IN_PROGRESS',
                endAt: { lt: now }
            },
            data: { status: 'CLOSED' }
        });
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
    async renameCategory(oldName, newName) {
        return this.prisma.question.updateMany({
            where: { category: oldName },
            data: { category: newName }
        });
    }
    async updateRoomStatus(id, status) {
        if (status === 'IN_PROGRESS') {
            const room = await this.prisma.examRoom.findUnique({ where: { id } });
            if (room && room.status === 'READY') {
                const start = new Date();
                const end = new Date(start.getTime() + room.durationMinutes * 60 * 1000);
                return this.prisma.examRoom.update({
                    where: { id },
                    data: {
                        status: 'IN_PROGRESS',
                        startAt: start,
                        endAt: end
                    }
                });
            }
        }
        return this.prisma.examRoom.update({
            where: { id },
            data: { status: status }
        });
    }
    async updateRoomWaitingScreen(id, data) {
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
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aws_service_1.AwsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map
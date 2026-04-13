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
exports.ExamService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const aws_service_1 = require("../aws/aws.service");
let ExamService = class ExamService {
    prisma;
    aws;
    constructor(prisma, aws) {
        this.prisma = prisma;
        this.aws = aws;
    }
    async getQuestions(participantId) {
        const p = await this.prisma.participant.findUnique({
            where: { id: participantId },
            include: { room: true }
        });
        if (!p)
            throw new Error("Participant not found");
        const now = new Date();
        if (p.room.status !== 'IN_PROGRESS' || now < p.room.startAt || now > p.room.endAt) {
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
            const q = eq.question;
            const content = { ...q.content };
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
    async saveProgress(participantId, questionId, answer) {
        const p = await this.prisma.participant.findUnique({ where: { id: participantId }, include: { room: true } });
        if (!p || p.status !== 'TESTING')
            return;
        const now = new Date();
        if (now > p.room.endAt)
            return;
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
    async submitAnswers(participantId, answers) {
        const p = await this.prisma.participant.findUnique({
            where: { id: participantId }, include: { room: true }
        });
        if (!p)
            throw new Error("Participant not found");
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
            const storedCorrect = q.correctAnswer;
            let actualCorrect = null;
            if (Array.isArray(storedCorrect)) {
                actualCorrect = storedCorrect[0];
            }
            else if (typeof storedCorrect === 'object' && storedCorrect.answer) {
                actualCorrect = storedCorrect.answer[0];
            }
            else {
                actualCorrect = storedCorrect;
            }
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
    async getKvsCredentials(participantId) {
        const p = await this.prisma.participant.findUnique({
            where: { id: participantId }
        });
        if (!p)
            throw new Error("Participant not found");
        const channel = await this.aws.getOrCreateSignalingChannel(participantId);
        if (!channel) {
            throw new Error("KVS Signaling Channel을 찾거나 생성할 수 없습니다.");
        }
        const credentials = await this.aws.getTemporaryCredentials();
        return {
            channelArn: channel.ChannelARN,
            channelName: channel.ChannelName,
            ...credentials
        };
    }
};
exports.ExamService = ExamService;
exports.ExamService = ExamService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aws_service_1.AwsService])
], ExamService);
//# sourceMappingURL=exam.service.js.map
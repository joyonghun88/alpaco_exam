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
const redis_service_1 = require("../redis/redis.service");
const client_1 = require("@prisma/client");
let ExamService = class ExamService {
    prisma;
    aws;
    redis;
    constructor(prisma, aws, redis) {
        this.prisma = prisma;
        this.aws = aws;
        this.redis = redis;
    }
    async getQuestions(participantId) {
        let p = await this.redis.getParticipant(participantId);
        if (!p) {
            p = await this.prisma.participant.findUnique({
                where: { id: participantId },
                include: { room: true }
            });
            if (p)
                await this.redis.cacheParticipant(participantId, p);
        }
        if (!p)
            throw new common_1.NotFoundException('응시자 정보를 찾을 수 없습니다.');
        const now = new Date();
        const roomStart = new Date(p.room.startAt);
        const roomEnd = new Date(p.room.endAt);
        const isActiveStatus = p.room.status === 'READY' || p.room.status === 'IN_PROGRESS';
        if (!isActiveStatus || now < roomStart || now > roomEnd) {
            throw new common_1.ForbiddenException('현재는 시험 문제를 조회할 수 있는 시간이 아닙니다.');
        }
        if (p.status === 'COMPLETED' || p.status === 'DISQUALIFIED') {
            throw new common_1.ForbiddenException('이미 제출 완료되었거나 실격된 응시자입니다.');
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
        let p = await this.redis.getParticipant(participantId);
        if (!p) {
            p = await this.prisma.participant.findUnique({
                where: { id: participantId },
                include: { room: true }
            });
            if (p)
                await this.redis.cacheParticipant(participantId, p);
        }
        if (!p || p.status !== 'TESTING')
            return;
        const now = new Date();
        const roomEnd = new Date(p.room.endAt);
        if (now > roomEnd)
            return;
        await this.redis.setAnswer(participantId, questionId, answer);
        return { success: true };
    }
    async submitAnswers(participantId, manualAnswers) {
        const p = await this.prisma.participant.findUnique({
            where: { id: participantId }, include: { room: true }
        });
        if (!p)
            throw new common_1.NotFoundException('응시자 정보를 찾을 수 없습니다.');
        const now = new Date();
        if (p.room.status !== 'IN_PROGRESS' || now > p.room.endAt) {
            throw new common_1.ForbiddenException('시험 종료 후에는 답안을 제출할 수 없습니다.');
        }
        if (p.status !== 'TESTING') {
            throw new common_1.ForbiddenException('현재 응시 중 상태가 아닙니다.');
        }
        const redisAnswers = await this.redis.getAnswers(participantId);
        const finalAnswers = { ...redisAnswers, ...manualAnswers };
        const examQuestions = await this.prisma.examQuestion.findMany({
            where: { examId: p.room.examId },
            include: { question: true }
        });
        let totalScore = 0;
        const submissionsData = [];
        const normalizeText = (value) => String(value ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
        for (const eq of examQuestions) {
            const q = eq.question;
            const userAns = finalAnswers[q.id];
            let earnedPoint = 0;
            let gradingStatus = client_1.GradingStatus.PENDING;
            const storedCorrect = q.correctAnswer;
            if (q.type === 'MULTIPLE_CHOICE') {
                gradingStatus = client_1.GradingStatus.AUTO_GRADED;
                const correctList = Array.isArray(storedCorrect)
                    ? storedCorrect.map((v) => String(v)).sort()
                    : storedCorrect !== undefined && storedCorrect !== null
                        ? [String(storedCorrect)]
                        : [];
                const userList = Array.isArray(userAns)
                    ? userAns.map((v) => String(v)).sort()
                    : userAns !== undefined && userAns !== null
                        ? [String(userAns)]
                        : [];
                const isCorrect = userList.length > 0 && userList.join(',') === correctList.join(',');
                earnedPoint = isCorrect ? eq.point : 0;
            }
            else if (q.type === 'FILL_IN_THE_BLANK') {
                gradingStatus = client_1.GradingStatus.AUTO_GRADED;
                const correctRaw = Array.isArray(storedCorrect)
                    ? storedCorrect
                    : (storedCorrect && typeof storedCorrect === 'object' && storedCorrect.answer)
                        ? storedCorrect.answer
                        : storedCorrect !== undefined && storedCorrect !== null
                            ? [storedCorrect]
                            : [];
                const correctVariants = (correctRaw || []).map(normalizeText).filter(Boolean);
                const userValue = normalizeText(userAns);
                const isCorrect = !!userValue && correctVariants.includes(userValue);
                earnedPoint = isCorrect ? eq.point : 0;
            }
            else if (q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') {
                gradingStatus = client_1.GradingStatus.PENDING;
                earnedPoint = 0;
            }
            else {
                gradingStatus = client_1.GradingStatus.PENDING;
                earnedPoint = 0;
            }
            if (gradingStatus === client_1.GradingStatus.AUTO_GRADED)
                totalScore += earnedPoint;
            submissionsData.push({
                participantId,
                questionId: q.id,
                answerContent: { answer: userAns ?? null },
                earnedPoint,
                gradingStatus
            });
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.submission.deleteMany({ where: { participantId } });
            await tx.submission.createMany({ data: submissionsData });
            await tx.participant.update({
                where: { id: participantId },
                data: { status: 'COMPLETED', submittedAt: new Date() }
            });
        });
        await this.redis.clearAnswers(participantId);
        await this.redis.client.del(`participant:${participantId}`);
        return { success: true, score: totalScore };
    }
    async getKvsCredentials(participantId, role = 'VIEWER') {
        let p = await this.redis.getParticipant(participantId);
        if (!p) {
            p = await this.prisma.participant.findUnique({
                where: { id: participantId }
            });
            if (p)
                await this.redis.cacheParticipant(participantId, p);
        }
        if (!p)
            throw new common_1.NotFoundException('응시자 정보를 찾을 수 없습니다.');
        const channel = await this.aws.getOrCreateSignalingChannel(participantId);
        if (!channel) {
            throw new common_1.BadRequestException('KVS Signaling Channel을 찾거나 생성할 수 없습니다.');
        }
        console.log('[ExamService] KVS Channel Info:', JSON.stringify(channel, null, 2));
        const credentials = await this.aws.getTemporaryCredentials();
        const iceServers = await this.aws.getIceServers(channel.ChannelARN);
        const signalingEndpoint = await this.aws.getSignalingEndpoint(channel.ChannelARN, role);
        console.log(`[ExamService] Signaling Endpoint for ${role}:`, signalingEndpoint);
        return {
            channelArn: channel.ChannelARN,
            channelName: channel.ChannelName,
            signalingEndpoint,
            iceServers,
            ...credentials
        };
    }
};
exports.ExamService = ExamService;
exports.ExamService = ExamService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        aws_service_1.AwsService,
        redis_service_1.RedisService])
], ExamService);
//# sourceMappingURL=exam.service.js.map
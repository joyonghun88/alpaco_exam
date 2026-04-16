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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async verifyAndStartExam(inviteCode, agreedTerms) {
        const participant = await this.prisma.participant.findUnique({
            where: { invitationCode: inviteCode },
            include: { room: { include: { exam: true } } }
        });
        if (!participant) {
            throw new common_1.HttpException('유효하지 않은 초대코드입니다. 확인 후 다시 입력해 주세요.', common_1.HttpStatus.UNAUTHORIZED);
        }
        const now = new Date();
        const room = participant.room;
        if (participant.status === 'COMPLETED') {
            throw new common_1.HttpException('이미 시험을 제출하셨습니다. 재입장이 불가능합니다.', common_1.HttpStatus.FORBIDDEN);
        }
        if (room.status === 'CLOSED') {
            throw new common_1.HttpException('이미 종료된 고사장입니다. 입장이 불가능합니다.', common_1.HttpStatus.FORBIDDEN);
        }
        if (now > room.endAt) {
            throw new common_1.HttpException('시험 응시 시간이 종료되었습니다.', common_1.HttpStatus.FORBIDDEN);
        }
        if (room.status === 'READY') {
            if (now < room.startAt) {
                throw new common_1.HttpException({
                    type: 'NOT_STARTED_YET',
                    message: '시험이 아직 시작되지 않았습니다.',
                    startTime: room.startAt,
                    waitingMessage: room.waitingMessage || '시험 시작 시간까지 잠시 기다려 주세요.',
                    waitingTitle: room.waitingTitle || 'AI 평가 샌드박스',
                    iconType: room.iconType || 'Activity',
                    isRequireCamera: room.isRequireCamera,
                    standardTerms: room.standardTerms,
                    cameraTerms: room.cameraTerms
                }, common_1.HttpStatus.FORBIDDEN);
            }
            else {
                await this.prisma.examRoom.update({
                    where: { id: room.id },
                    data: { status: 'IN_PROGRESS' }
                });
            }
        }
        if (participant.status === 'READY') {
            await this.prisma.participant.update({
                where: { id: participant.id },
                data: {
                    status: 'TESTING',
                    startedAt: new Date(),
                    termsAgreedAt: agreedTerms ? new Date() : null
                }
            });
        }
        else if (agreedTerms && !participant.termsAgreedAt) {
            await this.prisma.participant.update({
                where: { id: participant.id },
                data: { termsAgreedAt: new Date() }
            });
        }
        const updated = await this.prisma.participant.findUnique({
            where: { id: participant.id },
            include: { room: { include: { exam: true } } }
        });
        return {
            message: '인증 성공 및 샌드박스 입장 승인',
            participantId: updated.id,
            name: updated.name,
            examRoom: {
                id: updated.room.id,
                title: updated.room.exam.title,
                durationMinutes: updated.room.durationMinutes,
                isShuffleQuestions: updated.room.isShuffleQuestions,
                isRequireCamera: updated.room.isRequireCamera,
                standardTerms: updated.room.standardTerms,
                cameraTerms: updated.room.cameraTerms
            },
            startedAt: updated.startedAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
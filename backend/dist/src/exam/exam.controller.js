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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamController = void 0;
const common_1 = require("@nestjs/common");
const exam_service_1 = require("./exam.service");
let ExamController = class ExamController {
    exam;
    constructor(exam) {
        this.exam = exam;
    }
    async getQuestions(id) {
        return this.exam.getQuestions(id);
    }
    async submitExam(id, body) {
        return this.exam.submitAnswers(id, body.answers);
    }
    async saveProgress(id, body) {
        return this.exam.saveProgress(id, body.questionId, body.answer);
    }
    async getKvsCredentials(id, role = 'VIEWER') {
        return this.exam.getKvsCredentials(id, role);
    }
};
exports.ExamController = ExamController;
__decorate([
    (0, common_1.Get)(':id/questions'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getQuestions", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "submitExam", null);
__decorate([
    (0, common_1.Post)(':id/progress'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "saveProgress", null);
__decorate([
    (0, common_1.Get)(':id/kvs-credentials'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ExamController.prototype, "getKvsCredentials", null);
exports.ExamController = ExamController = __decorate([
    (0, common_1.Controller)('exam'),
    __metadata("design:paramtypes", [exam_service_1.ExamService])
], ExamController);
//# sourceMappingURL=exam.controller.js.map
import { Controller, Get, Post, Body, Param, Query, Delete, Put, Patch, UseInterceptors, UploadedFile, UseGuards, UnauthorizedException, Req, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('admin')
export class AdminController {
  constructor(
    private admin: AdminService,
    private adminAuth: AdminAuthService
  ) {}

  // Auth Routes (Public)
  @Post('auth/login')
  async login(@Body() body: any, @Req() req: any) {
    const admin = await this.adminAuth.validateAdmin(body.username, body.password);
    if (!admin) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.adminAuth.login(admin, ip as string);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/register')
  async register(@Body() body: any, @Req() req: any) {
    return this.adminAuth.register(body, req.user.userId);
  }

  // Management Routes (Protected)
  @UseGuards(JwtAuthGuard)
  @Get('auth/admins')
  async getAdmins() {
    return this.adminAuth.getAllAdmins();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('auth/admins/:id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: string, @Req() req: any) {
    return this.adminAuth.updateRole(id, role as any, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/logs')
  async getLogs(@Query('adminId') adminId?: string) {
    return this.adminAuth.getLogs(adminId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard/summary')
  async getDashboardSummary() {
    return this.admin.getRoomSummary();
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboard(@Query('roomId') roomId: string, @Req() req: any) {
    const participants = await this.admin.getDashboardData(req.user.userId, roomId);
    const stats = {
      total: participants.length,
      testing: participants.filter(p => p.status === 'TESTING').length,
      completed: participants.filter(p => p.status === 'COMPLETED').length,
      totalViolations: participants.reduce((sum, p) => sum + p.violationCount, 0),
    };
    return { stats, participants };
  }

  @UseGuards(JwtAuthGuard)
  @Post('participants/:id/log-view')
  async logView(@Param('id') participantId: string, @Body('action') action: string, @Req() req: any) {
    return this.admin.logAdminAction(req.user.userId, action, participantId, 'Accessed video stream/clip');
  }

  @UseGuards(JwtAuthGuard)
  @Get('exams')
  async getExams() {
    return this.admin.getExams();
  }

  @UseGuards(JwtAuthGuard)
  @Get('exams/:id')
  async getExamDetail(@Param('id') id: string) {
    return this.admin.getExamDetail(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams')
  async createExam(@Body() body: { title: string, description: string }) {
    return this.admin.createExam(body.title, body.description);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('exams/:id')
  async deleteExam(@Param('id') id: string) {
    return this.admin.deleteExam(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('questions/pool')
  async getQuestionPool() {
    return this.admin.getQuestionPool();
  }

  @UseGuards(JwtAuthGuard)
  @Post('questions/pool')
  async addQuestionToPool(@Body() body: { category: string, type: string, content: any, correctAnswer: any, parentId?: string }) {
    return this.admin.addQuestionToPool(body.category, body.type, body.content, body.correctAnswer, body.parentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('questions/pool/:id')
  async deleteQuestion(@Param('id') id: string) {
    return this.admin.deleteQuestion(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('questions/pool/:id')
  async updateQuestion(
    @Param('id') id: string,
    @Body() body: { category: string, type: string, content: any, correctAnswer: any, parentId?: string }
  ) {
    return this.admin.updateQuestion(id, body.category, body.type, body.content, body.correctAnswer, body.parentId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('questions/pool/bulk')
  async bulkAddQuestions(@Body() body: { questions: any[] }) {
    return this.admin.bulkAddQuestions(body.questions);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:id/assign')
  async assignQuestion(@Param('id') examId: string, @Body() body: { questionId: string, orderNum: number, point: number }) {
    return this.admin.assignQuestionToExam(examId, body.questionId, body.orderNum, body.point);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('exams/:examId/questions/:questionId')
  async removeQuestion(@Param('examId') examId: string, @Param('questionId') questionId: string) {
    return this.admin.removeQuestionFromExam(examId, questionId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('exams/:examId/questions/:questionId')
  async updateExamQuestion(
    @Param('examId') examId: string, 
    @Param('questionId') questionId: string,
    @Body() body: { orderNum: number, point: number }
  ) {
    return this.admin.updateExamQuestion(examId, questionId, body.orderNum, body.point);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  async getRooms() {
    return this.admin.getRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms')
  async createRoom(@Body() body: { 
    examId: string, 
    roomName: string, 
    durationMinutes: number, 
    startAt?: string, 
    isRequireCamera?: boolean,
    standardTerms?: string,
    cameraTerms?: string
  }) {
    return this.admin.createRoom(
      body.examId, 
      body.roomName, 
      body.durationMinutes, 
      body.startAt, 
      body.isRequireCamera,
      body.standardTerms,
      body.cameraTerms
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('rooms/:id/status')
  async updateRoomStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.admin.updateRoomStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('rooms/:id/waiting-message')
  async updateWaitingScreen(@Param('id') id: string, @Body() body: { message: string, title: string, icon: string, standardTerms?: string, cameraTerms?: string }) {
    return this.admin.updateRoomWaitingScreen(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('rooms/:id')
  async deleteRoom(@Param('id') id: string, @Req() req: any) {
    return this.admin.deleteRoom(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('participants')
  async getParticipants(@Req() req: any) {
    return this.admin.getParticipants(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('participants')
  async addParticipant(@Body() body: { name: string, email: string, roomId?: string }) {
    return this.admin.addParticipant(body.name, body.email, body.roomId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('participants/:id')
  async deleteParticipant(@Param('id') id: string, @Req() req: any) {
    return this.admin.deleteParticipant(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('participants/:id/invite')
  async sendInvitation(@Param('id') id: string) {
    return this.admin.sendInvitation(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('participants/bulk')
  async bulkAddParticipants(@Body() body: { roomId: string, participants: { name: string, email: string }[] }) {
    return this.admin.bulkAddParticipants(body.roomId, body.participants);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/:roomId/invite-bulk')
  async sendBulkInvitations(@Param('roomId') roomId: string, @Body() body: { template: string }) {
    return this.admin.sendBulkInvitations(roomId, body.template);
  }

  @UseGuards(JwtAuthGuard)
  @Post('questions/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = './uploads';
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      // 이미지 파일만 허용 (보안)
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다.'), false);
      }
      cb(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB 제한
    }
  }))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('파일이 업로드되지 않았습니다.');
    return { url: `http://localhost:3000/uploads/${file.filename}` };
  }
}

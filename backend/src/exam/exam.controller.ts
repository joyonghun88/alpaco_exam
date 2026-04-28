import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ExamService } from './exam.service';

@Controller('exam')
export class ExamController {
  constructor(private exam: ExamService) {}

  @Get(':id/questions')
  async getQuestions(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.exam.getQuestions(id);
  }

  @Post(':id/submit')
  async submitExam(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: { answers: Record<string, number> }) {
    return this.exam.submitAnswers(id, body.answers);
  }

  @Post(':id/progress')
  async saveProgress(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: { questionId: string, answer: any }) {
    return this.exam.saveProgress(id, body.questionId, body.answer);
  }

  @Get(':id/kvs-credentials')
  async getKvsCredentials(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('role') role: 'MASTER' | 'VIEWER' = 'VIEWER'
  ) {
    return this.exam.getKvsCredentials(id, role);
  }
}

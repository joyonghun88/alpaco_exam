import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify')
  async verifyCode(@Body() body: { inviteCode: string, agreedTerms?: boolean }) {
    if (!body.inviteCode) {
      throw new HttpException('초대코드를 입력해주세요.', HttpStatus.BAD_REQUEST);
    }
    
    return this.authService.verifyAndStartExam(body.inviteCode, body.agreedTerms);
  }
}

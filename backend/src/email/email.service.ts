import { Injectable } from '@nestjs/common';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly senderEmail = process.env.SES_SENDER_EMAIL || 'support@alpaco.io';

  constructor() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn('[EmailService] Missing AWS credentials env (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). SES sending will fail.');
    }
    if (!process.env.SES_SENDER_EMAIL) {
      console.warn(`[EmailService] Missing SES_SENDER_EMAIL env. Falling back to ${this.senderEmail}. Ensure this identity is verified in SES.`);
    }

    const sesClient = new SESClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.transporter = nodemailer.createTransport({
      SES: { ses: sesClient, aws: { SESClient, SendRawEmailCommand } },
    });
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `Alpaco Exam Manager <${this.senderEmail}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`[EmailService] Email sent to ${to}: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error(
        `[EmailService] Failed to send email to ${to} (from=${this.senderEmail}, region=${process.env.AWS_REGION || 'ap-northeast-2'})`,
        error
      );
      throw error;
    }
  }

  // 초대 이메일 템플릿 생성 유틸리티
  getInvitationTemplate(name: string, roomName: string, inviteCode: string, link: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5;">Alpaco Exam 초대 안내</h2>
        <p>안녕하세요, <strong>${name}</strong>님!</p>
        <p><strong>[${roomName}]</strong> 시험에 초대되었습니다. 아래의 링크와 초대 코드를 확인해 주세요.</p>
        
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>초대 코드:</strong> <span style="font-size: 1.2em; color: #111827;">${inviteCode}</span></p>
          <p style="margin: 5px 0;"><strong>시험 링크:</strong> <a href="${link}" style="color: #4f46e5;">${link}</a></p>
        </div>
        
        <p style="font-size: 0.9em; color: #6b7280;">* 시험 시작 전 시스템 환경(카메라, 네트워크 등)을 미리 점검해 주시기 바랍니다.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8em; color: #9ca3af; text-align: center;">© 2026 Alpaco Exam Platform. All rights reserved.</p>
      </div>
    `;
  }
}

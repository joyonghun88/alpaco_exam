import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import * as dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 1. 보안 헤더 설정 (Helmet)
  // crossOriginResourcePolicy: false 설정은 S3 등 외부 리소스와 렌더링 충돌을 방지하기 위함입니다.
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  // 2. CORS 설정
  app.enableCors({
    origin: [/https?:\/\/localhost:\d+/],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3. 글로벌 파이프 설정 (에러 은닉 및 유효성 검사)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // DTO에 정의되지 않은 속성 자동 제거
    forbidNonWhitelisted: true, // 정의되지 않은 속성 포함 시 가차없이 에러
    transform: true, // 자동 타입 변환
    disableErrorMessages: process.env.NODE_ENV === 'production', // 운영 환경에선 상세 에러 감춤
  }));

  // 4. 정적 파일 서빙
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🛡️  Security-hardened application is running on: http://localhost:${port}`);
}
bootstrap();

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
  
  // 0. API 경로 프리픽스 설정
  app.setGlobalPrefix('api');

  // 0. 모든 요청 로그 기록 미들웨어
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // 1. 보안 헤더 설정 (Helmet)
  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));

  // 2. CORS 설정 (프로덕션에서는 허용 도메인 제한)
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:5173',
        'https://main.d1jp391cw5p5y.amplifyapp.com',
        'https://main.d1jfxpi9oo1uai.amplifyapp.com',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // 서버 간 호출(origin 없음)이나 허용 목록에 포함된 경우 허용
      if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked unregistered origin: ${origin}`);
        // Return "not allowed" without throwing to avoid polluting logs with 500s.
        callback(null, false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
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

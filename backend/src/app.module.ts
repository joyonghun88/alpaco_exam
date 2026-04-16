import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { EventsModule } from './events/events.module';
import { ExamModule } from './exam/exam.module';
import { AwsModule } from './aws/aws.module';
import { RedisModule } from './redis/redis.module';
import { EmailModule } from './email/email.module';
import { PresenceModule } from './presence/presence.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 1분당 100회 요청 제한
    }]),
    PrismaModule, 
    AuthModule, 
    AdminModule, 
    EventsModule, 
    ExamModule, 
    AwsModule,
    RedisModule,
    EmailModule,
    PresenceModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
       provide: APP_GUARD,
       useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

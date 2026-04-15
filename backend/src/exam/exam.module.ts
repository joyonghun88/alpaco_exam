import { Module } from '@nestjs/common';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';
import { SyncService } from './sync.service';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [AwsModule],
  controllers: [ExamController],
  providers: [ExamService, SyncService],
})
export class ExamModule {}

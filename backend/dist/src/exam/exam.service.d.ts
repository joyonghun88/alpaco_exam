import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';
import { RedisService } from '../redis/redis.service';
export declare class ExamService {
    private prisma;
    private aws;
    private redis;
    constructor(prisma: PrismaService, aws: AwsService, redis: RedisService);
    private getEffectiveEndAt;
    getQuestions(participantId: string): Promise<{
        id: any;
        type: any;
        content: any;
        orderNum: number;
        point: number;
    }[]>;
    saveProgress(participantId: string, questionId: string, answer: any): Promise<{
        success: boolean;
    } | undefined>;
    submitAnswers(participantId: string, manualAnswers?: Record<string, number>): Promise<{
        success: boolean;
        score: number;
    }>;
    getKvsCredentials(participantId: string, role?: 'MASTER' | 'VIEWER'): Promise<{
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string | undefined;
        region: string;
        channelArn: string | undefined;
        channelName: string | undefined;
        signalingEndpoint: string | null | undefined;
        iceServers: {
            urls: string[] | undefined;
            username: string | undefined;
            credential: string | undefined;
        }[];
    }>;
}

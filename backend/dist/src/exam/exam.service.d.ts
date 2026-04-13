import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';
export declare class ExamService {
    private prisma;
    private aws;
    constructor(prisma: PrismaService, aws: AwsService);
    getQuestions(participantId: string): Promise<{
        id: any;
        type: any;
        content: any;
        orderNum: number;
        point: number;
    }[]>;
    saveProgress(participantId: string, questionId: string, answer: any): Promise<{
        id: string;
        updatedAt: Date;
        participantId: string;
        questionId: string;
        answerContent: import("@prisma/client/runtime/library").JsonValue;
        earnedPoint: number | null;
        gradingStatus: import("@prisma/client").$Enums.GradingStatus;
        gradedById: string | null;
    } | undefined>;
    submitAnswers(participantId: string, answers: Record<string, number>): Promise<{
        success: boolean;
        score: number;
    }>;
    getKvsCredentials(participantId: string): Promise<{
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
        sessionToken: string | undefined;
        region: string;
        channelArn: string | undefined;
        channelName: string | undefined;
    }>;
}

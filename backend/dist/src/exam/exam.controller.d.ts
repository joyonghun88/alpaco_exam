import { ExamService } from './exam.service';
export declare class ExamController {
    private exam;
    constructor(exam: ExamService);
    getQuestions(id: string): Promise<{
        id: any;
        type: any;
        content: any;
        orderNum: number;
        point: number;
    }[]>;
    submitExam(id: string, body: {
        answers: Record<string, number>;
    }): Promise<{
        success: boolean;
        score: number;
    }>;
    saveProgress(id: string, body: {
        questionId: string;
        answer: any;
    }): Promise<{
        id: string;
        updatedAt: Date;
        participantId: string;
        questionId: string;
        answerContent: import("@prisma/client/runtime/library").JsonValue;
        earnedPoint: number | null;
        gradingStatus: import("@prisma/client").$Enums.GradingStatus;
        gradedById: string | null;
    } | undefined>;
    getKvsCredentials(id: string): Promise<{
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
        sessionToken: string | undefined;
        region: string;
        channelArn: string | undefined;
        channelName: string | undefined;
    }>;
}

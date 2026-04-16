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
        success: boolean;
    } | undefined>;
    getKvsCredentials(id: string, role?: 'MASTER' | 'VIEWER'): Promise<{
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

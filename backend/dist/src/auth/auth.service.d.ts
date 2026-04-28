import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    constructor(prisma: PrismaService);
    verifyAndStartExam(inviteCode: string, agreedTerms?: boolean): Promise<{
        message: string;
        participantId: string;
        name: string;
        examRoom: {
            id: string;
            title: string;
            durationMinutes: number;
            isShuffleQuestions: boolean;
            isRequireCamera: boolean;
            standardTerms: string | null;
            cameraTerms: string | null;
        };
        startedAt: Date | null;
        expiresAt: Date;
    }>;
}

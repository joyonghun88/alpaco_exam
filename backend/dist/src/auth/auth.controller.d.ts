import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    verifyCode(body: {
        inviteCode: string;
        agreedTerms?: boolean;
    }): Promise<{
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
    }>;
}

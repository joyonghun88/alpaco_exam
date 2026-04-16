import { AdminService } from './admin.service';
import { AdminAuthService } from './admin-auth.service';
export declare class AdminController {
    private admin;
    private adminAuth;
    constructor(admin: AdminService, adminAuth: AdminAuthService);
    login(body: any, req: any): Promise<{
        access_token: string;
        admin: {
            id: any;
            username: any;
            name: any;
            role: any;
        };
    }>;
    register(body: any, req: any): Promise<{
        id: string;
        name: string;
        username: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }>;
    getAdmins(): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        username: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }[]>;
    updateRole(id: string, role: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        username: string;
        password: string;
        role: import("@prisma/client").$Enums.AdminRole;
    }>;
    getLogs(adminId?: string): Promise<({
        admin: {
            name: string;
            username: string;
        };
    } & {
        id: string;
        createdAt: Date;
        action: string;
        targetId: string | null;
        details: string | null;
        ipAddress: string | null;
        adminId: string;
    })[]>;
    getDashboardSummary(): Promise<{
        id: string;
        roomName: string;
        examTitle: string;
        status: import("@prisma/client").$Enums.RoomStatus;
        startAt: Date;
        endAt: Date;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        isRequireCamera: boolean;
        standardTerms: string | null;
        cameraTerms: string | null;
        stats: {
            total: number;
            testing: number;
            completed: number;
            violations: number;
        };
    }[]>;
    getDashboard(roomId: string, req: any): Promise<{
        stats: {
            total: number;
            testing: number;
            completed: number;
            totalViolations: number;
        };
        participants: {
            id: string;
            name: string;
            email: string;
            roomName: string;
            status: import("@prisma/client").$Enums.ParticipantStatus;
            isOnline: boolean;
            startedAt: Date | null;
            violationCount: number;
            inviteCode: string;
            totalScore: number;
            questionResults: {
                questionId: string;
                orderNum: number;
                point: number;
                earnedPoint: number | null;
                gradingStatus: import("@prisma/client").$Enums.GradingStatus;
            }[];
            videoUrl: string | null | undefined;
            securityLogs: {
                id: string;
                clipUrl: string | null;
                description: string | null;
                capturedAt: Date;
                participantId: string;
                violationType: string;
            }[];
        }[];
    }>;
    logView(participantId: string, action: string, req: any): Promise<{
        id: string;
        createdAt: Date;
        action: string;
        targetId: string | null;
        details: string | null;
        ipAddress: string | null;
        adminId: string;
    }>;
    getExams(): Promise<({
        _count: {
            questions: number;
            examRooms: number;
        };
    } & {
        id: string;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getExamDetail(id: string): Promise<any>;
    createExam(body: {
        title: string;
        description: string;
    }): Promise<{
        id: string;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteExam(id: string): Promise<{
        id: string;
        title: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getQuestionPool(): Promise<({
        parent: {
            id: string;
            createdAt: Date;
            category: string | null;
            type: import("@prisma/client").$Enums.QuestionType;
            content: import("@prisma/client/runtime/library").JsonValue;
            correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
            parentId: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
    })[]>;
    addQuestionToPool(body: {
        category: string;
        type: string;
        content: any;
        correctAnswer: any;
        parentId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
    }>;
    deleteCategory(name: string): Promise<{
        deleted: number;
    }>;
    moveQuestionsToCategory(body: {
        questionIds: string[];
        targetCategory: string;
    }): Promise<{
        moved: number;
    }>;
    deleteQuestion(id: string): Promise<{
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
    }>;
    updateQuestion(id: string, body: {
        category: string;
        type: string;
        content: any;
        correctAnswer: any;
        parentId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
    }>;
    bulkAddQuestions(body: {
        questions: any[];
    }): Promise<import("@prisma/client").Prisma.BatchPayload>;
    assignQuestion(examId: string, body: {
        questionId: string;
        orderNum: number;
        point: number;
    }): Promise<any>;
    removeQuestion(examId: string, questionId: string): Promise<any>;
    updateExamQuestion(examId: string, questionId: string, body: {
        orderNum: number;
        point: number;
    }): Promise<any>;
    getRooms(): Promise<({
        exam: {
            questions: ({
                question: {
                    id: string;
                    createdAt: Date;
                    category: string | null;
                    type: import("@prisma/client").$Enums.QuestionType;
                    content: import("@prisma/client/runtime/library").JsonValue;
                    correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
                    parentId: string | null;
                };
            } & {
                id: string;
                examId: string;
                questionId: string;
                orderNum: number;
                point: number;
            })[];
        } & {
            id: string;
            title: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        _count: {
            participants: number;
        };
    } & {
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    })[]>;
    createRoom(body: {
        examId: string;
        roomName: string;
        durationMinutes: number;
        startAt?: string;
        isRequireCamera?: boolean;
        standardTerms?: string;
        cameraTerms?: string;
    }): Promise<{
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    }>;
    updateRoomStatus(id: string, body: {
        status: string;
    }): Promise<{
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    }>;
    updateWaitingScreen(id: string, body: {
        message: string;
        title: string;
        icon: string;
        standardTerms?: string;
        cameraTerms?: string;
    }): Promise<{
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    }>;
    deleteRoom(id: string, req: any): Promise<{
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    }>;
    updateRoom(id: string, body: any): Promise<{
        id: string;
        roomName: string;
        startAt: Date;
        endAt: Date;
        durationMinutes: number;
        status: import("@prisma/client").$Enums.RoomStatus;
        isShuffleQuestions: boolean;
        isRequireCamera: boolean;
        violationLimit: number;
        waitingMessage: string | null;
        waitingTitle: string | null;
        iconType: string | null;
        standardTerms: string | null;
        cameraTerms: string | null;
        examId: string;
    }>;
    getParticipants(req: any): Promise<({
        room: {
            id: string;
            roomName: string;
            startAt: Date;
            endAt: Date;
            durationMinutes: number;
            status: import("@prisma/client").$Enums.RoomStatus;
            isShuffleQuestions: boolean;
            isRequireCamera: boolean;
            violationLimit: number;
            waitingMessage: string | null;
            waitingTitle: string | null;
            iconType: string | null;
            standardTerms: string | null;
            cameraTerms: string | null;
            examId: string;
        };
    } & {
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.ParticipantStatus;
        invitationCode: string;
        email: string;
        startedAt: Date | null;
        submittedAt: Date | null;
        termsAgreedAt: Date | null;
        roomId: string;
    })[]>;
    addParticipant(body: {
        name: string;
        email: string;
        roomId?: string;
    }): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.ParticipantStatus;
        invitationCode: string;
        email: string;
        startedAt: Date | null;
        submittedAt: Date | null;
        termsAgreedAt: Date | null;
        roomId: string;
    }>;
    deleteParticipant(id: string, req: any): Promise<{
        id: string;
        name: string;
        status: import("@prisma/client").$Enums.ParticipantStatus;
        invitationCode: string;
        email: string;
        startedAt: Date | null;
        submittedAt: Date | null;
        termsAgreedAt: Date | null;
        roomId: string;
    }>;
    sendInvitation(id: string): Promise<{
        success: boolean;
        message: string;
        inviteCode?: undefined;
        inviteLink?: undefined;
    } | {
        success: boolean;
        message: string;
        inviteCode: string;
        inviteLink: string;
    }>;
    getParticipantGrading(id: string, req: any): Promise<{
        participant: {
            id: string;
            name: string;
            email: string;
            status: import("@prisma/client").$Enums.ParticipantStatus;
            roomId: string;
            roomName: string;
            examTitle: string;
        };
        questions: {
            questionId: any;
            orderNum: number;
            point: number;
            type: any;
            content: any;
            correctAnswer: any;
            submission: {
                answerContent: import("@prisma/client/runtime/library").JsonValue;
                earnedPoint: number;
                gradingStatus: import("@prisma/client").$Enums.GradingStatus;
            } | {
                answerContent: {
                    answer: null;
                };
                earnedPoint: number;
                gradingStatus: string;
            };
        }[];
    }>;
    gradeParticipantAnswer(id: string, body: {
        questionId: string;
        earnedPoint: number;
    }, req: any): Promise<{
        success: boolean;
        questionId: string;
        earnedPoint: number;
    }>;
    sendSelectedInvitations(body: {
        participantIds: string[];
        template: string;
    }): Promise<{
        success: boolean;
        count: number;
        results: any[];
    }>;
    bulkAddParticipants(body: {
        roomId: string;
        participants: {
            name: string;
            email: string;
        }[];
    }): Promise<import("@prisma/client").Prisma.BatchPayload>;
    sendBulkInvitations(roomId: string, body: {
        template: string;
    }): Promise<{
        success: boolean;
        count: number;
        results: any[];
    }>;
    uploadFile(file: any, req: any): Promise<{
        url: string;
    }>;
}

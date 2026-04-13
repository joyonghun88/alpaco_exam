import { PrismaService } from '../prisma/prisma.service';
import { AwsService } from '../aws/aws.service';
export declare class AdminService {
    private prisma;
    private aws;
    constructor(prisma: PrismaService, aws: AwsService);
    logAdminAction(adminId: string, action: string, targetId?: string, details?: string, ip?: string): Promise<{
        id: string;
        createdAt: Date;
        action: string;
        targetId: string | null;
        details: string | null;
        ipAddress: string | null;
        adminId: string;
    }>;
    getDashboardData(adminId: string, roomId?: string): Promise<{
        id: string;
        name: string;
        email: string;
        roomName: string;
        status: import("@prisma/client").$Enums.ParticipantStatus;
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
    }[]>;
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
    createExam(title: string, description: string): Promise<{
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
    addQuestionToPool(category: string, type: string, content: any, correctAnswer: any, parentId?: string): Promise<{
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
    }>;
    updateQuestion(id: string, category: string, type: string, content: any, correctAnswer: any, parentId?: string): Promise<{
        id: string;
        createdAt: Date;
        category: string | null;
        type: import("@prisma/client").$Enums.QuestionType;
        content: import("@prisma/client/runtime/library").JsonValue;
        correctAnswer: import("@prisma/client/runtime/library").JsonValue | null;
        parentId: string | null;
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
    bulkAddQuestions(questions: {
        category: string;
        type: string;
        content: any;
        correctAnswer: any;
    }[]): Promise<import("@prisma/client").Prisma.BatchPayload>;
    assignQuestionToExam(examId: string, questionId: string, orderNum: number, point: number): Promise<any>;
    removeQuestionFromExam(examId: string, questionId: string): Promise<any>;
    updateExamQuestion(examId: string, questionId: string, orderNum: number, point: number): Promise<any>;
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
    createRoom(examId: string, roomName: string, durationMinutes: number, startAt?: string, isRequireCamera?: boolean, standardTerms?: string, cameraTerms?: string): Promise<{
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
    deleteRoom(adminId: string, id: string): Promise<{
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
    getParticipants(adminId: string): Promise<({
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
    deleteParticipant(adminId: string, id: string): Promise<{
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
    addParticipant(name: string, email: string, roomId?: string): Promise<{
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
    bulkAddParticipants(roomId: string, participants: {
        name: string;
        email: string;
    }[]): Promise<import("@prisma/client").Prisma.BatchPayload>;
    sendInvitation(participantId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    sendBulkInvitations(roomId: string, template: string): Promise<{
        success: boolean;
        count: number;
    }>;
    getRoomSummary(): Promise<{
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
    renameCategory(oldName: string, newName: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    updateRoomStatus(id: string, status: string): Promise<{
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
    updateRoomWaitingScreen(id: string, data: {
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
}

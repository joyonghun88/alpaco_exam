export declare class AwsService {
    private kinesisVideoClient;
    private archivedMediaClient;
    private stsClient;
    constructor();
    getOrCreateStream(participantId: string): Promise<import("@aws-sdk/client-kinesis-video").StreamInfo | undefined>;
    getOrCreateSignalingChannel(participantId: string): Promise<import("@aws-sdk/client-kinesis-video").ChannelInfo | undefined>;
    getVideoStreamUrl(participantId: string): Promise<string | null | undefined>;
    getViolationClipUrl(participantId: string, violationTimestamp: Date): Promise<string | null>;
    getTemporaryCredentials(): Promise<{
        accessKeyId: string | undefined;
        secretAccessKey: string | undefined;
        sessionToken: string | undefined;
        region: string;
    }>;
}

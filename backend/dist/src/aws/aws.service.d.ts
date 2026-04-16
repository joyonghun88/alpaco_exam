export declare class AwsService {
    private kinesisVideoClient;
    private archivedMediaClient;
    private stsClient;
    private region;
    constructor();
    getSignalingEndpoint(channelArn: string, role: 'MASTER' | 'VIEWER'): Promise<string | null | undefined>;
    getIceServers(channelArn: string): Promise<{
        urls: string[] | undefined;
        username: string | undefined;
        credential: string | undefined;
    }[]>;
    getOrCreateStream(participantId: string): Promise<import("@aws-sdk/client-kinesis-video").StreamInfo | undefined>;
    getOrCreateSignalingChannel(participantId: string): Promise<import("@aws-sdk/client-kinesis-video").ChannelInfo | undefined>;
    getVideoStreamUrl(participantId: string): Promise<string | null | undefined>;
    getViolationClipUrl(participantId: string, violationTimestamp: Date): Promise<string | null>;
    getTemporaryCredentials(): Promise<{
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string | undefined;
        region: string;
    }>;
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwsService = void 0;
const common_1 = require("@nestjs/common");
const client_kinesis_video_1 = require("@aws-sdk/client-kinesis-video");
const client_kinesis_video_archived_media_1 = require("@aws-sdk/client-kinesis-video-archived-media");
const client_kinesis_video_signaling_1 = require("@aws-sdk/client-kinesis-video-signaling");
const client_sts_1 = require("@aws-sdk/client-sts");
let AwsService = class AwsService {
    kinesisVideoClient;
    archivedMediaClient;
    stsClient;
    region;
    constructor() {
        this.region = process.env.AWS_REGION || 'ap-northeast-2';
        const config = { region: this.region };
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            };
        }
        this.kinesisVideoClient = new client_kinesis_video_1.KinesisVideoClient(config);
        this.archivedMediaClient = new client_kinesis_video_archived_media_1.KinesisVideoArchivedMediaClient(config);
        this.stsClient = new client_sts_1.STSClient(config);
    }
    async getSignalingEndpoint(channelArn, role) {
        try {
            const { ResourceEndpointList } = await this.kinesisVideoClient.send(new client_kinesis_video_1.GetSignalingChannelEndpointCommand({
                ChannelARN: channelArn,
                SingleMasterChannelEndpointConfiguration: {
                    Protocols: ['WSS', 'HTTPS'],
                    Role: role
                }
            }));
            return ResourceEndpointList?.find(e => e.Protocol === 'WSS')?.ResourceEndpoint;
        }
        catch (error) {
            console.error('Failed to get signaling endpoint:', error);
            return null;
        }
    }
    async getIceServers(channelArn) {
        try {
            const { ResourceEndpointList } = await this.kinesisVideoClient.send(new client_kinesis_video_1.GetSignalingChannelEndpointCommand({
                ChannelARN: channelArn,
                SingleMasterChannelEndpointConfiguration: {
                    Protocols: ['HTTPS'],
                    Role: 'VIEWER'
                }
            }));
            const httpsEndpoint = ResourceEndpointList?.find(e => e.Protocol === 'HTTPS')?.ResourceEndpoint;
            if (!httpsEndpoint)
                throw new Error('Signaling endpoint not found');
            const signalingConfig = {
                region: this.region,
                endpoint: httpsEndpoint,
            };
            if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                signalingConfig.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                };
            }
            const signalingClient = new client_kinesis_video_signaling_1.KinesisVideoSignalingClient(signalingConfig);
            const { IceServerList } = await signalingClient.send(new client_kinesis_video_signaling_1.GetIceServerConfigCommand({
                ChannelARN: channelArn
            }));
            return IceServerList?.map(s => ({
                urls: s.Uris,
                username: s.Username,
                credential: s.Password
            })) || [];
        }
        catch (error) {
            console.error('Failed to get ICE servers:', error);
            return [];
        }
    }
    async getOrCreateStream(participantId) {
        const streamName = `proctor-stream-${participantId}`;
        try {
            const { StreamInfo } = await this.kinesisVideoClient.send(new client_kinesis_video_1.DescribeStreamCommand({ StreamName: streamName }));
            return StreamInfo;
        }
        catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                const { StreamARN } = await this.kinesisVideoClient.send(new client_kinesis_video_1.CreateStreamCommand({
                    StreamName: streamName,
                    DataRetentionInHours: 24 * 7
                }));
                const { StreamInfo } = await this.kinesisVideoClient.send(new client_kinesis_video_1.DescribeStreamCommand({ StreamName: streamName }));
                return StreamInfo;
            }
            throw error;
        }
    }
    async getOrCreateSignalingChannel(participantId) {
        const channelName = `proctor-exam-${participantId}`;
        const streamInfo = await this.getOrCreateStream(participantId);
        try {
            const describeCommand = new client_kinesis_video_1.DescribeSignalingChannelCommand({ ChannelName: channelName });
            const { ChannelInfo } = await this.kinesisVideoClient.send(describeCommand);
            return ChannelInfo;
        }
        catch (error) {
            if (error.name === 'ResourceNotFoundException') {
                const createCommand = new client_kinesis_video_1.CreateSignalingChannelCommand({
                    ChannelName: channelName,
                    ChannelType: 'SINGLE_MASTER',
                });
                const { ChannelARN } = await this.kinesisVideoClient.send(createCommand);
                const { ChannelInfo } = await this.kinesisVideoClient.send(new client_kinesis_video_1.DescribeSignalingChannelCommand({ ChannelName: channelName }));
                return ChannelInfo;
            }
            throw new common_1.InternalServerErrorException('KVS 채널 생성 중 오류가 발생했습니다.');
        }
    }
    async getVideoStreamUrl(participantId) {
        const streamName = `proctor-stream-${participantId}`;
        try {
            const command = new client_kinesis_video_archived_media_1.GetHLSStreamingSessionURLCommand({
                StreamName: streamName,
                PlaybackMode: 'ON_DEMAND',
            });
            const { HLSStreamingSessionURL } = await this.archivedMediaClient.send(command).catch(() => ({ HLSStreamingSessionURL: null }));
            return HLSStreamingSessionURL;
        }
        catch (error) {
            return null;
        }
    }
    async getViolationClipUrl(participantId, violationTimestamp) {
        const streamName = `proctor-stream-${participantId}`;
        const startTime = new Date(violationTimestamp.getTime() - 10 * 1000);
        const endTime = new Date(violationTimestamp.getTime() + 10 * 1000);
        try {
            return `https://kinesisvideo.${this.region}.amazonaws.com/getClip?streamName=${streamName}&start=${startTime.getTime()}&end=${endTime.getTime()}`;
        }
        catch (error) {
            return null;
        }
    }
    async getTemporaryCredentials() {
        try {
            const creds = await this.stsClient.config.credentials();
            if (!creds) {
                throw new common_1.InternalServerErrorException('AWS 자격 증명을 활성화할 수 없습니다.');
            }
            return {
                accessKeyId: creds.accessKeyId,
                secretAccessKey: creds.secretAccessKey,
                sessionToken: creds.sessionToken,
                region: this.region,
            };
        }
        catch (error) {
            console.error('Failed to resolve credentials:', error);
            throw new common_1.InternalServerErrorException('AWS 임시 권한 획득에 실패했습니다.');
        }
    }
};
exports.AwsService = AwsService;
exports.AwsService = AwsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AwsService);
//# sourceMappingURL=aws.service.js.map
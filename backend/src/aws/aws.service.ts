import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { 
  KinesisVideoClient, 
  CreateSignalingChannelCommand, 
  DescribeSignalingChannelCommand,
  UpdateMediaStorageConfigurationCommand,
  CreateStreamCommand,
  DescribeStreamCommand,
  GetSignalingChannelEndpointCommand
} from "@aws-sdk/client-kinesis-video";
import { 
  KinesisVideoArchivedMediaClient, 
  GetHLSStreamingSessionURLCommand,
  GetClipCommand
} from "@aws-sdk/client-kinesis-video-archived-media";
import { KinesisVideoSignalingClient, GetIceServerConfigCommand } from "@aws-sdk/client-kinesis-video-signaling";
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";

@Injectable()
export class AwsService {
  private kinesisVideoClient: KinesisVideoClient;
  private archivedMediaClient: KinesisVideoArchivedMediaClient;
  private stsClient: STSClient;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-northeast-2';
    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    };

    this.kinesisVideoClient = new KinesisVideoClient({ region: this.region, credentials });
    this.archivedMediaClient = new KinesisVideoArchivedMediaClient({ region: this.region, credentials });
    this.stsClient = new STSClient({ region: this.region, credentials });
  }

  /**
   * KVS ICE Servers (STUN/TURN) 목록 가져오기
   */
  async getIceServers(channelArn: string) {
    try {
      // 1. 엔드포인트 가져오기
      const { ResourceEndpointList } = await this.kinesisVideoClient.send(new GetSignalingChannelEndpointCommand({
        ChannelARN: channelArn,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['HTTPS'],
          Role: 'VIEWER'
        }
      }));

      const httpsEndpoint = ResourceEndpointList?.find(e => e.Protocol === 'HTTPS')?.ResourceEndpoint;
      if (!httpsEndpoint) throw new Error('Signaling endpoint not found');

      // 2. ICE Server Config 가져오기
      const signalingClient = new KinesisVideoSignalingClient({
        region: this.region,
        endpoint: httpsEndpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
        }
      });

      const { IceServerList } = await signalingClient.send(new GetIceServerConfigCommand({
        ChannelARN: channelArn
      }));

      return IceServerList?.map(s => ({
        urls: s.Uris,
        username: s.Username,
        credential: s.Password
      })) || [];
    } catch (error) {
      console.error('Failed to get ICE servers:', error);
      return [];
    }
  }

  /**
   * 보관용 KVS Data Stream 생성 또는 조회
   */
  async getOrCreateStream(participantId: string) {
    const streamName = `proctor-stream-${participantId}`;
    try {
      const { StreamInfo } = await this.kinesisVideoClient.send(new DescribeStreamCommand({ StreamName: streamName }));
      return StreamInfo;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        const { StreamARN } = await this.kinesisVideoClient.send(new CreateStreamCommand({ 
          StreamName: streamName,
          DataRetentionInHours: 24 * 7
        }));
        const { StreamInfo } = await this.kinesisVideoClient.send(new DescribeStreamCommand({ StreamName: streamName }));
        return StreamInfo;
      }
      throw error;
    }
  }

  /**
   * 응시자 전용 KVS Signaling Channel 생성 또는 조회
   */
  async getOrCreateSignalingChannel(participantId: string) {
    const channelName = `proctor-exam-${participantId}`;
    const streamInfo = await this.getOrCreateStream(participantId);

    try {
      const describeCommand = new DescribeSignalingChannelCommand({ ChannelName: channelName });
      const { ChannelInfo } = await this.kinesisVideoClient.send(describeCommand);
      return ChannelInfo;
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') {
        const createCommand = new CreateSignalingChannelCommand({
          ChannelName: channelName,
          ChannelType: 'SINGLE_MASTER',
        });
        const { ChannelARN } = await this.kinesisVideoClient.send(createCommand);
        
        const storageCommand = new UpdateMediaStorageConfigurationCommand({
          ChannelARN,
          MediaStorageConfiguration: {
            Status: 'ENABLED',
            StreamARN: streamInfo?.StreamARN,
          }
        });
        await this.kinesisVideoClient.send(storageCommand);

        const { ChannelInfo } = await this.kinesisVideoClient.send(new DescribeSignalingChannelCommand({ ChannelName: channelName }));
        return ChannelInfo;
      }
      throw new InternalServerErrorException('KVS 채널 생성 중 오류가 발생했습니다.');
    }
  }

  /**
   * 전체 응시 영상 HLS 리플레이 주소 생성
   */
  async getVideoStreamUrl(participantId: string) {
    const streamName = `proctor-stream-${participantId}`;
    try {
      const command = new GetHLSStreamingSessionURLCommand({
        StreamName: streamName,
        PlaybackMode: 'ON_DEMAND',
      });
      const { HLSStreamingSessionURL } = await this.archivedMediaClient.send(command).catch(() => ({ HLSStreamingSessionURL: null }));
      return HLSStreamingSessionURL;
    } catch (error) {
      return null;
    }
  }

  /**
   * 위반 시점 전후 10초 클립(MP4) 주소 생성
   */
  async getViolationClipUrl(participantId: string, violationTimestamp: Date) {
    const streamName = `proctor-stream-${participantId}`;
    const startTime = new Date(violationTimestamp.getTime() - 10 * 1000);
    const endTime = new Date(violationTimestamp.getTime() + 10 * 1000);

    try {
      return `https://kinesisvideo.${this.region}.amazonaws.com/getClip?streamName=${streamName}&start=${startTime.getTime()}&end=${endTime.getTime()}`;
    } catch (error) {
       return null;
    }
  }

  /**
   * 프론트엔드 송출을 위한 임시 세션 토큰 발급
   */
  async getTemporaryCredentials() {
    try {
      const command = new GetSessionTokenCommand({
        DurationSeconds: 3600,
      });
      const { Credentials } = await this.stsClient.send(command);
      if (!Credentials) {
        throw new InternalServerErrorException('AWS 자격 증명을 가저올 수 없습니다.');
      }
      return {
        accessKeyId: Credentials.AccessKeyId,
        secretAccessKey: Credentials.SecretAccessKey,
        sessionToken: Credentials.SessionToken,
        region: this.region,
      };
    } catch (error) {
      throw new InternalServerErrorException('AWS 임시 권한 발급에 실패했습니다.');
    }
  }
}

import { StreamQuality, GeoLocation } from './types';
import { EventEmitter } from './events/eventEmitter';
import { ConfigManager } from './config/config';
import { SignalingChannel } from './core/transport/signalingChannel';
import { MeshNetwork } from './core/mesh/meshNetwork';
import { StreamChunker } from './core/stream/streamChunker';
import { StreamPlayer } from './core/stream/streamPlayer';
import { MediaManager } from './core/mesh/mediaManager';

export class P2PMeshStreamingSDK extends EventEmitter {
  private config: ConfigManager;
  private peerId: string;
  private roomId: string;
  private signalingChannel: SignalingChannel | null = null;
  private meshNetwork: MeshNetwork | null = null;
  private mediaManager: MediaManager;
  private streamChunker: StreamChunker | null = null;
  private streamPlayer: StreamPlayer | null = null;
  private isStreamer: boolean = false;
  
  constructor(options: {
    peerId?: string;
    roomId: string;
    config?: any;
  }) {
    super();
    
    this.peerId = options.peerId || this.generatePeerId();
    this.roomId = options.roomId;
    this.config = new ConfigManager(options.config || {});
    this.mediaManager = new MediaManager();
    
    this.initialize();
  }
  
  private generatePeerId(): string {
    return `peer-${Math.random().toString(36).substring(2, 9)}`;
  }
  
  private initialize(): void {
    const config = this.config.getConfig();
    
    // 시그널링 채널 초기화
    this.signalingChannel = new SignalingChannel(
      this.peerId,
      this.roomId,
      config.signalingServer
    );
    
    // 메시 네트워크 초기화
    this.meshNetwork = new MeshNetwork(this.signalingChannel);
    
    // 이벤트 핸들러 설정
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    if (!this.signalingChannel) return;
    
    // 시그널링 이벤트 처리
    this.signalingChannel.onConnected = () => {
      this.emit('connect');
    };
    
    this.signalingChannel.onDisconnected = () => {
      this.emit('disconnect');
    };
    
    this.signalingChannel.onError = (error) => {
      this.emit('error', error);
    };
  }
  
  // 스트리머로 시작
  async startStreaming(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    try {
      // 미디어 스트림 초기화
      const stream = await this.mediaManager.initializeStream(constraints);
      
      // 스트림 청커 초기화
      this.streamChunker = new StreamChunker(stream, this.peerId);
      
      // 청크 리스너 추가
      this.streamChunker.addChunkListener((chunk) => {
        this.broadcastChunk(chunk);
      });
      
      // 청크 생성 시작
      this.streamChunker.startChunking();
      
      // 메시 네트워크에 소스 노드로 설정
      if (this.meshNetwork) {
        this.meshNetwork.setSourceNode(this.peerId);
      }
      
      this.isStreamer = true;
      this.emit('streamStart', stream);
      
      // 네트워크 모니터링 시작
      if (this.meshNetwork) {
        this.meshNetwork.monitorNetworkHealth();
      }
      
      return stream;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  // 청크 브로드캐스트
  private broadcastChunk(chunk: any): void {
    // 연결된 모든 피어에게 전송
    if (this.meshNetwork) {
      // 실제 구현에서는 메시 네트워크를 통한 브로드캐스트 로직
    }
  }
  
  // 시청자로 시작
  async startViewing(videoElement: HTMLVideoElement): Promise<void> {
    try {
      // 스트림 플레이어 초기화
      this.streamPlayer = new StreamPlayer(videoElement);
      
      // 메시 네트워크 연결
      if (this.meshNetwork) {
        // 자신의 위치 정보 얻기 (간단한 구현)
        const location = await this.getLocation();
        
        // 자신을 피어로 추가
        await this.meshNetwork.addPeer(this.peerId, location);
        
        // 최적의 업스트림 피어에 연결
        const optimalPeers = this.meshNetwork.findOptimalUpstreamPeers(location);
        
        for (const peerId of optimalPeers) {
          // 연결 로직 (시그널링 및 P2P 연결)
        }
        
        // 네트워크 모니터링 시작
        this.meshNetwork.monitorNetworkHealth();
      }
      
      this.isStreamer = false;
      this.emit('viewStart');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
  
  // 위치 정보 얻기 (실제 구현에서는 더 정확한 방법 사용)
  private async getLocation(): Promise<GeoLocation> {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          () => {
            // 기본 위치 반환 (정확하지 않음)
            resolve({
              latitude: 0,
              longitude: 0
            });
          }
        );
      } else {
        // geolocation API 미지원
        resolve({
          latitude: 0,
          longitude: 0
        });
      }
    });
  }
  
  // 스트림 품질 변경
  async changeStreamQuality(quality: StreamQuality): Promise<void> {
    if (this.isStreamer) {
      // 스트리머인 경우 미디어 스트림 품질 변경
      await this.mediaManager.changeStreamQuality(quality);
      this.emit('qualityChange', quality);
    } else {
      // 시청자인 경우 업스트림 피어 연결 최적화
      if (this.meshNetwork) {
        // 네트워크 토폴로지 최적화 (더 좋은 업스트림 찾기)
        this.meshNetwork.optimizeNetworkTopology();
      }
    }
  }
  
  // 네트워크 통계 얻기
  getNetworkStats(): any {
    if (!this.meshNetwork) return null;
    
    // 메시 네트워크 시각화 데이터 및 통계
    return this.meshNetwork.getNetworkVisualizationData();
  }
  
  // 스트리밍/시청 중단
  stop(): void {
    if (this.isStreamer) {
      // 스트리머 정리 작업
      if (this.streamChunker) {
        this.streamChunker.stopChunking();
      }
    } else {
      // 시청자 정리 작업
      if (this.streamPlayer) {
        this.streamPlayer.dispose();
      }
    }
    
    // 메시 네트워크 연결 정리
    if (this.meshNetwork) {
      // 모든 피어 연결 종료
    }
    
    // 시그널링 채널 종료
    if (this.signalingChannel) {
      this.signalingChannel.close();
    }
    
    this.emit('streamStop');
  }
  
  // 자원 해제
  dispose(): void {
    this.stop();
    this.removeAllListeners();
  }
}

// 팩토리 함수로 SDK 인스턴스 생성
export function createStreamingSDK(options: {
  roomId: string;
  peerId?: string;
  config?: any;
}): P2PMeshStreamingSDK {
  return new P2PMeshStreamingSDK(options);
}
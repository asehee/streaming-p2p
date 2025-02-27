export interface SDKConfig {
    signalingServer: string;
    iceServers: RTCIceServer[];
    maxRelayCount: number;
    chunkSize: number;
    reconnectAttempts: number;
    monitoringInterval: number;
    preferredCodecs: string[];
    testMode?: boolean; // 테스트 모드 플래그 추가
  }
  
  export class ConfigManager {
    private config: SDKConfig;
    
    constructor(userConfig: Partial<SDKConfig>) {
      // 기본 설정과 사용자 설정 병합
      this.config = {
        signalingServer: 'wss://signaling.example.com',
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        maxRelayCount: 5,
        chunkSize: 16 * 1024, // 16KB
        reconnectAttempts: 5,
        monitoringInterval: 10000, // 10초
        preferredCodecs: ['VP8', 'H.264', 'VP9', 'AV1'],
        testMode: false, // 기본값은 false
        ...userConfig
      };
    }
    
    getConfig(): SDKConfig {
      return { ...this.config };
    }
    
    updateConfig(newConfig: Partial<SDKConfig>): void {
      this.config = {
        ...this.config,
        ...newConfig
      };
    }
  }
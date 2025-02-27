export interface GeoLocation {
    latitude: number;
    longitude: number;
    country?: string;
    region?: string;
  }
  
  export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed';
  
  export interface PeerInfo {
    id: string;
    location?: GeoLocation;
    state: ConnectionState;
    bandwidth: {
      upload: number;  // kbps
      download: number; // kbps
    };
    latency: number;    // ms
    relayCount: number; // 다른 피어에게 전달하는 스트림 수
  }
  
  export interface StreamChunk {
    id: string;
    timestamp: number;
    data: ArrayBuffer;
    seqNumber: number;
    sourceId: string;
    mimeType: string;
  }
  
  export interface CodecSupportInfo {
    name: string;
    supported: boolean;
    smooth?: boolean;
    powerEfficient?: boolean;
  }
  
  export type StreamQuality = 'low' | 'medium' | 'high' | 'auto';
  
  export type StreamEvent = 
    | 'connect'
    | 'disconnect'
    | 'streamStart'
    | 'streamStop'
    | 'qualityChange'
    | 'networkStats'
    | 'error';
  
  // NetworkInformation API 타입 정의
  export interface NetworkInformation {
    downlink?: number;
    effectiveType?: string;
    rtt?: number;
    saveData?: boolean;
    type?: string;
    onchange?: () => void;
  }
  
  // 전역 타입 확장
  declare global {
    interface Navigator {
      connection?: NetworkInformation;
      mozConnection?: NetworkInformation;
      webkitConnection?: NetworkInformation;
    }
  }
  
  // MediaCapabilities API 타입 (필요한 경우)
  export interface MediaCapabilitiesInfo {
    supported: boolean;
    smooth: boolean;
    powerEfficient: boolean;
  }
  
  export interface NetworkEdge {
    from: string;
    to: string;
    arrows: string;
    color: {
      color: string;
      opacity: number;
    };
  }
  
  export interface VideoConfiguration {
    contentType: string;
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
  }
  
  export interface DecodingConfiguration {
    type: 'file' | 'media-source';
    video?: VideoConfiguration;
  }
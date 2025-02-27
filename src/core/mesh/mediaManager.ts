import { StreamQuality } from '../../types';
import { CodecDetector } from '../codec/codecDetector';

export class MediaManager {
  private mediaStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private codecDetector = new CodecDetector();
  
  async initializeStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.mediaStream;
    } catch (error) {
      console.warn('요청된 제약 조건으로 미디어 스트림 획득 실패, 기본 설정으로 시도합니다:', error);
      
      try {
        // 더 기본적인 제약 조건으로 재시도
        const basicConstraints = { 
          video: { facingMode: "user" }, 
          audio: true 
        };
        this.mediaStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        return this.mediaStream;
      } catch (fallbackError) {
        console.error('미디어 스트림 획득 실패:', fallbackError);
        
        // 개발 테스트용: 더미 스트림 생성 (실제 배포에는 사용하지 마세요)
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx?.fillRect(0, 0, canvas.width, canvas.height);
        ctx?.fillText('카메라를 찾을 수 없습니다', 20, canvas.height / 2);
        
        const stream = canvas.captureStream(30); // 30fps
        this.mediaStream = stream;
        return stream;
      }
    }
  }
  
  async getOptimalStreamSettings(): Promise<MediaStreamConstraints> {
    const deviceCapabilities = await this.getDeviceCapabilities();
    const networkConditions = await this.estimateNetworkConditions();
    
    // 네트워크 상태와 디바이스 성능에 맞춘 최적 설정
    const frameRate = networkConditions.bandwidth > 1000 ? 30 : 24;
    const resolution = this.calculateOptimalResolution(networkConditions, deviceCapabilities);
    
    return {
      video: {
        width: { ideal: resolution.width },
        height: { ideal: resolution.height },
        frameRate: { ideal: frameRate }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
  }
  
  private async getDeviceCapabilities(): Promise<any> {
    // 디바이스 성능 추정
    return {
      cpuCores: navigator.hardwareConcurrency || 2,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      // 기타 디바이스 정보
    };
  }
  
  private async estimateNetworkConditions(): Promise<any> {
    // 네트워크 상태 추정
    return {
      bandwidth: (navigator.connection as any)?.downlink || 1,
      rtt: (navigator.connection as any)?.rtt || 100,
      type: (navigator.connection as any)?.type || 'unknown'
    };
  }
  
  private calculateOptimalResolution(network: any, device: any): { width: number, height: number } {
    // 네트워크 및 디바이스 성능에 맞는 해상도 계산
    if (network.bandwidth > 2 && !device.isMobile) {
      return { width: 1280, height: 720 }; // HD
    } else if (network.bandwidth > 1) {
      return { width: 854, height: 480 }; // SD
    } else {
      return { width: 640, height: 360 }; // 저대역폭
    }
  }
  
  attachStreamToVideo(videoElement: HTMLVideoElement, stream: MediaStream): void {
    this.videoElement = videoElement;
    videoElement.srcObject = stream;
    videoElement.play().catch(error => {
      console.error('비디오 재생 오류:', error);
    });
  }
  
  // 스트림 품질 변경
  async changeStreamQuality(quality: StreamQuality): Promise<void> {
    if (!this.mediaStream) return;
    
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    if (!videoTrack) return;
    
    const constraints: MediaTrackConstraintSet = {};
    
    switch (quality) {
      case 'low':
        constraints.width = 640;
        constraints.height = 360;
        constraints.frameRate = 24;
        break;
      case 'medium':
        constraints.width = 854;
        constraints.height = 480;
        constraints.frameRate = 30;
        break;
      case 'high':
        constraints.width = 1280;
        constraints.height = 720;
        constraints.frameRate = 30;
        break;
      case 'auto':
        // 자동 품질은 네트워크 상태에 따라 동적 조정
        const settings = await this.getOptimalStreamSettings();
        constraints.width = (settings.video as MediaTrackConstraints).width;
        constraints.height = (settings.video as MediaTrackConstraints).height;
        constraints.frameRate = (settings.video as MediaTrackConstraints).frameRate;
        break;
    }
    
    await videoTrack.applyConstraints(constraints);
  }
}
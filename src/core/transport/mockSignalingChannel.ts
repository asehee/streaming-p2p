// src/core/transport/mockSignalingChannel.ts
import { EventEmitter } from '../../events/eventEmitter';
import { SignalingInterface } from './signalingInterface';
export class MockSignalingChannel extends EventEmitter implements SignalingInterface {
  private peerId: string;
  private roomId: string;
  private connected: boolean = false;
  private peers: Map<string, any> = new Map();
  
  // 외부 이벤트 핸들러
  onOffer: ((fromPeerId: string, offer: RTCSessionDescriptionInit) => void) | null = null;
  onAnswer: ((fromPeerId: string, answer: RTCSessionDescriptionInit) => void) | null = null;
  onIceCandidate: ((fromPeerId: string, candidate: RTCIceCandidate) => void) | null = null;
  onPeerJoin: ((peerId: string, peerInfo: any) => void) | null = null;
  onPeerLeave: ((peerId: string) => void) | null = null;
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  
  constructor(peerId: string, roomId: string) {
    super();
    this.peerId = peerId;
    this.roomId = roomId;
    
    // 연결 시뮬레이션
    setTimeout(() => {
      this.connected = true;
      if (this.onConnected) this.onConnected();
      console.log('[MockSignaling] 연결됨');
      
      // 가상의 피어 참가 시뮬레이션
      setTimeout(() => {
        this.simulatePeerJoin();
      }, 3000);
    }, 1000);
  }
  
  // 피어 참가 시뮬레이션
  private simulatePeerJoin() {
    const mockPeerId = `mock-peer-${Math.random().toString(36).substring(2, 9)}`;
    const mockPeerInfo = {
      location: {
        latitude: Math.random() * 180 - 90,
        longitude: Math.random() * 360 - 180
      }
    };
    
    console.log(`[MockSignaling] 가상 피어 참가: ${mockPeerId}`);
    this.peers.set(mockPeerId, mockPeerInfo);
    
    if (this.onPeerJoin) {
      this.onPeerJoin(mockPeerId, mockPeerInfo);
    }
  }
  
  send(message: any): void {
    if (!this.connected) {
      console.warn('[MockSignaling] 연결되지 않은 상태에서 메시지 전송 시도');
      return;
    }
    
    console.log('[MockSignaling] 메시지 전송:', message);
    
    // 메시지 타입에 따른 시뮬레이션된 응답
    setTimeout(() => {
      if (message.type === 'offer' && message.toPeerId) {
        // 오퍼에 대한 가상 응답
        if (this.onAnswer) {
          const mockAnswer = { type: 'answer', sdp: 'mock-sdp-answer' };
          this.onAnswer(message.toPeerId, mockAnswer as RTCSessionDescriptionInit);
        }
      }
    }, 500);
  }
  
  sendOffer(toPeerId: string, offer: RTCSessionDescriptionInit): void {
    this.send({
      type: 'offer',
      toPeerId,
      fromPeerId: this.peerId,
      offer
    });
  }
  
  sendAnswer(toPeerId: string, answer: RTCSessionDescriptionInit): void {
    this.send({
      type: 'answer',
      toPeerId,
      fromPeerId: this.peerId,
      answer
    });
  }
  
  sendIceCandidate(toPeerId: string, candidate: RTCIceCandidate): void {
    this.send({
      type: 'ice-candidate',
      toPeerId,
      fromPeerId: this.peerId,
      candidate
    });
  }
  
  close(): void {
    this.connected = false;
    if (this.onDisconnected) this.onDisconnected();
    console.log('[MockSignaling] 연결 종료');
  }
}
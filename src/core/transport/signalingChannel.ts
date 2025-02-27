import { SignalingInterface } from './signalingInterface';

export class SignalingChannel  implements SignalingInterface{
    private socket: WebSocket | null = null;
    private peerId: string;
    private roomId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectTimeout: number = 1000;
    
    // 이벤트 핸들러
    onOffer: ((fromPeerId: string, offer: RTCSessionDescriptionInit) => void) | null = null;
    onAnswer: ((fromPeerId: string, answer: RTCSessionDescriptionInit) => void) | null = null;
    onIceCandidate: ((fromPeerId: string, candidate: RTCIceCandidate) => void) | null = null;
    onPeerJoin: ((peerId: string, peerInfo: any) => void) | null = null;
    onPeerLeave: ((peerId: string) => void) | null = null;
    onConnected: (() => void) | null = null;
    onDisconnected: (() => void) | null = null;
    onError: ((error: Error) => void) | null = null;
    
    constructor(peerId: string, roomId: string, serverUrl: string) {
      this.peerId = peerId;
      this.roomId = roomId;
      this.connect(serverUrl);
    }
    
    private connect(serverUrl: string): void {
      try {
        this.socket = new WebSocket(serverUrl);
        
        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
      } catch (error) {
        console.error('시그널링 서버 연결 실패:', error);
        this.reconnect(serverUrl);
      }
    }
    
    private handleOpen(): void {
      console.log('시그널링 서버에 연결됨');
      this.reconnectAttempts = 0;
      
      // 방 참가 메시지 전송
      this.send({
        type: 'join',
        roomId: this.roomId,
        peerId: this.peerId,
        peerInfo: {
          // 위치 정보 등 포함
        }
      });
      
      if (this.onConnected) this.onConnected();
    }
    
    private handleMessage(event: MessageEvent): void {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'offer':
            if (this.onOffer) {
              this.onOffer(message.fromPeerId, message.offer);
            }
            break;
          
          case 'answer':
            if (this.onAnswer) {
              this.onAnswer(message.fromPeerId, message.answer);
            }
            break;
          
          case 'ice-candidate':
            if (this.onIceCandidate) {
              this.onIceCandidate(message.fromPeerId, message.candidate);
            }
            break;
          
          case 'peer-join':
            if (this.onPeerJoin) {
              this.onPeerJoin(message.peerId, message.peerInfo);
            }
            break;
          
          case 'peer-leave':
            if (this.onPeerLeave) {
              this.onPeerLeave(message.peerId);
            }
            break;
          
          default:
            console.warn('알 수 없는 메시지 유형:', message.type);
        }
      } catch (error) {
        console.error('메시지 처리 오류:', error);
      }
    }
    
    private handleClose(event: CloseEvent): void {
      console.log('시그널링 서버 연결 끊김:', event.code, event.reason);
      
      if (this.onDisconnected) this.onDisconnected();
      
      if (event.code !== 1000) { // 1000은 정상 종료
        this.reconnect(this.socket!.url);
      }
    }
    
    private handleError(event: Event): void {
      console.error('WebSocket 오류:', event);
      
      if (this.onError) this.onError(new Error('WebSocket 오류'));
    }
    
    private reconnect(serverUrl: string): void {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('최대 재연결 시도 횟수 도달');
        return;
      }
      
      this.reconnectAttempts++;
      const timeout = this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`${timeout}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect(serverUrl);
      }, timeout);
    }
    
    send(message: any): void {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message));
      } else {
        console.warn('메시지를 보낼 수 없음: WebSocket이 열려있지 않음');
      }
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
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
    }
  }
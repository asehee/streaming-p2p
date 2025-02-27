import { ConnectionState, GeoLocation, PeerInfo, StreamChunk } from '../../types';

export class PeerNode {
  private id: string;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private upstreamPeers: Map<string, RTCPeerConnection> = new Map();
  private downstreamPeers: Map<string, RTCPeerConnection> = new Map();
  private streamBuffers: Map<string, StreamChunk[]> = new Map();
  private stats: PeerInfo;
  
  constructor(id: string, location?: GeoLocation) {
    this.id = id;
    this.stats = {
      id,
      location,
      state: 'disconnected',
      bandwidth: {
        upload: 0,
        download: 0
      },
      latency: 0,
      relayCount: 0
    };
  }
  
  // 업스트림 피어에 연결 (데이터를 받을 피어)
  async connectToUpstream(peerId: string, signalingChannel: any): Promise<void> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
      }]
    });
    
    // 데이터 채널 설정
    const dataChannel = peerConnection.createDataChannel('stream', {
      ordered: false,       // 순서 보장 불필요
      maxRetransmits: 0,    // 재전송 없음 (실시간성 우선)
      priority: 'high'
    });
    
    dataChannel.onmessage = (event) => {
      this.handleStreamChunk(JSON.parse(event.data));
    };
    
    // 연결 상태 모니터링
    peerConnection.onconnectionstatechange = () => {
      this.stats.state = peerConnection.connectionState as ConnectionState;
      // 연결 상태에 따른 처리
    };
    
    // ICE 후보 처리
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingChannel.sendIceCandidate(peerId, event.candidate);
      }
    };
    
    // 오퍼 생성 및 전송
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingChannel.sendOffer(peerId, offer);
    
    this.upstreamPeers.set(peerId, peerConnection);
  }
  
  // 다운스트림 피어 처리 (데이터를 전달할 피어)
  async handleDownstreamConnection(peerId: string, offer: RTCSessionDescriptionInit, signalingChannel: any): Promise<void> {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
      }]
    });
    
    // 데이터 채널 이벤트 처리
    peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      dataChannel.onmessage = (messageEvent) => {
        this.relayStreamChunk(peerId, JSON.parse(messageEvent.data));
      };
    };
    
    // 연결 상태 모니터링
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        this.stats.relayCount++;
      } else if (peerConnection.connectionState === 'disconnected' || 
                peerConnection.connectionState === 'failed') {
        this.stats.relayCount--;
      }
    };
    
    // ICE 후보 처리
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingChannel.sendIceCandidate(peerId, event.candidate);
      }
    };
    
    // 오퍼 처리 및 응답 생성
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingChannel.sendAnswer(peerId, answer);
    
    this.downstreamPeers.set(peerId, peerConnection);
  }
  
  // 스트림 청크 처리
  private handleStreamChunk(chunk: StreamChunk): void {
    // 이미 받은 청크인지 확인
    if (this.isChunkReceived(chunk)) {
      return;
    }
    
    // 청크 저장
    if (!this.streamBuffers.has(chunk.sourceId)) {
      this.streamBuffers.set(chunk.sourceId, []);
    }
    
    this.streamBuffers.get(chunk.sourceId)?.push(chunk);
    
    // 버퍼링 및 재생 로직
    this.processBufferedChunks(chunk.sourceId);
    
    // 다운스트림 피어들에게 청크 릴레이
    this.relayToDownstream(chunk);
  }
  
  // 이미 받은 청크인지 확인
  private isChunkReceived(chunk: StreamChunk): boolean {
    const buffer = this.streamBuffers.get(chunk.sourceId);
    if (!buffer) return false;
    
    return buffer.some(c => c.seqNumber === chunk.seqNumber);
  }
  
  // 버퍼링된 청크 처리
  private processBufferedChunks(sourceId: string): void {
    const buffer = this.streamBuffers.get(sourceId);
    if (!buffer || buffer.length < 5) return; // 최소 버퍼 크기
    
    // 시퀀스 번호로 정렬
    buffer.sort((a, b) => a.seqNumber - b.seqNumber);
    
    // 연속된 청크만 처리
    let lastSeqNumber = -1;
    const continuousChunks: StreamChunk[] = []; // 명시적 타입 지정
    
    for (const chunk of buffer) {
      if (lastSeqNumber === -1 || chunk.seqNumber === lastSeqNumber + 1) {
        continuousChunks.push(chunk);
        lastSeqNumber = chunk.seqNumber;
      } else {
        break; // 연속성 깨짐
      }
    }
    if (continuousChunks.length > 0) {
      // 미디어 처리 로직 (예: MSE를 통한 비디오 렌더링)
      this.renderMediaChunks(continuousChunks);
      
      // 처리된 청크 제거
      this.streamBuffers.set(
        sourceId,
        buffer.filter(c => !continuousChunks.includes(c))
      );
    }
  }
  
  // 미디어 청크 렌더링
  private renderMediaChunks(chunks: StreamChunk[]): void {
    // Media Source Extensions를 사용한 비디오 렌더링 구현
    // 실제 구현은 복잡하므로 간략화
  }
  
  // 다운스트림 피어들에게 청크 릴레이
  private relayToDownstream(chunk: StreamChunk): void {
    for (const [peerId, connection] of this.downstreamPeers.entries()) {
      const dataChannel = connection.createDataChannel('relay');
      if (dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify(chunk));
      }
    }
  }
  
  // 특정 다운스트림 피어로부터 받은 청크 릴레이
  private relayStreamChunk(fromPeerId: string, chunk: StreamChunk): void {
    // 원본 피어로 다시 보내지 않도록 체크
    for (const [peerId, connection] of this.downstreamPeers.entries()) {
      if (peerId !== fromPeerId) {
        const dataChannel = connection.createDataChannel('relay');
        if (dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify(chunk));
        }
      }
    }
    
    // 자신도 청크 처리
    this.handleStreamChunk(chunk);
  }
  
  // 연결 해제
  async disconnect(): Promise<void> {
    // 모든 연결 종료
    for (const connection of this.upstreamPeers.values()) {
      connection.close();
    }
    
    for (const connection of this.downstreamPeers.values()) {
      connection.close();
    }
    
    this.upstreamPeers.clear();
    this.downstreamPeers.clear();
    this.stats.state = 'disconnected';
    this.stats.relayCount = 0;
  }
  
  // 피어 상태 정보
  getStats(): PeerInfo {
    return this.stats;
  }
  
  // 네트워크 상태 모니터링
  async updateNetworkStats(): Promise<void> {
    const statsPromises: Promise<RTCStatsReport>[] = [];
    
    // 업스트림 연결들의 통계 수집
    for (const connection of this.upstreamPeers.values()) {
      statsPromises.push(connection.getStats());
    }
    
    // 다운스트림 연결들의 통계 수집
    for (const connection of this.downstreamPeers.values()) {
      statsPromises.push(connection.getStats());
    }
    
    const allStats = await Promise.all(statsPromises);
    
    // 통계 처리 및 분석
    this.processConnectionStats(allStats);
  }
  
  private processConnectionStats(statsList: RTCStatsReport[]): void {
    let totalDownload = 0;
    let totalUpload = 0;
    let latencySum = 0;
    let latencyCount = 0;
    
    for (const stats of statsList) {
      stats.forEach(report => {
        if (report.type === 'transport') {
          totalDownload += (report.bytesReceived || 0) / 1024; // kbps
          totalUpload += (report.bytesSent || 0) / 1024; // kbps
        }
        
        if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
          latencySum += report.currentRoundTripTime * 1000; // ms
          latencyCount++;
        }
      });
    }
    
    // 평균 계산
    if (latencyCount > 0) {
      this.stats.latency = latencySum / latencyCount;
    }
    
    this.stats.bandwidth.download = totalDownload;
    this.stats.bandwidth.upload = totalUpload;
  }
}
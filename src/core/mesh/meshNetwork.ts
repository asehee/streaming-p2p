import { GeoLocation, NetworkEdge } from '../../types';
import { PeerNode } from './peerNode';

export class MeshNetwork {
  private peers: Map<string, PeerNode> = new Map();
  private topology: Map<string, string[]> = new Map();
  private sourceNodeId: string | null = null;
  private signalingChannel: any; // 시그널링 채널 (자세한 구현 생략)
  
  constructor(signalingChannel: any) {
    this.signalingChannel = signalingChannel;
    
    // 시그널링 이벤트 처리
    this.signalingChannel.onOffer = this.handleOffer.bind(this);
    this.signalingChannel.onAnswer = this.handleAnswer.bind(this);
    this.signalingChannel.onIceCandidate = this.handleIceCandidate.bind(this);
    this.signalingChannel.onPeerJoin = this.handlePeerJoin.bind(this);
    this.signalingChannel.onPeerLeave = this.handlePeerLeave.bind(this);
  }
  
  // 새 피어 추가
  async addPeer(peerId: string, location?: GeoLocation): Promise<PeerNode> {
    const peer = new PeerNode(peerId, location);
    this.peers.set(peerId, peer);
    
    // 초기 연결 토폴로지에 추가
    if (!this.topology.has(peerId)) {
      this.topology.set(peerId, []);
    }
    
    return peer;
  }
  
  // 소스 노드 설정 (스트리머)
  setSourceNode(nodeId: string): void {
    this.sourceNodeId = nodeId;
  }
  
  // 최적의 업스트림 피어 찾기
  findOptimalUpstreamPeers(location: GeoLocation, count: number = 2): string[] {
    // 모든 피어 정보 수집
    const allPeers = Array.from(this.peers.values())
      .map(peer => peer.getStats())
      .filter(stats => 
        stats.state === 'connected' && 
        stats.relayCount < 5 && // 과부하 방지
        stats.bandwidth.upload > 500 // 최소 업로드 대역폭
      );
    
    // 지리적 근접성 계산
    const peersWithDistance = allPeers.map(peer => {
      let distance = Number.MAX_VALUE;
      
      if (peer.location && location) {
        distance = this.calculateGeoDistance(location, peer.location);
      }
      
      return {
        ...peer,
        distance
      };
    });
    
    // 거리, 지연시간, 대역폭을 종합적으로 고려하여 점수 계산
    const scoredPeers = peersWithDistance.map(peer => {
      const distanceScore = 1 / (peer.distance + 1); // 거리가 가까울수록 높은 점수
      const latencyScore = 1 / (peer.latency + 1); // 지연이 적을수록 높은 점수
      const bandwidthScore = peer.bandwidth.upload / 1000; // 대역폭이 클수록 높은 점수
      const loadScore = 1 / (peer.relayCount + 1); // 부하가 적을수록 높은 점수
      
      // 가중치 적용 종합 점수
      const totalScore = 
        (distanceScore * 0.3) + 
        (latencyScore * 0.3) + 
        (bandwidthScore * 0.2) + 
        (loadScore * 0.2);
      
      return {
        ...peer,
        score: totalScore
      };
    });
    
    // 점수 기준 정렬 및 최적 피어 선택
    const optimalPeers = scoredPeers
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(peer => peer.id);
    
    // 소스 노드가 있고 아직 연결이 안 되어 있다면 우선 추가
    if (this.sourceNodeId && !optimalPeers.includes(this.sourceNodeId)) {
      optimalPeers.unshift(this.sourceNodeId);
      
      if (optimalPeers.length > count) {
        optimalPeers.pop();
      }
    }
    
    return optimalPeers;
  }
  
  // 지리적 거리 계산 (Haversine 공식)
  private calculateGeoDistance(location1: GeoLocation, location2: GeoLocation): number {
    const R = 6371; // 지구 반경 (km)
    const dLat = this.deg2rad(location2.latitude - location1.latitude);
    const dLon = this.deg2rad(location2.longitude - location1.longitude);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(location1.latitude)) * Math.cos(this.deg2rad(location2.latitude)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c;
    
    return distance;
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  // 네트워크 토폴로지 최적화
  optimizeNetworkTopology(): void {
    // 병목 노드 감지
    const bottlenecks = this.detectBottlenecks();
    
    // 각 병목 노드에 대해 부하 재분산
    for (const nodeId of bottlenecks) {
      this.redistributeConnections(nodeId);
    }
  }
  
  // 병목 노드 감지
  private detectBottlenecks(): string[] {
    const bottlenecks: string[] = [];
    
    for (const [nodeId, peer] of this.peers.entries()) {
      const stats = peer.getStats();
      
      // 병목 기준: 높은 릴레이 수, 높은 지연시간, 낮은 대역폭
      if (
        stats.relayCount > 5 || 
        stats.latency > 500 || 
        stats.bandwidth.upload < 200 ||
        stats.bandwidth.download < 500
      ) {
        bottlenecks.push(nodeId);
      }
    }
    
    return bottlenecks;
  }
  
  // 연결 재분배
  private redistributeConnections(bottleneckNodeId: string): void {
    // 병목 노드에 연결된 다운스트림 피어 찾기
    const downstreamPeers = this.topology.get(bottleneckNodeId) || [];
    
    // 각 다운스트림 피어에 대해 대체 업스트림 찾기
    for (const peerId of downstreamPeers) {
      const peerLocation = this.peers.get(peerId)?.getStats().location;
      
      if (peerLocation) {
        // 병목 노드를 제외한 새 업스트림 찾기
        const newUpstreams = this.findOptimalUpstreamPeers(peerLocation)
          .filter(id => id !== bottleneckNodeId);
        
        if (newUpstreams.length > 0) {
          // 새 업스트림에 연결
          const peer = this.peers.get(peerId);
          const newUpstreamId = newUpstreams[0];
          
          if (peer) {
            // 토폴로지 업데이트
            const currentUpstreams = this.topology.get(bottleneckNodeId) || [];
            const peerIndex = currentUpstreams.indexOf(peerId);
            
            if (peerIndex !== -1) {
              currentUpstreams.splice(peerIndex, 1);
              this.topology.set(bottleneckNodeId, currentUpstreams);
            }
            
            const newUpstreamPeers = this.topology.get(newUpstreamId) || [];
            newUpstreamPeers.push(peerId);
            this.topology.set(newUpstreamId, newUpstreamPeers);
            
            // 실제 연결 재설정
            peer.connectToUpstream(newUpstreamId, this.signalingChannel);
          }
        }
      }
    }
  }
  
  // 오퍼 처리
  private async handleOffer(fromPeerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(fromPeerId);
    
    if (peer) {
      await peer.handleDownstreamConnection(fromPeerId, offer, this.signalingChannel);
    }
  }
  
  // 응답 처리
  private async handleAnswer(fromPeerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    // 응답 처리 로직
  }
  
  // ICE 후보 처리
  private async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidate): Promise<void> {
    // ICE 후보 처리 로직
    const peer = this.peers.get(fromPeerId);
    if (!peer) return;
    
    // 업스트림 또는 다운스트림 연결에 ICE 후보 추가
    // 실제 구현에서는 적절한 연결에 후보 추가
  }
  
  // 피어 참가 처리
  private async handlePeerJoin(peerId: string, peerInfo: any): Promise<void> {
    // 새 피어 생성
    const location = peerInfo.location;
    await this.addPeer(peerId, location);
    
    // 새 피어에게 최적의 업스트림 피어 할당
    const optimalUpstreams = this.findOptimalUpstreamPeers(location);
    
    // 토폴로지 업데이트 및 연결 설정
    for (const upstreamId of optimalUpstreams) {
      if (!this.topology.has(upstreamId)) {
        this.topology.set(upstreamId, []);
      }
      
      this.topology.get(upstreamId)?.push(peerId);
      
      // 연결 설정
      const peer = this.peers.get(peerId);
      if (peer) {
        await peer.connectToUpstream(upstreamId, this.signalingChannel);
      }
    }
  }
  
  // 피어 이탈 처리
  private async handlePeerLeave(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    // 연결 종료
    await peer.disconnect();
    
    // 토폴로지에서 제거
    for (const [nodeId, connections] of this.topology.entries()) {
      const index = connections.indexOf(peerId);
      if (index !== -1) {
        connections.splice(index, 1);
        this.topology.set(nodeId, connections);
      }
    }
    
    this.topology.delete(peerId);
    this.peers.delete(peerId);
    
    // 영향받는 다운스트림 피어들 재연결
    const affectedPeers = this.findAffectedPeers(peerId);
    for (const affectedId of affectedPeers) {
      const affectedPeer = this.peers.get(affectedId);
      if (affectedPeer) {
        const location = affectedPeer.getStats().location;
        if (location) {
          const newUpstreams = this.findOptimalUpstreamPeers(location);
          for (const upstreamId of newUpstreams) {
            await affectedPeer.connectToUpstream(upstreamId, this.signalingChannel);
            
            // 토폴로지 업데이트
            if (!this.topology.has(upstreamId)) {
              this.topology.set(upstreamId, []);
            }
            this.topology.get(upstreamId)?.push(affectedId);
          }
        }
      }
    }
    
    // 네트워크 최적화 트리거
    this.optimizeNetworkTopology();
  }
  
  // 이탈한 피어로 인해 영향받는 다운스트림 피어 찾기
  private findAffectedPeers(peerId: string): string[] {
    return this.topology.get(peerId) || [];
  }
  
  // 네트워크 상태 모니터링
  async monitorNetworkHealth(): Promise<() => void> {
    const monitoringInterval = setInterval(async () => {
      try {
        // 각 피어의 네트워크 상태 업데이트
        const updatePromises: Promise<void>[] = [];
        for (const peer of this.peers.values()) {
          updatePromises.push(peer.updateNetworkStats());
        }
        await Promise.all(updatePromises);
        
        // 토폴로지 최적화 필요 여부 확인
        if (this.needsOptimization()) {
          this.optimizeNetworkTopology();
        }
      } catch (error) {
        console.error('네트워크 상태 모니터링 오류:', error);
      }
    }, 10000); // 10초마다 모니터링
    
    return () => clearInterval(monitoringInterval);
  }
  
  // 최적화 필요 여부 확인
  private needsOptimization(): boolean {
    // 병목 노드 수 확인
    const bottlenecks = this.detectBottlenecks();
    return bottlenecks.length > 0;
  }
  
  // 네트워크 토폴로지 시각화 데이터 생성
  getNetworkVisualizationData(): any {
    const nodes = Array.from(this.peers.values()).map(peer => {
      const stats = peer.getStats();
      return {
        id: stats.id,
        label: stats.id.substring(0, 8),
        size: 10 + stats.relayCount * 5,
        color: stats.id === this.sourceNodeId ? '#FF5733' : '#3388FF',
        stats: {
          bandwidth: stats.bandwidth,
          latency: stats.latency,
          relayCount: stats.relayCount
        }
      };
    });
    
    const edges: NetworkEdge[] = []; 
    for (const [sourceId, targets] of this.topology.entries()) {
      for (const targetId of targets) {
        edges.push({
          from: sourceId,
          to: targetId,
          arrows: 'to',
          color: { color: '#848484', opacity: 0.8 }
        });
      }
    }
    
    return { nodes, edges };
  }
}
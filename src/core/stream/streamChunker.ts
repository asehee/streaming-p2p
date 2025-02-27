import { StreamChunk } from '../../types';

export class StreamChunker {
  private mediaStream: MediaStream;
  private chunkSize: number = 16 * 1024; // 16KB
  private sequenceNumber: number = 0;
  private sourceId: string;
  private chunkListeners: ((chunk: StreamChunk) => void)[] = [];
  private isChunking: boolean = false;
  
  constructor(mediaStream: MediaStream, sourceId: string) {
    this.mediaStream = mediaStream;
    this.sourceId = sourceId;
  }
  
  // 청크 생성 시작
  startChunking(): void {
    if (this.isChunking) return;
    this.isChunking = true;
    
    // MediaRecorder를 사용하여 스트림 청크 생성
    const recorder = new MediaRecorder(this.mediaStream, {
      mimeType: 'video/webm;codecs=vp8,opus', // 또는 지원되는 다른 코덱
      videoBitsPerSecond: 1_000_000, // 1Mbps
      audioBitsPerSecond: 128_000 // 128kbps
    });
    
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.processChunk(event.data);
      }
    };
    
    recorder.onstop = () => {
      this.isChunking = false;
    };
    
    // 100ms마다 청크 생성 (실시간 스트리밍에 적합)
    recorder.start(100);
  }
  
  // 청크 처리
  private async processChunk(blob: Blob): Promise<void> {
    try {
      // Blob을 ArrayBuffer로 변환
      const buffer = await blob.arrayBuffer();
      
      // 청크 크기에 맞게 분할
      const totalChunks = Math.ceil(buffer.byteLength / this.chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, buffer.byteLength);
        const chunkData = buffer.slice(start, end);
        
        // 스트림 청크 생성
        const streamChunk: StreamChunk = {
          id: `${this.sourceId}-${this.sequenceNumber}`,
          timestamp: Date.now(),
          data: chunkData,
          seqNumber: this.sequenceNumber++,
          sourceId: this.sourceId,
          mimeType: blob.type
        };
        
        // 청크 이벤트 발생
        this.notifyChunkListeners(streamChunk);
      }
    } catch (error) {
      console.error('미디어 청크 처리 오류:', error);
    }
  }
  
  // 청크 리스너 등록
  addChunkListener(listener: (chunk: StreamChunk) => void): void {
    this.chunkListeners.push(listener);
  }
  
  // 청크 리스너 제거
  removeChunkListener(listener: (chunk: StreamChunk) => void): void {
    const index = this.chunkListeners.indexOf(listener);
    if (index !== -1) {
      this.chunkListeners.splice(index, 1);
    }
  }
  
  // 청크 리스너들에게 알림
  private notifyChunkListeners(chunk: StreamChunk): void {
    for (const listener of this.chunkListeners) {
      listener(chunk);
    }
  }
  
  // 청크 생성 중지
  stopChunking(): void {
    this.isChunking = false;
  }
}
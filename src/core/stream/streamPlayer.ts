import { StreamChunk } from '../../types';

export class StreamPlayer {
  private videoElement: HTMLVideoElement;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private bufferQueue: StreamChunk[] = [];
  private isProcessingQueue: boolean = false;
  private lastSequenceNumber: number = -1;
  
  constructor(videoElement: HTMLVideoElement) {
    this.videoElement = videoElement;
    this.initMediaSource();
  }
  
  // MediaSource 초기화
  private initMediaSource(): void {
    this.mediaSource = new MediaSource();
    this.videoElement.src = URL.createObjectURL(this.mediaSource);
    
    this.mediaSource.addEventListener('sourceopen', () => {
      // 소스 버퍼 생성 (실제 구현에서는 지원되는 코덱 확인 필요)
      try {
        this.sourceBuffer = this.mediaSource!.addSourceBuffer('video/webm; codecs="vp8, opus"');
        
        this.sourceBuffer.addEventListener('updateend', () => {
          this.processBufferQueue();
        });
      } catch (error) {
        console.error('소스 버퍼 생성 오류:', error);
      }
    });
  }
  
  // 스트림 청크 추가
  addStreamChunk(chunk: StreamChunk): void {
    // 시퀀스 번호 확인 (순서대로 처리)
    if (chunk.seqNumber <= this.lastSequenceNumber) {
      // 이미 처리된 청크는 무시
      return;
    }
    
    // 버퍼 큐에 추가
    this.bufferQueue.push(chunk);
    
    // 시퀀스 순서대로 정렬
    this.bufferQueue.sort((a, b) => a.seqNumber - b.seqNumber);
    
    // 큐 처리 시작
    if (!this.isProcessingQueue) {
      this.processBufferQueue();
    }
  }
  
  // 버퍼 큐 처리
  private processBufferQueue(): void {
    if (this.isProcessingQueue || this.bufferQueue.length === 0 || !this.sourceBuffer) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    // 소스 버퍼가 업데이트 중이면 대기
    if (this.sourceBuffer.updating) {
      this.isProcessingQueue = false;
      return;
    }
    
    // 다음 연속된 청크 찾기
    let nextIndex = 0;
    while (nextIndex < this.bufferQueue.length && 
          (this.lastSequenceNumber === -1 || 
           this.bufferQueue[nextIndex].seqNumber === this.lastSequenceNumber + 1)) {
      nextIndex++;
      this.lastSequenceNumber++;
    }
    
    if (nextIndex > 0) {
      // 처리할 청크들 추출
      const chunksToProcess = this.bufferQueue.splice(0, nextIndex);
      
      // 청크 데이터 결합
      const combinedData = new Uint8Array(
        chunksToProcess.reduce((acc, chunk) => acc + (chunk.data as ArrayBuffer).byteLength, 0)
      );
      
      let offset = 0;
      for (const chunk of chunksToProcess) {
        const data = new Uint8Array(chunk.data as ArrayBuffer);
        combinedData.set(data, offset);
        offset += data.byteLength;
      }
      
      // 소스 버퍼에 추가
      try {
        this.sourceBuffer.appendBuffer(combinedData);
      } catch (error) {
        console.error('버퍼 추가 오류:', error);
        this.isProcessingQueue = false;
      }
    } else {
      this.isProcessingQueue = false;
    }
  }
  
  // 재생 시작
  play(): void {
    this.videoElement.play()
      .catch(error => {
        console.error('비디오 재생 오류:', error);
      });
  }
  
  // 재생 일시 정지
  pause(): void {
    this.videoElement.pause();
  }
  
  // 자원 해제
  dispose(): void {
    this.pause();
    
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.mediaSource.endOfStream();
    }
    
    this.bufferQueue = [];
    this.lastSequenceNumber = -1;
    this.isProcessingQueue = false;
  }
}
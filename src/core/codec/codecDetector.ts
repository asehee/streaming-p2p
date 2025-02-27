import { CodecSupportInfo } from '../../types';

export class CodecDetector {
  async detectSupportedCodecs(): Promise<CodecSupportInfo[]> {
    const codecsToTest = [
      { name: "H.264", mimeType: 'video/mp4; codecs="avc1.42E01E"' },
      { name: "VP8", mimeType: 'video/webm; codecs="vp8"' },
      { name: "VP9", mimeType: 'video/webm; codecs="vp9"' },
      { name: "AV1", mimeType: 'video/webm; codecs="av01"' }
    ];
    
    if ('mediaCapabilities' in navigator) {
      const results = await Promise.all(
        codecsToTest.map(async (codec) => {
          try {
            const support = await navigator.mediaCapabilities.decodingInfo({
              type: 'file',
              video: {
                contentType: codec.mimeType,
                width: 1920,
                height: 1080,
                bitrate: 2000000,
                framerate: 30
              }
            });
            
            return {
              name: codec.name,
              supported: support.supported,
              smooth: support.smooth,
              powerEfficient: support.powerEfficient
            };
          } catch (error) {
            return {
              name: codec.name,
              supported: false
            };
          }
        })
      );
      
      return results;
    } 
    
    else if ('MediaRecorder' in window) {
      return codecsToTest.map(codec => ({
        name: codec.name,
        supported: MediaRecorder.isTypeSupported(codec.mimeType)
      }));
    }
    
    else {
      const videoElement = document.createElement('video');
      return codecsToTest.map(codec => ({
        name: codec.name,
        supported: videoElement.canPlayType(codec.mimeType) !== ''
      }));
    }
  }

  async selectOptimalCodec(): Promise<string> {
    const supportedCodecs = await this.detectSupportedCodecs();
    
    // 지원되는 코덱 중에서 우선순위에 따라 선택
    const codecPriority = ["AV1", "VP9", "H.264", "VP8"];
    
    for (const codec of codecPriority) {
      const found = supportedCodecs.find(c => c.name === codec && c.supported);
      if (found) {
        return found.name;
      }
    }
    
    // 기본값
    return "VP8";
  }
}
# P2P 메시 네트워크 기반 라이브 스트리밍 SDK

초저지연 P2P 메시 네트워크를 활용한 WebRTC 기반 라이브 스트리밍 SDK입니다. 
이 SDK를 사용하면 중앙 서버 의존도를 낮추면서도 다수의 시청자에게 고품질의 스트림을 전달할 수 있습니다.

## 특징

### 초저지연 메시 네트워크
- WebRTC 데이터 채널 최적화로 실시간에 가까운 스트리밍 제공
- 일반 CDN 스트리밍(5-30초 지연)보다 훨씬 빠른 반응성

### 지능형 네트워크 토폴로지
- 지리적 위치, 네트워크 상태, 하드웨어 성능 등을 고려한 최적 연결 구성
- 병목 현상 자동 감지 및 토폴로지 최적화

### 적응형 품질 조절
- 네트워크 및 디바이스 환경에 따른 동적 비트레이트, 해상도 조절
- MediaCapabilities API를 활용한 디바이스별 최적 코덱 자동 선택
- 다양한 코덱(VP8, H.264, VP9) 지원

## 시작하기

```bash
# 저장소 복제
git clone https://github.com/yourusername/p2p-mesh-streaming.git

# 의존성 설치
cd p2p-mesh-streaming
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

### 기본 사용법

#### 스트리머로 사용하기

```javascript
import { createStreamingSDK } from 'p2p-mesh-streaming';

// SDK 초기화
const streamingSdk = createStreamingSDK({
  roomId: 'unique-room-id',
  config: {
    signalingServer: 'wss://your-signaling-server.com'
  }
});

// 이벤트 리스너 등록
streamingSdk.on('connect', () => {
  console.log('시그널링 서버에 연결되었습니다');
});

streamingSdk.on('error', (error) => {
  console.error('오류 발생:', error);
});

// 스트리밍 시작
async function startStream() {
  const stream = await streamingSdk.startStreaming({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    },
    audio: true
  });

  // 로컬 미리보기 표시
  const videoElement = document.getElementById('local-video');
  videoElement.srcObject = stream;
  videoElement.play();
}

// 스트리밍 중지
function stopStream() {
  streamingSdk.stop();
}

// 스트림 품질 변경
function changeQuality(quality) {
  // 'low', 'medium', 'high', 'auto' 중 선택
  streamingSdk.changeStreamQuality(quality);
}
```

#### 시청자로 사용하기

```javascript
import { createStreamingSDK } from 'p2p-mesh-streaming';

// SDK 초기화 (같은 roomId 사용)
const streamingSdk = createStreamingSDK({
  roomId: 'unique-room-id',
  config: {
    signalingServer: 'wss://your-signaling-server.com'
  }
});

// 이벤트 리스너 등록
streamingSdk.on('connect', () => {
  console.log('시그널링 서버에 연결되었습니다');
});

streamingSdk.on('error', (error) => {
  console.error('오류 발생:', error);
});

// 시청 시작
async function startViewing() {
  const videoElement = document.getElementById('remote-video');
  await streamingSdk.startViewing(videoElement);
}

// 시청 중지
function stopViewing() {
  streamingSdk.stop();
}

// 네트워크 통계 가져오기
function getNetworkStats() {
  const stats = streamingSdk.getNetworkStats();
  console.log('네트워크 통계:', stats);
}
```

## 개발 및 테스트

### 테스트 모드 사용

실제 카메라와 시그널링 서버 없이도 개발 및 테스트를 진행할 수 있습니다:

```javascript
// 테스트 모드로 SDK 초기화
const streamingSdk = createStreamingSDK({
  roomId: 'test-room',
  config: {
    testMode: true // 테스트 모드 활성화
  }
});
```

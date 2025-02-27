document.addEventListener('DOMContentLoaded', () => {
    const P2PMeshStreaming = window.P2PMeshStreaming;
    let streamingSdk = null;
    let currentRoomId = generateRoomId();
    
    // 요소 참조
    const streamerModeBtn = document.getElementById('streamer-mode-btn');
    const viewerModeBtn = document.getElementById('viewer-mode-btn');
    const streamerSection = document.getElementById('streamer-section');
    const viewerSection = document.getElementById('viewer-section');
    const roomIdDisplay = document.getElementById('room-id-display');
    const copyRoomIdBtn = document.getElementById('copy-room-id');
    const viewerCountDisplay = document.getElementById('viewer-count-display');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const roomIdInput = document.getElementById('room-id-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const stopStreamBtn = document.getElementById('stop-stream-btn');
    const stopViewingBtn = document.getElementById('stop-viewing-btn');
    const qualityBtns = document.querySelectorAll('.quality-btn');
    const microphoneBtn = document.getElementById('microphone-btn');
    const cameraBtn = document.getElementById('camera-btn');
    const shareScreenBtn = document.getElementById('share-screen-btn');
    
    // 방 ID 표시
    roomIdDisplay.textContent = currentRoomId;
    
    // 방 ID 복사
    copyRoomIdBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(currentRoomId)
        .then(() => {
          alert('방 ID가 클립보드에 복사되었습니다.');
        })
        .catch(err => {
          console.error('복사 실패:', err);
        });
    });
    
    // 모드 전환
    streamerModeBtn.addEventListener('click', () => {
      setActiveMode('streamer');
    });
    
    viewerModeBtn.addEventListener('click', () => {
      setActiveMode('viewer');
    });
    
    // 품질 설정 버튼
    qualityBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const quality = e.target.getAttribute('data-quality');
        setActiveQuality(e.target);
        
        if (streamingSdk) {
          streamingSdk.changeStreamQuality(quality)
            .catch(error => console.error('품질 변경 오류:', error));
        }
      });
    });
    
    // 스트리밍 시작
    async function startStreaming() {
      try {
        if (streamingSdk) {
          streamingSdk.dispose();
        }
        
        streamingSdk = P2PMeshStreaming.createStreamingSDK({
            roomId: currentRoomId,
            config: {
              testMode: true, // 테스트 모드 활성화
              useLocalSignaling: true // 로컬 시그널링 사용
            }
          });
        
        setupEventListeners();
        
        const stream = await streamingSdk.startStreaming({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });
        
        localVideo.srcObject = stream;
        
        // 네트워크 통계 정기 업데이트
        startNetworkStatsMonitoring();
        
      } catch (error) {
        console.error('스트리밍 시작 오류:', error);
        alert('스트리밍을 시작할 수 없습니다. 브라우저 콘솔을 확인하세요.');
      }
    }
    
    // 시청 시작
    async function startViewing(roomId) {
      try {
        if (!roomId) {
          alert('방 ID를 입력해주세요.');
          return;
        }
        
        if (streamingSdk) {
          streamingSdk.dispose();
        }
        
        streamingSdk = P2PMeshStreaming.createStreamingSDK({
          roomId: roomId,
          config: {
            signalingServer: 'wss://example.com/signaling'
          }
        });
        
        setupEventListeners();
        
        await streamingSdk.startViewing(remoteVideo);
        
        // 시청 화면 표시
        document.querySelector('#viewer-section .join-container').style.display = 'none';
        document.querySelector('#viewer-section .video-container').style.display = 'block';
        
        // 네트워크 통계 정기 업데이트
        startViewerNetworkStatsMonitoring();
        
      } catch (error) {
        console.error('시청 시작 오류:', error);
        alert('스트림 시청을 시작할 수 없습니다. 브라우저 콘솔을 확인하세요.');
      }
    }
    
    // 스트리밍/시청 중지
    function stopStream() {
      if (streamingSdk) {
        streamingSdk.stop();
        streamingSdk.dispose();
        streamingSdk = null;
        
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        
        // 시청자 모드 리셋
        document.querySelector('#viewer-section .join-container').style.display = 'block';
        document.querySelector('#viewer-section .video-container').style.display = 'none';
      }
    }
    
    // 이벤트 리스너 설정
    function setupEventListeners() {
      streamingSdk.on('connect', () => {
        console.log('시그널링 서버에 연결됨');
      });
      
      streamingSdk.on('streamStart', (stream) => {
        console.log('스트림 시작됨', stream);
      });
      
      streamingSdk.on('streamStop', () => {
        console.log('스트림 종료됨');
      });
      
      streamingSdk.on('error', (error) => {
        console.error('스트리밍 오류:', error);
      });
    }
    
    // 네트워크 통계 모니터링
    function startNetworkStatsMonitoring() {
      const statsInterval = setInterval(() => {
        if (!streamingSdk) {
          clearInterval(statsInterval);
          return;
        }
        
        const stats = streamingSdk.getNetworkStats();
        updateNetworkStats(stats, 'network-stats');
        updateNetworkGraph(stats, 'network-graph');
      }, 2000);
    }
    
    // 시청자 네트워크 통계 모니터링
    function startViewerNetworkStatsMonitoring() {
      const statsInterval = setInterval(() => {
        if (!streamingSdk) {
          clearInterval(statsInterval);
          return;
        }
        
        const stats = streamingSdk.getNetworkStats();
        updateNetworkStats(stats, 'viewer-network-stats');
        updateNetworkGraph(stats, 'viewer-network-graph');
      }, 2000);
    }
    
    // 네트워크 통계 업데이트
    function updateNetworkStats(stats, elementId) {
      const statsElement = document.getElementById(elementId);
      if (!statsElement || !stats) return;
      
      // 간단한 통계 표시 (실제 구현에서는 더 상세한 정보 표시)
      statsElement.innerHTML = `
        <div>연결된 피어: ${stats.nodes.length}</div>
        <div>연결 수: ${stats.edges.length}</div>
      `;
    }
    
    // 네트워크 그래프 업데이트 (실제 구현에서는 vis.js 등 사용)
    function updateNetworkGraph(stats, elementId) {
      const graphElement = document.getElementById(elementId);
      if (!graphElement || !stats) return;
      
      // 여기서는 간단한 구현만 포함 (실제로는 그래프 라이브러리 사용)
      let html = '<div style="padding: 10px;">';
      html += '<strong>노드:</strong><br>';
      
      stats.nodes.forEach(node => {
        html += `<div style="margin: 5px 0; padding: 5px; background-color: ${node.color}; color: white; border-radius: 4px;">
          ${node.label} (릴레이: ${node.stats.relayCount})
        </div>`;
      });
      
      html += '</div>';
      graphElement.innerHTML = html;
    }
    
    // 활성 모드 설정
    function setActiveMode(mode) {
      // 기존 스트림 중지
      stopStream();
      
      // 버튼 상태 업데이트
      streamerModeBtn.classList.toggle('active', mode === 'streamer');
      viewerModeBtn.classList.toggle('active', mode === 'viewer');
      
      // 섹션 표시/숨김
      streamerSection.style.display = mode === 'streamer' ? 'block' : 'none';
      viewerSection.style.display = mode === 'viewer' ? 'block' : 'none';
      
      // 스트리머 모드인 경우 자동 시작
      if (mode === 'streamer') {
        currentRoomId = generateRoomId();
        roomIdDisplay.textContent = currentRoomId;
        startStreaming();
      }
    }
    
    // 활성 품질 설정
    function setActiveQuality(button) {
      qualityBtns.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    }
    
    // 고유한 방 ID 생성
    function generateRoomId() {
      return 'room-' + Math.random().toString(36).substring(2, 9);
    }
    
    // 버튼 이벤트
    stopStreamBtn.addEventListener('click', () => {
      stopStream();
      currentRoomId = generateRoomId();
      roomIdDisplay.textContent = currentRoomId;
    });
    
    stopViewingBtn.addEventListener('click', () => {
      stopStream();
    });
    
    joinRoomBtn.addEventListener('click', () => {
      const roomId = roomIdInput.value.trim();
      startViewing(roomId);
    });
    
    // 마이크, 카메라, 화면 공유 제어 (간단한 토글만 구현)
    microphoneBtn.addEventListener('click', () => {
      microphoneBtn.classList.toggle('active');
      
      if (localVideo.srcObject) {
        const audioTracks = localVideo.srcObject.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = microphoneBtn.classList.contains('active');
        });
      }
    });
    
    cameraBtn.addEventListener('click', () => {
      cameraBtn.classList.toggle('active');
      
      if (localVideo.srcObject) {
        const videoTracks = localVideo.srcObject.getVideoTracks();
        videoTracks.forEach(track => {
          track.enabled = cameraBtn.classList.contains('active');
        });
      }
    });
    
    shareScreenBtn.addEventListener('click', async () => {
      // 실제 구현에서는 화면 공유 로직 구현
      alert('화면 공유 기능은 현재 구현되지 않았습니다.');
    });
    
    // 기본적으로 스트리머 모드로 시작
    setActiveMode('streamer');
  });
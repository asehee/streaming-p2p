// src/core/transport/signalingInterface.ts
export interface SignalingInterface {
    onOffer: ((fromPeerId: string, offer: RTCSessionDescriptionInit) => void) | null;
    onAnswer: ((fromPeerId: string, answer: RTCSessionDescriptionInit) => void) | null;
    onIceCandidate: ((fromPeerId: string, candidate: RTCIceCandidate) => void) | null;
    onPeerJoin: ((peerId: string, peerInfo: any) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
    onConnected: (() => void) | null;
    onDisconnected: (() => void) | null;
    onError: ((error: Error) => void) | null;
    
    send(message: any): void;
    sendOffer(toPeerId: string, offer: RTCSessionDescriptionInit): void;
    sendAnswer(toPeerId: string, answer: RTCSessionDescriptionInit): void;
    sendIceCandidate(toPeerId: string, candidate: RTCIceCandidate): void;
    close(): void;
  }
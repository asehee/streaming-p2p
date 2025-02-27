export class EventEmitter {
    private listeners: Map<string, Function[]> = new Map();
    
    // 이벤트 리스너 등록
    on(event: string, listener: Function): () => void {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      
      this.listeners.get(event)!.push(listener);
      
      // 리스너 제거 함수 반환
      return () => {
        this.off(event, listener);
      };
    }
    
    // 이벤트 리스너 제거
    off(event: string, listener: Function): void {
      if (!this.listeners.has(event)) return;
      
      const listeners = this.listeners.get(event)!;
      const index = listeners.indexOf(listener);
      
      if (index !== -1) {
        listeners.splice(index, 1);
        
        if (listeners.length === 0) {
          this.listeners.delete(event);
        } else {
          this.listeners.set(event, listeners);
        }
      }
    }
    
    // 이벤트 발생
    emit(event: string, ...args: any[]): void {
      if (!this.listeners.has(event)) return;
      
      const listeners = this.listeners.get(event)!;
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`"${event}" 이벤트 리스너에서 오류:`, error);
        }
      }
    }
    
    // 모든 리스너 제거
    removeAllListeners(event?: string): void {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
    }
  }
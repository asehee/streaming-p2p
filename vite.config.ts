import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'P2PMeshStreaming',
      fileName: (format) => `p2p-mesh-streaming.${format}.js`
    },
    rollupOptions: {
      output: {
        globals: {
          'P2PMeshStreaming': 'P2PMeshStreaming'
        }
      }
    }
  },
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
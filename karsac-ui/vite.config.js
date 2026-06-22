import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_KARSAC_API_TARGET || 'http://127.0.0.1:3210';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 4175,
      strictPort: true,
      watch: {
        usePolling: true,
        interval: 200,
      },
      proxy: {
        '/api': proxyTarget,
        '/v1': proxyTarget,
      },
    },
  };
});

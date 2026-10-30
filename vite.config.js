import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: /ask goes to the local agent server. Prod: set VITE_API_URL to the Kuberns URL.
export default defineConfig({ plugins: [react()], server: { proxy: { '/ask': 'http://localhost:8765' } } });

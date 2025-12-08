import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 5173,
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: [
          'context/**/*.{test,spec}.{ts,tsx}',
          'components/**/*.{test,spec}.{ts,tsx}',
          'pages/**/*.{test,spec}.{ts,tsx}',
          'services/**/*.{test,spec}.{ts,tsx}',
          'src/**/*.{test,spec}.{ts,tsx}',
        ],
        exclude: ['node_modules', 'server', 'dist'],
        testTimeout: 10000,
        pool: 'vmForks',
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          exclude: [
            'node_modules/',
            'src/test/',
            '**/*.d.ts',
            '**/*.config.*',
            'server/',
          ],
        },
      },
    };
});

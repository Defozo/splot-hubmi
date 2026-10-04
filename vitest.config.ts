import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'domain/**/*.test.ts', 'convex/**/*.test.ts'], environment: 'edge-runtime', testTimeout: 15000, maxWorkers: 2 } });

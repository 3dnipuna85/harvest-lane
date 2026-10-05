import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PUBLIC_FILES = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

/** Writes dist/sw.js with every built file in its precache list, so the game works offline after the first visit. */
function serviceWorker(): Plugin {
  return {
    name: 'harvest-lane-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter(f => f !== 'index.html').map(f => '/' + f);
      const sprites = readdirSync('public/ui').map(f => '/ui/' + f);
      const files = [...PUBLIC_FILES, ...sprites, ...built];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10);
      const source = readFileSync('sw/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  // Listen on the local network so the game can be tested on a phone or iPad over Wi-Fi.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});

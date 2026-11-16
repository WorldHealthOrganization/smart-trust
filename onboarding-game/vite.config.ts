import { defineConfig } from 'vite';

// base './' so the built game can be dropped into any folder on a server
export default defineConfig({
  base: './',
  server: { port: 5199 },
});

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://haimanot.dev',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});

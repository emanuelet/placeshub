// app.config.ts

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'vite'

var app_config_default = defineConfig({
  plugins: [
    tanstackRouter({ generatedRouteTree: './app/routeTree.gen.ts' }),
    tanstackStart({ srcDirectory: 'app' }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})

export { app_config_default as default }

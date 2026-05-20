// app.config.ts

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { createApp } from 'vinxi'

var app_config_default = createApp({
  name: 'placeshub-web',
  routers: [
    {
      name: 'public',
      type: 'static',
      dir: './public',
    },
    {
      name: 'client',
      type: 'client',
      target: 'browser',
      plugins: () => [
        tanstackRouter({
          routesDirectory: './app/routes',
          generatedRouteTree: './app/routeTree.gen.ts',
        }),
        tanstackStart({ srcDirectory: 'app' }),
      ],
    },
    {
      name: 'ssr',
      type: 'http',
      target: 'server',
      plugins: () => [
        tanstackRouter({
          routesDirectory: './app/routes',
          generatedRouteTree: './app/routeTree.gen.ts',
        }),
        tanstackStart({ srcDirectory: 'app' }),
      ],
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})

export { app_config_default as default }

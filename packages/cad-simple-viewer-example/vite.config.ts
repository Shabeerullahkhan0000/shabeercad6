import { resolve } from 'path'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(() => {
  return {
    base: './',
    build: {
      modulePreload: false,
      minify: true,
      rollupOptions: {
        // Main entry point for the app
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    plugins: [
      viteStaticCopy({
        // Copy JavaScript worker bundle on purpose in order to demostrate how to config
        // worker file urls in AcApDocManager.createInstance
        targets: [
          {
            // Workers from workspace library package (symlinked via pnpm workspace)
            src: '../cad-simple-viewer/dist/libredwg-parser-worker.js',
            dest: 'workers'
          },
          {
            // Workers from data-model dependency package
            src: '../../node_modules/.pnpm/@mlightcad+data-model@1.7.34/node_modules/@mlightcad/data-model/dist/dxf-parser-worker.js',
            dest: 'workers'
          },
          {
            // Workers from mtext-renderer package (symlinked via pnpm workspace)
            src: '../../node_modules/.pnpm/node_modules/@mlightcad/mtext-renderer/dist/mtext-renderer-worker.js',
            dest: 'workers'
          }
        ]
      })
    ]
  }
})

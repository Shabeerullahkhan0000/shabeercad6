import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { defineConfig, PluginOption } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.ts',
      name: 'cad-simple-viewer',
      fileName: 'index'
    },
    minify: true
  },
  plugins: [
    peerDepsExternal() as PluginOption,
    viteStaticCopy({
      // Copy workers to library dist for workspace linking
      targets: [
        {
          src: './node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js',
          dest: ''
        },
        {
          src: './node_modules/@mlightcad/mtext-renderer/dist/mtext-renderer-worker.js',
          dest: ''
        },
        {
          // Copy dxf-parser from data-model (published package)
          src: './node_modules/@mlightcad/data-model/dist/dxf-parser-worker.js',
          dest: ''
        }
      ]
    })
  ]
})

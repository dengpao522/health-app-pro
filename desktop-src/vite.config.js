import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'web_dist',
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'rpx-to-vw',
          Declaration(prop) {
            if (prop.value && prop.value.includes('rpx')) {
              prop.value = prop.value.replace(/(\d+(\.\d+)?)rpx/g, (m, n) => {
                return (parseFloat(n) / 750 * 100).toFixed(6) + 'vw'
              })
            }
          }
        }
      ]
    }
  },
  server: {
    port: 3000
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드할 때마다 달라지는 버전 표시. 앱이 "새 버전이 있는지" 확인하는 데 써요 (version.json)
const BUILD_ID = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12) // 예: 202611140930

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: 'emit-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) })
      },
    },
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ARTIFACT_BUILD=1 이면 정적 단일 파일 프리뷰용 빌드:
// 모든 에셋(폰트 포함)을 data URI로 인라인하고 동적 청크를 하나로 합친다.
const artifactBuild = process.env.ARTIFACT_BUILD === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // 정적 단일 파일 프리뷰에서는 해시 라우터를 사용 (리라이트 불가 호스팅 대응)
    __USE_HASH_ROUTER__: JSON.stringify(artifactBuild),
  },
  build: artifactBuild
    ? {
        outDir: 'dist-artifact',
        assetsInlineLimit: 100_000_000,
        chunkSizeWarningLimit: 10_000,
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
})

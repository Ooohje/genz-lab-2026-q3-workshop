import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// base 는 GitHub Pages 하위 경로와 반드시 일치해야 한다.
// 레포명을 바꾸면 여기도 같이 바꿔야 배포본에서 에셋 404 가 안 난다.
export default defineConfig({
  base: '/genz-lab-2026-q3-workshop/',
  plugins: [react(), tailwindcss()],
})

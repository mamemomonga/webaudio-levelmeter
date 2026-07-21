import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages ではリポジトリ配下のサブパスで公開されるため、
// 相対パス基準でアセットを参照する。
export default defineConfig({
  base: './',
  plugins: [react()],
})

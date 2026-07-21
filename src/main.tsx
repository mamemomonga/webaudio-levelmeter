import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// ステレオ判定の平滑化・音声処理は同一インスタンスに依存するため、
// StrictMode による二重初期化は避ける。
const root = document.getElementById('root')

if (!root) {
  throw new Error('root element not found')
}

createRoot(root).render(<App />)

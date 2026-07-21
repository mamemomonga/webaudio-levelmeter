/// <reference types="vite/client" />

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }

  const sampleRate: number

  class AudioWorkletProcessor {
    readonly port: MessagePort
    constructor()
    process(
      inputs: Float32Array[][],
      outputs: Float32Array[][],
      parameters: Record<string, Float32Array>
    ): boolean
  }

  function registerProcessor(
    name: string,
    processorCtor: typeof AudioWorkletProcessor
  ): void
}

export {}

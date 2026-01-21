import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Hook for Lyria RealTime streaming via WebSocket
 * Connects to backend which proxies to Google Lyria API
 */
export function useLyriaRealtime(options = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioQueueRef = useRef([])
  const isProcessingRef = useRef(false)

  const wsUrl = options.wsUrl || 'ws://localhost:8000/ws/lyria'

  /**
   * Initialize AudioContext for playback
   */
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current

    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000 // Lyria outputs 48kHz
    })

    return audioContextRef.current
  }, [])

  /**
   * Process and play audio chunk
   */
  const processAudioChunk = useCallback(async (audioData) => {
    const ctx = audioContextRef.current
    if (!ctx) return

    try {
      // Convert ArrayBuffer to AudioBuffer
      // Lyria sends 16-bit PCM stereo at 48kHz
      const int16Array = new Int16Array(audioData)
      const float32Array = new Float32Array(int16Array.length)
      
      // Convert Int16 to Float32
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }

      // Create stereo buffer
      const numSamples = float32Array.length / 2
      const audioBuffer = ctx.createBuffer(2, numSamples, 48000)
      
      // Deinterleave stereo channels
      const leftChannel = audioBuffer.getChannelData(0)
      const rightChannel = audioBuffer.getChannelData(1)
      
      for (let i = 0; i < numSamples; i++) {
        leftChannel[i] = float32Array[i * 2]
        rightChannel[i] = float32Array[i * 2 + 1]
      }

      // Queue for playback
      audioQueueRef.current.push(audioBuffer)
      
      // Process queue
      if (!isProcessingRef.current) {
        processQueue()
      }

    } catch (err) {
      console.error('Audio processing error:', err)
    }
  }, [])

  /**
   * Process audio queue for seamless playback
   */
  const processQueue = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx || audioQueueRef.current.length === 0) {
      isProcessingRef.current = false
      return
    }

    isProcessingRef.current = true
    const buffer = audioQueueRef.current.shift()

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    
    source.onended = () => {
      processQueue()
    }
    
    source.start()
  }, [])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      try {
        wsRef.current = new WebSocket(wsUrl)

        wsRef.current.onopen = () => {
          console.log('🔌 Lyria WebSocket connected')
          setIsConnected(true)
          setError(null)
          initAudioContext()
          resolve()
        }

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'audio') {
              // Decode base64 audio
              const binaryString = atob(message.data)
              const bytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
              }
              processAudioChunk(bytes.buffer)
            } else if (message.type === 'error') {
              setError(message.error)
              console.error('Lyria error:', message.error)
            } else if (message.type === 'info') {
              console.log('Lyria info:', message.message)
            }
          } catch (err) {
            console.error('Message parse error:', err)
          }
        }

        wsRef.current.onerror = (err) => {
          console.error('WebSocket error:', err)
          setError('Connection error')
          reject(err)
        }

        wsRef.current.onclose = () => {
          console.log('🔌 Lyria WebSocket disconnected')
          setIsConnected(false)
          setIsPlaying(false)
        }

      } catch (err) {
        reject(err)
      }
    })
  }, [wsUrl, initAudioContext, processAudioChunk])

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setIsPlaying(false)
  }, [])

  /**
   * Send message to WebSocket
   */
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  /**
   * Set weighted prompts
   * @param {Array} prompts - Array of { text, weight } objects
   */
  const setPrompts = useCallback((prompts) => {
    send({
      type: 'set_prompts',
      prompts: prompts.map(p => ({
        text: p.text,
        weight: p.weight ?? 1.0
      }))
    })
    console.log('📝 Prompts sent:', prompts)
  }, [send])

  /**
   * Set music generation config
   * @param {Object} config - Lyria config options
   */
  const setConfig = useCallback((config) => {
    send({
      type: 'set_config',
      config: {
        bpm: config.bpm ?? 120,
        temperature: config.temperature ?? 1.0,
        density: config.density ?? 0.5,
        brightness: config.brightness ?? 0.5,
        guidance: config.guidance ?? 4.0,
        scale: config.scale ?? 'SCALE_UNSPECIFIED'
      }
    })
    console.log('⚙️ Config sent:', config)
  }, [send])

  /**
   * Start playback
   */
  const play = useCallback(async () => {
    // Resume audio context if suspended
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    
    send({ type: 'play' })
    setIsPlaying(true)
    console.log('▶️ Play sent')
  }, [send])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    send({ type: 'pause' })
    setIsPlaying(false)
    console.log('⏸️ Pause sent')
  }, [send])

  /**
   * Stop playback
   */
  const stop = useCallback(() => {
    send({ type: 'stop' })
    setIsPlaying(false)
    audioQueueRef.current = []
    console.log('⏹️ Stop sent')
  }, [send])

  /**
   * Update config based on hand position (for real-time modulation)
   */
  const updateFromHandPosition = useCallback((x, y, currentPrompts) => {
    // Map Y to density (0-1)
    const density = y

    // Map X to brightness (0-1)
    const brightness = x

    setConfig({ density, brightness })

    // Optionally add intensity modifiers to prompts
    if (y > 0.8) {
      const intensifiedPrompts = currentPrompts.map(p => ({
        ...p,
        text: p.text + ', intense, powerful'
      }))
      setPrompts(intensifiedPrompts)
    }
  }, [setConfig, setPrompts])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      disconnect()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [disconnect])

  return {
    // State
    isConnected,
    isPlaying,
    error,

    // Connection
    connect,
    disconnect,

    // Controls
    setPrompts,
    setConfig,
    play,
    pause,
    stop,

    // Real-time modulation
    updateFromHandPosition
  }
}

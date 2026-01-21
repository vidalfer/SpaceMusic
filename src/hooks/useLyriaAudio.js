import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Hook for Lyria RealTime audio streaming
 * Handles WebSocket connection and PCM audio playback
 */
export function useLyriaAudio() {
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(null)

  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const nextPlayTimeRef = useRef(0)
  const gainNodeRef = useRef(null)

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const WS_URL = API_URL.replace('http', 'ws') + '/ws/lyria'

  /**
   * Initialize Web Audio API
   */
  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return audioContextRef.current

    // Create AudioContext with Lyria's sample rate (48kHz)
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000
    })

    // Create master gain node
    gainNodeRef.current = ctx.createGain()
    gainNodeRef.current.gain.value = 0.8
    gainNodeRef.current.connect(ctx.destination)

    audioContextRef.current = ctx
    nextPlayTimeRef.current = ctx.currentTime

    console.log('🔊 AudioContext initialized (48kHz)')
    return ctx
  }, [])

  /**
   * Resume AudioContext (required after user interaction)
   */
  const resumeAudio = useCallback(async () => {
    const ctx = audioContextRef.current
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume()
      console.log('🔊 AudioContext resumed')
    }
  }, [])

  /**
   * Decode and play PCM audio chunk
   * Lyria sends: 16-bit PCM, 48kHz, stereo
   */
  const playAudioChunk = useCallback((base64Data) => {
    const ctx = audioContextRef.current
    if (!ctx || ctx.state !== 'running') return

    try {
      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      // Convert to Int16Array (16-bit PCM)
      const int16Data = new Int16Array(bytes.buffer)
      
      // Convert Int16 to Float32 (-1 to 1)
      const float32Data = new Float32Array(int16Data.length)
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0
      }

      // Deinterleave stereo (L R L R L R -> L L L, R R R)
      const numSamples = float32Data.length / 2
      const audioBuffer = ctx.createBuffer(2, numSamples, 48000)
      
      const leftChannel = audioBuffer.getChannelData(0)
      const rightChannel = audioBuffer.getChannelData(1)
      
      for (let i = 0; i < numSamples; i++) {
        leftChannel[i] = float32Data[i * 2]
        rightChannel[i] = float32Data[i * 2 + 1]
      }

      // Schedule playback
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer

      // Apply slight smoothing with gain envelope
      const chunkGain = ctx.createGain()
      chunkGain.gain.setValueAtTime(0, nextPlayTimeRef.current)
      chunkGain.gain.linearRampToValueAtTime(1, nextPlayTimeRef.current + 0.005)
      
      source.connect(chunkGain)
      chunkGain.connect(gainNodeRef.current)

      // Calculate start time (seamless playback)
      const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current)
      source.start(startTime)
      
      // Update next play time
      nextPlayTimeRef.current = startTime + audioBuffer.duration

    } catch (err) {
      console.error('Audio decode error:', err)
    }
  }, [])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    // Initialize audio first
    await initAudio()

    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to:', WS_URL)
        wsRef.current = new WebSocket(WS_URL)

        wsRef.current.onopen = () => {
          console.log('✅ WebSocket connected')
          setIsConnected(true)
          setError(null)
          resolve()
        }

        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'audio') {
              playAudioChunk(message.data)
            } else if (message.type === 'error') {
              console.error('Lyria error:', message.error)
              setError(message.error)
            } else if (message.type === 'info') {
              console.log('Lyria info:', message.message)
            }
          } catch (err) {
            console.error('Message parse error:', err)
          }
        }

        wsRef.current.onerror = (err) => {
          console.error('WebSocket error:', err)
          setError('Connection failed')
          reject(err)
        }

        wsRef.current.onclose = () => {
          console.log('🔌 WebSocket disconnected')
          setIsConnected(false)
          setIsPlaying(false)
        }

      } catch (err) {
        reject(err)
      }
    })
  }, [WS_URL, initAudio, playAudioChunk])

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
   * Send message via WebSocket
   */
  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  /**
   * Set weighted prompts
   */
  const setPrompts = useCallback((prompts) => {
    const success = send({
      type: 'set_prompts',
      prompts: prompts.map(p => ({
        text: p.text,
        weight: p.weight ?? 1.0
      }))
    })
    if (success) {
      console.log('📝 Prompts sent:', prompts.map(p => `${p.weight}x "${p.text.substring(0, 30)}..."`))
    }
  }, [send])

  /**
   * Set music generation config
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
  }, [send])

  /**
   * Start playback
   */
  const play = useCallback(async () => {
    await resumeAudio()
    
    // Reset play time
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime
    }
    
    send({ type: 'play' })
    setIsPlaying(true)
    console.log('▶️ Playback started')
  }, [send, resumeAudio])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    send({ type: 'pause' })
    setIsPlaying(false)
    console.log('⏸️ Playback paused')
  }, [send])

  /**
   * Stop playback
   */
  const stop = useCallback(() => {
    send({ type: 'stop' })
    setIsPlaying(false)
    console.log('⏹️ Playback stopped')
  }, [send])

  /**
   * Set master volume
   */
  const setVolume = useCallback((volume) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, volume)),
        audioContextRef.current.currentTime + 0.05
      )
    }
  }, [])

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
    setVolume,

    // Audio
    resumeAudio
  }
}

import { useState, useRef, useCallback, useEffect } from 'react'
import * as Tone from 'tone'

/**
 * Audio Engine Hook using Tone.js
 * Handles audio playback, DSP effects, and synchronization
 */
export function useAudioEngine() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [bpm, setBpm] = useState(120)
  const [currentBar, setCurrentBar] = useState(0)

  // Audio nodes refs for each orb
  const channelsRef = useRef({})
  const masterGainRef = useRef(null)
  const analyserRef = useRef(null)

  /**
   * Initialize the audio engine
   */
  const initAudio = useCallback(async () => {
    if (isReady) return

    try {
      // Start Tone.js context (requires user interaction)
      await Tone.start()
      console.log('🔊 Audio context started')

      // Configure Transport
      Tone.Transport.bpm.value = bpm
      Tone.Transport.timeSignature = [4, 4]

      // Create master gain
      masterGainRef.current = new Tone.Gain(0.8).toDestination()

      // Create analyser for visualizations
      analyserRef.current = new Tone.Analyser('waveform', 256)
      masterGainRef.current.connect(analyserRef.current)

      // Schedule bar counter
      Tone.Transport.scheduleRepeat((time) => {
        setCurrentBar((prev) => prev + 1)
      }, '1m') // Every measure

      setIsReady(true)
      console.log('✅ Audio engine initialized')

    } catch (error) {
      console.error('❌ Failed to initialize audio:', error)
    }
  }, [isReady, bpm])

  /**
   * Create an audio channel for an orb
   * Chain: Player -> Filter -> Gain -> Master
   */
  const createChannel = useCallback((orbId, options = {}) => {
    if (channelsRef.current[orbId]) {
      return channelsRef.current[orbId]
    }

    // Create nodes
    const player = new Tone.Player({
      loop: true,
      loopStart: 0,
      loopEnd: '2m', // 2 measures
      fadeIn: 0.05,
      fadeOut: 0.05
    })

    const filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 5000,
      rolloff: -12,
      Q: 1
    })

    const gain = new Tone.Gain(0.8)

    // Connect chain
    player.connect(filter)
    filter.connect(gain)
    gain.connect(masterGainRef.current)

    // Store channel
    const channel = {
      player,
      filter,
      gain,
      isLoaded: false,
      currentBuffer: null,
      pendingBuffer: null
    }

    channelsRef.current[orbId] = channel
    console.log(`🎚️ Created channel for: ${orbId}`)

    return channel
  }, [])

  /**
   * Load audio buffer into a channel
   */
  const loadAudio = useCallback(async (orbId, audioUrl) => {
    const channel = channelsRef.current[orbId] || createChannel(orbId)

    try {
      console.log(`📥 Loading audio for ${orbId}...`)
      
      const buffer = await Tone.Buffer.fromUrl(audioUrl)
      channel.pendingBuffer = buffer

      // If not playing, load immediately
      if (!channel.player.state === 'started') {
        channel.player.buffer = buffer
        channel.currentBuffer = buffer
        channel.isLoaded = true
      }

      console.log(`✅ Audio loaded for ${orbId}`)
      return true

    } catch (error) {
      console.error(`❌ Failed to load audio for ${orbId}:`, error)
      return false
    }
  }, [createChannel])

  /**
   * Schedule audio swap at next bar (seamless transition)
   */
  const scheduleSwap = useCallback((orbId) => {
    const channel = channelsRef.current[orbId]
    if (!channel || !channel.pendingBuffer) return

    // Schedule at next measure
    Tone.Transport.scheduleOnce((time) => {
      // Crossfade
      channel.gain.gain.linearRampTo(0, 0.1, time)
      
      Tone.Transport.scheduleOnce((innerTime) => {
        channel.player.buffer = channel.pendingBuffer
        channel.currentBuffer = channel.pendingBuffer
        channel.pendingBuffer = null
        channel.gain.gain.linearRampTo(0.8, 0.1, innerTime)
        console.log(`🎵 Audio swapped for ${orbId} at bar ${currentBar}`)
      }, '+0.1')
      
    }, '@1m') // At next measure

  }, [currentBar])

  /**
   * Control channel gain (mapped to hand Y position)
   * @param {string} orbId - Orb identifier
   * @param {number} value - Normalized value (0-1)
   */
  const setChannelGain = useCallback((orbId, value) => {
    const channel = channelsRef.current[orbId]
    if (!channel) return

    // Map to gain (0 to 1)
    const gain = Math.max(0, Math.min(1, value))
    channel.gain.gain.linearRampTo(gain, 0.05)
  }, [])

  /**
   * Control channel filter (mapped to hand X position)
   * @param {string} orbId - Orb identifier
   * @param {number} value - Normalized value (0-1)
   */
  const setChannelFilter = useCallback((orbId, value) => {
    const channel = channelsRef.current[orbId]
    if (!channel) return

    // Map to frequency (100Hz to 8000Hz, logarithmic)
    const minFreq = 100
    const maxFreq = 8000
    const frequency = minFreq * Math.pow(maxFreq / minFreq, value)
    channel.filter.frequency.linearRampTo(frequency, 0.05)
  }, [])

  /**
   * Start playback for an orb
   */
  const startChannel = useCallback((orbId) => {
    const channel = channelsRef.current[orbId]
    if (!channel || !channel.isLoaded) return

    // Start at next quantized beat
    channel.player.start('@4n')
    console.log(`▶️ Started channel: ${orbId}`)
  }, [])

  /**
   * Stop playback for an orb
   */
  const stopChannel = useCallback((orbId) => {
    const channel = channelsRef.current[orbId]
    if (!channel) return

    channel.player.stop()
    console.log(`⏹️ Stopped channel: ${orbId}`)
  }, [])

  /**
   * Start transport (global playback)
   */
  const play = useCallback(() => {
    if (!isReady) return
    Tone.Transport.start()
    setIsPlaying(true)
    console.log('▶️ Transport started')
  }, [isReady])

  /**
   * Stop transport
   */
  const stop = useCallback(() => {
    Tone.Transport.stop()
    setIsPlaying(false)
    setCurrentBar(0)
    console.log('⏹️ Transport stopped')
  }, [])

  /**
   * Set BPM
   */
  const setBPM = useCallback((newBpm) => {
    const clampedBpm = Math.max(60, Math.min(200, newBpm))
    Tone.Transport.bpm.value = clampedBpm
    setBpm(clampedBpm)
  }, [])

  /**
   * Get waveform data for visualization
   */
  const getWaveform = useCallback(() => {
    if (!analyserRef.current) return new Float32Array(256)
    return analyserRef.current.getValue()
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      
      Object.values(channelsRef.current).forEach((channel) => {
        channel.player.dispose()
        channel.filter.dispose()
        channel.gain.dispose()
      })
      
      masterGainRef.current?.dispose()
      analyserRef.current?.dispose()
    }
  }, [])

  return {
    // State
    isReady,
    isPlaying,
    bpm,
    currentBar,

    // Init
    initAudio,

    // Channel management
    createChannel,
    loadAudio,
    scheduleSwap,
    startChannel,
    stopChannel,

    // DSP Controls (real-time)
    setChannelGain,
    setChannelFilter,

    // Transport
    play,
    stop,
    setBPM,

    // Visualization
    getWaveform
  }
}

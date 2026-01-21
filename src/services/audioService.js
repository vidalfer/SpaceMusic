/**
 * Audio Service
 * Handles communication with backend API for music generation
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Request music evolution based on hand modifiers
 * @param {Object} params - Generation parameters
 * @param {string} params.basePrompt - Base prompt for the sound
 * @param {number} params.modifierX - X axis modifier (0-1) - affects complexity
 * @param {number} params.modifierY - Y axis modifier (0-1) - affects intensity
 * @param {number} params.seed - Random seed for reproducibility
 * @param {number} params.bpm - Beats per minute
 */
export async function evolveTrack({ basePrompt, modifierX, modifierY, seed, bpm = 120 }) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/evolve-track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_prompt: basePrompt,
        modifier_x: modifierX,
        modifier_y: modifierY,
        seed: seed || Math.floor(Math.random() * 2147483647),
        bpm
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    return data

  } catch (error) {
    console.error('❌ evolveTrack error:', error)
    throw error
  }
}

/**
 * Start a Lyria RealTime session via WebSocket
 * @param {Object} config - Session configuration
 * @returns {Object} Session controller
 */
export function createLyriaSession(config = {}) {
  const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws/lyria`
  let ws = null
  let audioContext = null
  let isConnected = false

  const callbacks = {
    onAudio: config.onAudio || (() => {}),
    onError: config.onError || console.error,
    onConnect: config.onConnect || (() => {}),
    onDisconnect: config.onDisconnect || (() => {})
  }

  const connect = () => {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        isConnected = true
        callbacks.onConnect()
        resolve()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          if (message.type === 'audio') {
            // Decode base64 audio chunk
            const audioData = base64ToArrayBuffer(message.data)
            callbacks.onAudio(audioData)
          } else if (message.type === 'error') {
            callbacks.onError(message.error)
          }
        } catch (err) {
          callbacks.onError(err)
        }
      }

      ws.onerror = (error) => {
        callbacks.onError(error)
        reject(error)
      }

      ws.onclose = () => {
        isConnected = false
        callbacks.onDisconnect()
      }
    })
  }

  const setPrompts = (prompts) => {
    if (!ws || !isConnected) return
    ws.send(JSON.stringify({
      type: 'set_prompts',
      prompts: prompts.map(p => ({
        text: p.text,
        weight: p.weight || 1.0
      }))
    }))
  }

  const setConfig = (config) => {
    if (!ws || !isConnected) return
    ws.send(JSON.stringify({
      type: 'set_config',
      config
    }))
  }

  const play = () => {
    if (!ws || !isConnected) return
    ws.send(JSON.stringify({ type: 'play' }))
  }

  const pause = () => {
    if (!ws || !isConnected) return
    ws.send(JSON.stringify({ type: 'pause' }))
  }

  const stop = () => {
    if (!ws || !isConnected) return
    ws.send(JSON.stringify({ type: 'stop' }))
  }

  const disconnect = () => {
    if (ws) {
      ws.close()
      ws = null
    }
  }

  return {
    connect,
    setPrompts,
    setConfig,
    play,
    pause,
    stop,
    disconnect,
    get isConnected() { return isConnected }
  }
}

/**
 * Helper: Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Generate modifier prompt based on position
 */
export function getModifierPrompt(x, y) {
  const modifiers = []

  // Y axis: Intensity
  if (y > 0.7) {
    modifiers.push('intense', 'powerful', 'loud')
  } else if (y < 0.3) {
    modifiers.push('soft', 'gentle', 'quiet')
  }

  // X axis: Complexity
  if (x > 0.7) {
    modifiers.push('complex', 'syncopated', 'varied')
  } else if (x < 0.3) {
    modifiers.push('simple', 'minimal', 'steady')
  }

  return modifiers.join(', ')
}

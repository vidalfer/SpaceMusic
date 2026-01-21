import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Multiplayer tracking hook
 * Captures webcam frames and sends to backend for YOLO + MediaPipe processing
 * Returns array of players with their hand positions and gestures
 */
export function useMultiplayerTracking() {
  // State
  const [players, setPlayers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState(null)
  
  // Refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const frameIntervalRef = useRef(null)
  
  // Config
  const WS_URL = 'ws://localhost:8000/ws/tracking'
  const FRAME_INTERVAL = 66 // ~15 FPS (balance between responsiveness and bandwidth)
  const JPEG_QUALITY = 0.7 // Lower = smaller files, faster transmission
  
  /**
   * Capture current video frame as base64 JPEG
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas || video.readyState < 2) {
      return null
    }
    
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0)
    
    // Convert to JPEG base64
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const base64 = dataUrl.split(',')[1]
    
    return base64
  }, [])
  
  /**
   * Send frame to backend for processing
   */
  const sendFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return
    }
    
    const frame = captureFrame()
    if (frame) {
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        data: frame
      }))
    }
  }, [captureFrame])
  
  /**
   * Connect to tracking WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }
    
    console.log('[MULTIPLAYER] Connecting to tracking server...')
    
    const ws = new WebSocket(WS_URL)
    
    ws.onopen = () => {
      console.log('[MULTIPLAYER] Connected to tracking server')
      setIsConnected(true)
      setError(null)
      
      // Start sending frames
      frameIntervalRef.current = setInterval(sendFrame, FRAME_INTERVAL)
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'players') {
          setPlayers(data.players || [])
          setIsTracking(data.players?.length > 0)
        } else if (data.type === 'info') {
          console.log('[MULTIPLAYER]', data.message)
        } else if (data.type === 'error') {
          console.error('[MULTIPLAYER] Error:', data.error)
          setError(data.error)
        }
      } catch (e) {
        console.error('[MULTIPLAYER] Parse error:', e)
      }
    }
    
    ws.onclose = () => {
      console.log('[MULTIPLAYER] Disconnected from tracking server')
      setIsConnected(false)
      setIsTracking(false)
      
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
    }
    
    ws.onerror = (err) => {
      console.error('[MULTIPLAYER] WebSocket error:', err)
      setError('Failed to connect to tracking server')
    }
    
    wsRef.current = ws
  }, [sendFrame])
  
  /**
   * Disconnect from tracking server
   */
  const disconnect = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current)
      frameIntervalRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsTracking(false)
  }, [])
  
  /**
   * Initialize webcam and tracking
   */
  const initialize = useCallback(async () => {
    setIsInitialized(false)
    setError(null)
    
    try {
      console.log('[MULTIPLAYER] Initializing webcam...')
      
      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })
      
      streamRef.current = stream
      
      // Create video element
      const video = document.createElement('video')
      video.setAttribute('playsinline', 'true')
      video.setAttribute('autoplay', 'true')
      video.setAttribute('muted', 'true')
      video.srcObject = stream
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play()
            .then(resolve)
            .catch(reject)
        }
        video.onerror = reject
        setTimeout(() => reject(new Error('Video timeout')), 10000)
      })
      
      videoRef.current = video
      console.log(`[MULTIPLAYER] Webcam ready: ${video.videoWidth}x${video.videoHeight}`)
      
      // Create canvas for frame capture
      canvasRef.current = document.createElement('canvas')
      
      // Connect to tracking server
      connect()
      
      setIsInitialized(true)
      console.log('[MULTIPLAYER] Initialization complete')
      
      return true
      
    } catch (err) {
      console.error('[MULTIPLAYER] Initialization error:', err)
      setError(err.message)
      setIsInitialized(true) // Mark as initialized even on error to stop loading
      throw err
    }
  }, [connect])
  
  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    disconnect()
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current = null
    }
    
    canvasRef.current = null
    setPlayers([])
  }, [disconnect])
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])
  
  return {
    // State
    players,
    isConnected,
    isTracking,
    isInitialized,
    error,
    
    // Refs (for UI preview)
    videoRef,
    
    // Methods
    initialize,
    cleanup,
    connect,
    disconnect
  }
}

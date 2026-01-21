import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Custom hook for hand tracking using MediaPipe
 * 
 * Gestures:
 * - Open hand: Cursor moves freely
 * - Pinch: Grab and drag orbs
 * - Closed fist: Rotate camera
 * 
 * Depth Detection:
 * - Uses hand size heuristic (larger hand = closer to camera)
 * - Fine-tuned with pinch distance when grabbing
 */
export function useHandTracking() {
  // State
  const [handPosition, setHandPosition] = useState({ x: 0.5, y: 0.5, z: 0.5 })
  const [isPinching, setIsPinching] = useState(false)
  const [isFist, setIsFist] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [handVelocity, setHandVelocity] = useState({ x: 0, y: 0 })
  const [handSize, setHandSize] = useState(0.25) // For UI feedback
  
  // Refs
  const videoRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const lastPositionRef = useRef({ x: 0.5, y: 0.5, z: 0.5 })
  const prevPositionRef = useRef({ x: 0.5, y: 0.5 })
  const streamRef = useRef(null)
  const lastHandSizeRef = useRef(0.25)
  
  // Constants
  const LERP_FACTOR = 0.35
  const LERP_FACTOR_DEPTH = 0.2 // Slower smoothing for depth (more stable)
  const PINCH_THRESHOLD = 0.08
  const FIST_THRESHOLD = 0.12
  
  // Depth detection constants
  const MIN_HAND_SIZE = 0.10  // Hand far from camera
  const MAX_HAND_SIZE = 0.40  // Hand close to camera

  const lerp = (current, target, factor) => {
    return current + (target - current) * factor
  }

  const distance3D = (p1, p2) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2) + 
      Math.pow(p1.z - p2.z, 2)
    )
  }

  const distance2D = (p1, p2) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + 
      Math.pow(p1.y - p2.y, 2)
    )
  }

  /**
   * Calculate depth based on apparent hand size
   * Larger hand in frame = closer to camera = lower depth value
   * Smaller hand = farther = higher depth value
   * 
   * Returns: 0 (close to camera) to 1 (far from camera)
   */
  const calculateHandDepth = (hand) => {
    // Method 1: Distance from wrist to middle finger tip (hand length)
    const wrist = hand[0]
    const middleTip = hand[12]
    const handLength = distance2D(wrist, middleTip)
    
    // Method 2: Palm width (more stable, less affected by finger position)
    const indexMCP = hand[5]   // Index finger knuckle
    const pinkyMCP = hand[17]  // Pinky knuckle
    const palmWidth = distance2D(indexMCP, pinkyMCP)
    
    // Method 3: Diagonal of hand bounding box
    const indexTip = hand[8]
    const pinkyTip = hand[20]
    const thumbTip = hand[4]
    
    // Find bounding box
    const allPoints = [wrist, middleTip, indexTip, pinkyTip, thumbTip]
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const diagonal = Math.sqrt(Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2))
    
    // Combine methods with weights (palm width is most stable)
    const combinedSize = (palmWidth * 2.5 + handLength * 0.8 + diagonal * 0.5) / 3
    
    // Map to 0-1 depth (inverted: big hand = close = 0)
    const normalizedDepth = 1 - Math.min(1, Math.max(0,
      (combinedSize - MIN_HAND_SIZE) / (MAX_HAND_SIZE - MIN_HAND_SIZE)
    ))
    
    return { depth: normalizedDepth, size: combinedSize }
  }

  /**
   * Fine-tune depth using pinch distance when grabbing
   * Tighter pinch = push forward (closer to center)
   * Looser pinch = pull back (farther from center)
   */
  const calculatePinchDepthAdjustment = (hand) => {
    const thumbTip = hand[4]
    const indexTip = hand[8]
    
    const pinchDist = distance2D(thumbTip, indexTip)
    
    // Tight pinch (0.02) = 0 (push forward)
    // Loose pinch (0.10) = 1 (pull back)
    const MIN_PINCH = 0.02
    const MAX_PINCH = 0.10
    
    return Math.min(1, Math.max(0,
      (pinchDist - MIN_PINCH) / (MAX_PINCH - MIN_PINCH)
    ))
  }

  /**
   * Check if hand is a closed fist (all fingers curled into palm)
   * Uses multiple checks for reliability
   */
  const checkFist = (hand) => {
    // Finger tips: 4=thumb, 8=index, 12=middle, 16=ring, 20=pinky
    // Finger MCPs (knuckles): 5=index, 9=middle, 13=ring, 17=pinky
    // Finger PIPs (middle joints): 6=index, 10=middle, 14=ring, 18=pinky
    
    const wrist = hand[0]
    const thumbTip = hand[4]
    const indexTip = hand[8]
    const middleTip = hand[12]
    const ringTip = hand[16]
    const pinkyTip = hand[20]
    
    const indexMCP = hand[5]
    const middleMCP = hand[9]
    const ringMCP = hand[13]
    const pinkyMCP = hand[17]
    
    const indexPIP = hand[6]
    const middlePIP = hand[10]
    const ringPIP = hand[14]
    const pinkyPIP = hand[18]
    
    // Method 1: Check if fingertips are closer to palm center than MCPs
    const palmCenter = hand[9] // Middle finger MCP as palm reference
    
    // Method 2: Check if tips are below PIPs (finger curled)
    // In a fist, the tip Y should be similar or higher than PIP Y (curled back)
    const indexCurled = indexTip.y > indexPIP.y - 0.02
    const middleCurled = middleTip.y > middlePIP.y - 0.02
    const ringCurled = ringTip.y > ringPIP.y - 0.02
    const pinkyCurled = pinkyTip.y > pinkyPIP.y - 0.02
    
    // Method 3: Check distance from tips to palm - should be small in a fist
    const indexToPalm = distance3D(indexTip, palmCenter)
    const middleToPalm = distance3D(middleTip, palmCenter)
    const ringToPalm = distance3D(ringTip, palmCenter)
    const pinkyToPalm = distance3D(pinkyTip, palmCenter)
    
    const tipsCloseToPalm = indexToPalm < 0.15 && middleToPalm < 0.12 && ringToPalm < 0.15 && pinkyToPalm < 0.18
    
    // Method 4: All fingertips should be close together in a fist
    const tipsSpread = distance3D(indexTip, pinkyTip)
    const tipsCompact = tipsSpread < 0.15
    
    // Combine methods: need curled fingers AND tips close to palm
    const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length
    
    // Fist = at least 3 fingers curled AND (tips close to palm OR tips compact)
    return curledCount >= 3 && (tipsCloseToPalm || tipsCompact)
  }

  /**
   * Expand tracking range
   */
  const expandRange = (value, center = 0.5, expansion = 1.5) => {
    const offset = value - center
    const expanded = center + (offset * expansion)
    return Math.max(0, Math.min(1, expanded))
  }

  /**
   * Process hand landmarks
   */
  const processLandmarks = useCallback((landmarks) => {
    if (!landmarks || landmarks.length === 0) {
      setIsTracking(false)
      setIsPinching(false)
      setIsFist(false)
      setHandVelocity({ x: 0, y: 0 })
      return
    }

    setIsTracking(true)
    const hand = landmarks[0]

    // Key landmarks
    const thumbTip = hand[4]
    const indexTip = hand[8]
    const palmCenter = hand[9]

    // IMPORTANT: Check fist FIRST before pinch
    // Fist takes priority because when closing hand, thumb and index get close
    const isFistGesture = checkFist(hand)
    
    // Only check pinch if NOT a fist
    const pinchDistance = distance3D(thumbTip, indexTip)
    const isPinch = !isFistGesture && pinchDistance < PINCH_THRESHOLD
    
    setIsFist(isFistGesture)
    setIsPinching(isPinch)

    // === DEPTH CALCULATION (NEW) ===
    // Calculate depth based on hand size in frame
    const { depth: baseDepth, size: currentHandSize } = calculateHandDepth(hand)
    
    // Smooth the hand size for UI display
    lastHandSizeRef.current = lerp(lastHandSizeRef.current, currentHandSize, 0.1)
    setHandSize(lastHandSizeRef.current)
    
    // If pinching, allow fine-tuning with pinch distance
    let finalDepth = baseDepth
    if (isPinch) {
      const pinchAdjustment = calculatePinchDepthAdjustment(hand)
      // Combine: 70% hand size, 30% pinch adjustment
      finalDepth = baseDepth * 0.7 + pinchAdjustment * 0.3
    }

    // Position (X, Y from hand position)
    const targetX = isPinch 
      ? (thumbTip.x + indexTip.x) / 2
      : palmCenter.x
    
    const targetY = isPinch 
      ? (thumbTip.y + indexTip.y) / 2
      : palmCenter.y

    // Expand range and mirror/invert
    const expandedX = expandRange(1 - targetX, 0.5, 1.5)
    const expandedY = expandRange(1 - targetY, 0.5, 1.5)

    // Apply smoothing (depth uses slower lerp for stability)
    const smoothedPosition = {
      x: lerp(lastPositionRef.current.x, expandedX, LERP_FACTOR),
      y: lerp(lastPositionRef.current.y, expandedY, LERP_FACTOR),
      z: lerp(lastPositionRef.current.z, finalDepth, LERP_FACTOR_DEPTH)
    }

    // Calculate velocity for camera control (both X and Y)
    const velocity = {
      x: (smoothedPosition.x - prevPositionRef.current.x) * 20,
      y: (smoothedPosition.y - prevPositionRef.current.y) * 20
    }
    
    // Smooth velocity with higher responsiveness
    setHandVelocity(prev => ({
      x: lerp(prev.x, velocity.x, 0.5),
      y: lerp(prev.y, velocity.y, 0.5)
    }))

    prevPositionRef.current = { x: smoothedPosition.x, y: smoothedPosition.y }
    lastPositionRef.current = smoothedPosition
    setHandPosition(smoothedPosition)
  }, [])

  /**
   * Detection loop
   */
  const runDetection = useCallback(() => {
    if (!videoRef.current || !handLandmarkerRef.current) {
      animationFrameRef.current = requestAnimationFrame(runDetection)
      return
    }
    
    if (videoRef.current.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(runDetection)
      return
    }

    try {
      const results = handLandmarkerRef.current.detectForVideo(
        videoRef.current, 
        performance.now()
      )
      processLandmarks(results.landmarks)
    } catch (error) {
      // Silently handle detection errors
    }

    animationFrameRef.current = requestAnimationFrame(runDetection)
  }, [processLandmarks])

  /**
   * Cleanup
   */
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    if (handLandmarkerRef.current) {
      try {
        handLandmarkerRef.current.close()
      } catch (e) {}
      handLandmarkerRef.current = null
    }
  }, [])

  /**
   * Initialize MediaPipe
   */
  const initializeTracking = useCallback(async () => {
    cleanup()
    setIsInitialized(false)
    
    try {
      console.log('[HAND] Initializing Hand Tracking...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })
      
      streamRef.current = stream
      console.log('[HAND] Webcam access granted!')

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
      console.log(`[HAND] Video ready: ${video.videoWidth}x${video.videoHeight}`)

      console.log('[HAND] Loading MediaPipe...')
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )

      console.log('[HAND] Creating Hand Landmarker...')
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      setIsInitialized(true)
      console.log('[HAND] Hand Tracking ready!')
      
      runDetection()
      return true

    } catch (error) {
      console.error('[HAND] Failed to initialize:', error)
      setIsTracking(false)
      setIsInitialized(true)
      throw error
    }
  }, [cleanup, runDetection])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    handPosition,     // { x, y, z } where z is depth (0=close, 1=far)
    isPinching,
    isFist,           // Closed fist for camera control
    handVelocity,     // Velocity for camera rotation
    handSize,         // Current hand size (for UI feedback)
    isTracking,
    isInitialized,
    videoRef,
    initializeTracking
  }
}

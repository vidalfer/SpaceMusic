import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import SpaceScene from './components/SpaceScene'
import SpaceUI from './components/SpaceUI'
import PermissionScreen from './components/PermissionScreen'
import { useHandTracking } from './hooks/useHandTracking'
import { useMultiplayerTracking } from './hooks/useMultiplayerTracking'
import { useLyriaAudio } from './hooks/useLyriaAudio'
import './styles/index.css'

/**
 * Gesture-Flow DJ - Solar System Musical Interface
 * A cosmic music creation experience where planets represent instruments
 * 
 * Controls:
 * - Pinch: grab planets to change their orbit
 * - Fist: rotate camera through space
 * - Hand depth: push/pull planets toward/away from the Sun
 * 
 * Closer to the Sun = Higher musical influence
 */
function App() {
  const [appState, setAppState] = useState('loading')
  const [error, setError] = useState(null)
  const [isMultiplayer, setIsMultiplayer] = useState(false)

  // 8 Planets orbiting the Sun - each represents a musical element
  // Orbital mechanics: closer planets orbit faster (Kepler's laws)
  const [orbs, setOrbs] = useState([
    // Inner planets (fast orbit, high influence when close)
    {
      id: 'mercury',
      label: 'MERCURY',
      planetName: 'Percussion',
      prompt: 'punchy drums, electronic beat, heavy kick, snare hits, fast rhythms',
      color: '#b5b5b5',  // Gray
      position: [2.5, 0, 0],
      orbitRadius: 2.5,
      orbitSpeed: 4.0,    // Fastest orbit
      orbitOffset: 0,
      planetSize: 0.3,
      active: true
    },
    {
      id: 'venus',
      label: 'VENUS',
      planetName: 'Bass',
      prompt: 'deep bass, sub frequencies, groovy bassline, warm low end',
      color: '#e6c87a',  // Yellow-orange
      position: [3.5, 0, 0],
      orbitRadius: 3.5,
      orbitSpeed: 2.8,
      orbitOffset: Math.PI * 0.5,
      planetSize: 0.45,
      active: true
    },
    {
      id: 'earth',
      label: 'EARTH',
      planetName: 'Melody',
      prompt: 'beautiful melody, harmonic progressions, emotional lead, memorable tune',
      color: '#4a90d9',  // Blue
      position: [4.5, 0, 0],
      orbitRadius: 4.5,
      orbitSpeed: 2.0,
      orbitOffset: Math.PI,
      planetSize: 0.5,
      hasMoon: true,
      active: true
    },
    {
      id: 'mars',
      label: 'MARS',
      planetName: 'Guitar',
      prompt: 'electric guitar riffs, distorted power chords, rock energy, aggressive strings',
      color: '#d94a3d',  // Red
      position: [5.5, 0, 0],
      orbitRadius: 5.5,
      orbitSpeed: 1.5,
      orbitOffset: Math.PI * 1.5,
      planetSize: 0.4,
      active: true
    },
    // Outer planets (slow orbit, ambient/texture sounds)
    {
      id: 'jupiter',
      label: 'JUPITER',
      planetName: 'Orchestra',
      prompt: 'orchestral strings, epic cinematic, lush ensemble, majestic brass',
      color: '#d9a066',  // Orange-brown
      position: [7, 0, 0],
      orbitRadius: 7,
      orbitSpeed: 0.8,
      orbitOffset: Math.PI * 0.3,
      planetSize: 0.9,    // Largest planet
      active: true
    },
    {
      id: 'saturn',
      label: 'SATURN',
      planetName: 'Synth',
      prompt: 'analog synth pads, warm synthesizer, dreamy textures, atmospheric layers',
      color: '#e8d5a3',  // Pale gold
      position: [8.5, 0, 0],
      orbitRadius: 8.5,
      orbitSpeed: 0.5,
      orbitOffset: Math.PI * 0.8,
      planetSize: 0.75,
      hasRings: true,     // Saturn's rings!
      active: true
    },
    {
      id: 'uranus',
      label: 'URANUS',
      planetName: 'Ambient',
      prompt: 'ambient textures, ethereal pads, cosmic soundscape, space atmosphere',
      color: '#7de3e3',  // Cyan
      position: [10, 0, 0],
      orbitRadius: 10,
      orbitSpeed: 0.3,
      orbitOffset: Math.PI * 1.2,
      planetSize: 0.6,
      tiltAngle: Math.PI * 0.4,  // Uranus is tilted!
      active: true
    },
    {
      id: 'neptune',
      label: 'NEPTUNE',
      planetName: 'FX',
      prompt: 'deep reverb, echoing effects, distant sounds, mysterious atmosphere, cosmic delay',
      color: '#4169e1',  // Deep blue
      position: [11.5, 0, 0],
      orbitRadius: 11.5,
      orbitSpeed: 0.2,    // Slowest orbit
      orbitOffset: Math.PI * 1.7,
      planetSize: 0.55,
      active: true
    },
  ])

  // Track which orb is being dragged (per player in multiplayer)
  const [grabbedOrbs, setGrabbedOrbs] = useState({}) // { playerId: orbId }

  // Single player hand tracking (local MediaPipe)
  const singlePlayer = useHandTracking()

  // Multiplayer tracking (YOLO + MediaPipe on backend)
  const multiplayer = useMultiplayerTracking()

  // Unified players array
  const players = useMemo(() => {
    if (isMultiplayer) {
      // Multiplayer: use backend data
      return multiplayer.players.map(p => ({
        id: p.id,
        color: p.color,
        hands: p.hands.map(h => ({
          position: h.position,
          isPinching: h.isPinching,
          isFist: h.isFist
        }))
      }))
    } else {
      // Single player: convert local tracking to player format
      if (!singlePlayer.isTracking) return []

      return [{
        id: 'player_0',
        color: '#00ffaa',
        hands: [{
          position: singlePlayer.handPosition,
          isPinching: singlePlayer.isPinching,
          isFist: singlePlayer.isFist
        }]
      }]
    }
  }, [isMultiplayer, multiplayer.players, singlePlayer.handPosition,
    singlePlayer.isPinching, singlePlayer.isFist, singlePlayer.isTracking])

  // Primary hand for backward compatibility (first hand of first player)
  const primaryHand = useMemo(() => {
    if (players.length > 0 && players[0].hands.length > 0) {
      return {
        ...players[0].hands[0],
        playerId: players[0].id,
        playerColor: players[0].color
      }
    }
    return null
  }, [players])

  // Legacy compatibility
  const handPosition = primaryHand?.position || { x: 0.5, y: 0.5, z: 0.5 }
  const isPinching = primaryHand?.isPinching || false
  const isFist = primaryHand?.isFist || false
  const isTracking = isMultiplayer ? multiplayer.isTracking : singlePlayer.isTracking
  const isInitialized = isMultiplayer ? multiplayer.isInitialized : singlePlayer.isInitialized
  const videoRef = isMultiplayer ? multiplayer.videoRef : singlePlayer.videoRef
  const handVelocity = singlePlayer.handVelocity || { x: 0, y: 0 }

  // Grabbed orb for backward compatibility (first grabbed)
  const grabbedOrbId = useMemo(() => {
    const entries = Object.entries(grabbedOrbs)
    return entries.length > 0 ? entries[0][1] : null
  }, [grabbedOrbs])

  // Set grabbed orb (updates grabbedOrbs map)
  const setGrabbedOrbId = useCallback((orbId, playerId = 'player_0') => {
    setGrabbedOrbs(prev => {
      if (orbId === null) {
        // Release: remove this player's grab
        const next = { ...prev }
        delete next[playerId]
        return next
      } else {
        // Grab: set this player's grabbed orb
        return { ...prev, [playerId]: orbId }
      }
    })
  }, [])

  // Camera mode per player
  const getCameraMode = useCallback((playerId) => {
    const player = players.find(p => p.id === playerId)
    if (!player || player.hands.length === 0) return 'idle'

    const hand = player.hands[0]
    if (grabbedOrbs[playerId]) return 'dragging'
    if (hand.isFist) return 'camera'
    return 'idle'
  }, [players, grabbedOrbs])

  // Legacy camera mode (for first player)
  const cameraMode = useMemo(() => {
    return getCameraMode('player_0')
  }, [getCameraMode])

  // Lyria audio
  const lyriaAudio = useLyriaAudio()

  // Config
  const [config, setConfig] = useState({
    bpm: 120,
    guidance: 4.0,
    density: 0.5,
    brightness: 0.5
  })


  /**
   * Calculate weights based on distance from CENTER (0,0,0)
   * Now works in full 3D space
   */
  const calculateWeights = useCallback(() => {
    const activeOrbs = orbs.filter(o => o.active)
    if (activeOrbs.length === 0) return []

    const CENTER = { x: 0, y: 0, z: 0 }
    const MAX_INFLUENCE_RADIUS = 2.5  // Full weight at this distance
    const MIN_INFLUENCE_RADIUS = 6.0  // Minimum weight beyond this

    return activeOrbs.map((orb) => {
      // Calculate 3D distance from center
      const dx = orb.position[0] - CENTER.x
      const dy = orb.position[1] - CENTER.y
      const dz = orb.position[2] - CENTER.z
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy + dz * dz)

      let weight
      if (distanceFromCenter <= MAX_INFLUENCE_RADIUS) {
        const t = distanceFromCenter / MAX_INFLUENCE_RADIUS
        weight = 1.5 - (t * 0.5)
      } else if (distanceFromCenter <= MIN_INFLUENCE_RADIUS) {
        const t = (distanceFromCenter - MAX_INFLUENCE_RADIUS) / (MIN_INFLUENCE_RADIUS - MAX_INFLUENCE_RADIUS)
        weight = 1.0 - (t * 0.7)
      } else {
        weight = 0.3
      }

      return {
        text: orb.prompt,
        weight: Math.max(0.1, Math.min(1.5, weight)),
        orbId: orb.id,
        label: orb.label,
        distance: distanceFromCenter
      }
    })
  }, [orbs])

  // Memoized weights
  const weightedPrompts = useMemo(() => calculateWeights(), [calculateWeights])

  // Calculate average influence level for UI
  const averageInfluence = useMemo(() => {
    if (weightedPrompts.length === 0) return 0
    const avgWeight = weightedPrompts.reduce((sum, w) => sum + w.weight, 0) / weightedPrompts.length
    return avgWeight / 1.5
  }, [weightedPrompts])

  // Calculate total influence (sum of all weights)
  const totalInfluence = useMemo(() => {
    return weightedPrompts.reduce((sum, w) => sum + w.weight, 0)
  }, [weightedPrompts])

  // Update orb position (now supports full 3D)
  const updateOrbPosition = useCallback((orbId, newPosition) => {
    setOrbs(prev => prev.map(orb =>
      orb.id === orbId
        ? { ...orb, position: newPosition }
        : orb
    ))
  }, [])

  // Toggle orb active state
  const toggleOrbActive = useCallback((orbId) => {
    setOrbs(prev => prev.map(orb =>
      orb.id === orbId
        ? { ...orb, active: !orb.active }
        : orb
    ))
  }, [])

  // Send prompts to Lyria when weights change
  useEffect(() => {
    if (lyriaAudio.isConnected && lyriaAudio.isPlaying && weightedPrompts.length > 0) {
      lyriaAudio.setPrompts(weightedPrompts)
    }
  }, [weightedPrompts, lyriaAudio.isConnected, lyriaAudio.isPlaying])

  // Initialize tracking (single or multiplayer)
  const startTracking = async () => {
    setAppState('loading')
    setError(null)
    try {
      if (isMultiplayer) {
        await multiplayer.initialize()
      } else {
        await singlePlayer.initializeTracking()
      }
      setAppState('ready')
    } catch (err) {
      setError(err.message)
      setAppState('permission')
    }
  }

  // Toggle multiplayer mode
  const toggleMultiplayer = useCallback(async () => {
    // Cleanup current mode
    if (isMultiplayer) {
      multiplayer.cleanup()
    } else {
      // Can't easily cleanup single player, just switch
    }

    setIsMultiplayer(prev => !prev)
    setGrabbedOrbs({})
  }, [isMultiplayer, multiplayer])

  useEffect(() => {
    startTracking()
  }, [isMultiplayer]) // Re-init when mode changes

  useEffect(() => {
    if (isInitialized && appState === 'loading') {
      setTimeout(() => setAppState('ready'), 300)
    }
  }, [isInitialized, appState])

  // Handle play/stop
  const handlePlay = async () => {
    if (!lyriaAudio.isConnected) {
      await lyriaAudio.connect()
    }
    lyriaAudio.setConfig(config)
    if (weightedPrompts.length > 0) {
      lyriaAudio.setPrompts(weightedPrompts)
    }
    lyriaAudio.play()
  }

  const handleStop = () => {
    lyriaAudio.stop()
  }

  // Get grabbed orb data for camera follow
  const grabbedOrb = useMemo(() => {
    return orbs.find(o => o.id === grabbedOrbId) || null
  }, [orbs, grabbedOrbId])

  // Loading
  if (appState === 'loading') {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Initializing Solar System...</p>
      </div>
    )
  }

  // Permission
  if (appState === 'permission') {
    return <PermissionScreen error={error} onRetry={startTracking} />
  }

  return (
    <div className="space-app">
      {/* 3D Canvas */}
      <div className="canvas-container">
        <Canvas
          camera={{ position: [0, 12, 20], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <SpaceScene
              orbs={orbs}
              players={players}
              grabbedOrbs={grabbedOrbs}
              setGrabbedOrbId={setGrabbedOrbId}
              updateOrbPosition={updateOrbPosition}
              toggleOrbActive={toggleOrbActive}
              isTracking={isTracking}
              weightedPrompts={weightedPrompts}
              getCameraMode={getCameraMode}
              // Legacy props for backward compatibility
              handPosition={handPosition}
              isPinching={isPinching}
              isFist={isFist}
              handVelocity={handVelocity}
              cameraMode={cameraMode}
              grabbedOrbId={grabbedOrbId}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <SpaceUI
        orbs={orbs}
        players={players}
        weightedPrompts={weightedPrompts}
        averageInfluence={averageInfluence}
        totalInfluence={totalInfluence}
        isTracking={isTracking}
        isPinching={isPinching}
        isFist={isFist}
        cameraMode={cameraMode}
        handPosition={handPosition}
        grabbedOrbId={grabbedOrbId}
        isMultiplayer={isMultiplayer}
        onToggleMultiplayer={toggleMultiplayer}
        multiplayerConnected={multiplayer.isConnected}
        isConnected={lyriaAudio.isConnected}
        isPlaying={lyriaAudio.isPlaying}
        onPlay={handlePlay}
        onStop={handleStop}
        config={config}
        setConfig={setConfig}
        videoRef={videoRef}
      />
    </div>
  )
}

export default App

import React, { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react'
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

  const galaxies = useMemo(() => ([
    {
      id: 'milky_way',
      name: 'Via Láctea',
      mood: 'EDM/Eletrônico',
      position: [0, 0, 0],
      color: '#5cc8ff',
      prompts: [
        { text: 'edm, electronic, festival energy, punchy drums, bright synths', weight: 1.0 },
        { text: 'driving groove, sidechain pump, futuristic textures', weight: 0.7 }
      ],
      config: { bpm: 126, guidance: 4.0, density: 0.65, brightness: 0.7 }
    },
    {
      id: 'andromeda',
      name: 'Andrômeda',
      mood: 'Jazz/Neo Soul',
      position: [9, 2, -6],
      color: '#f3c4ff',
      prompts: [
        { text: 'neo soul, jazz harmony, warm keys, expressive chords', weight: 1.0 },
        { text: 'swing feel, brushed drums, smooth bassline', weight: 0.7 }
      ],
      config: { bpm: 92, guidance: 3.8, density: 0.45, brightness: 0.55 }
    },
    {
      id: 'orion_nebula',
      name: 'Nebulosa de Órion',
      mood: 'Ambient/Chill',
      position: [-8, -1, -5],
      color: '#6fe4d6',
      prompts: [
        { text: 'ambient, chill, airy pads, slow motion textures', weight: 1.0 },
        { text: 'soft pulses, distant echoes, calm atmosphere', weight: 0.6 }
      ],
      config: { bpm: 74, guidance: 4.5, density: 0.35, brightness: 0.45 }
    },
    {
      id: 'crab_nebula',
      name: 'Nebulosa do Caranguejo',
      mood: 'Rock/Industrial',
      position: [6, -2, 8],
      color: '#ff9a68',
      prompts: [
        { text: 'industrial rock, heavy guitars, gritty textures, aggressive rhythm', weight: 1.0 },
        { text: 'distorted drums, metallic ambience, raw energy', weight: 0.7 }
      ],
      config: { bpm: 138, guidance: 4.2, density: 0.75, brightness: 0.55 }
    }
  ]), [])

  const blackHoles = useMemo(() => ([
    { id: 'bh_core', position: [0, 0, 0], radius: 1.4 },
    { id: 'bh_outer', position: [6, 0, -3], radius: 1.1 }
  ]), [])

  const constellationStars = useMemo(() => ([
    { id: 's1', position: [-3.2, 2.4, 1.2] },
    { id: 's2', position: [-1.8, 1.4, -0.6] },
    { id: 's3', position: [-0.2, 2.1, -1.8] },
    { id: 's4', position: [1.4, 2.6, -0.9] },
    { id: 's5', position: [2.8, 1.5, 0.4] },
    { id: 's6', position: [0.6, 0.4, 1.6] },
    { id: 's7', position: [-1.4, 0.2, 1.2] },
    { id: 's8', position: [3.6, 0.6, -1.6] },
    { id: 's9', position: [4.2, -0.4, 0.8] },
    { id: 's10', position: [-4.1, -0.8, -0.2] },
    { id: 's11', position: [-2.6, -1.6, 1.8] },
    { id: 's12', position: [1.9, -1.4, -2.2] }
  ]), [])

  const [sceneMode, setSceneMode] = useState('solar')
  const [currentGalaxyId, setCurrentGalaxyId] = useState('milky_way')
  const [galaxyTransition, setGalaxyTransition] = useState(null)
  const [transitionProgress, setTransitionProgress] = useState(1)
  const [constellations, setConstellations] = useState([])
  const [constellationDrafts, setConstellationDrafts] = useState({})
  const lastSceneSwitchRef = useRef(0)
  const starLocksRef = useRef({})

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

  const getGalaxyById = useCallback((id) => {
    return galaxies.find(galaxy => galaxy.id === id)
  }, [galaxies])

  const selectGalaxy = useCallback((galaxyId) => {
    if (!galaxyId || galaxyId === currentGalaxyId) return
    const fromGalaxy = getGalaxyById(currentGalaxyId)
    const toGalaxy = getGalaxyById(galaxyId)
    if (!toGalaxy) return
    setGalaxyTransition({
      fromId: fromGalaxy?.id || currentGalaxyId,
      toId: galaxyId,
      start: performance.now(),
      duration: 3200
    })
    setTransitionProgress(0)
    setCurrentGalaxyId(galaxyId)
    if (toGalaxy?.config) {
      setConfig(toGalaxy.config)
    }
  }, [currentGalaxyId, getGalaxyById])

  useEffect(() => {
    if (!galaxyTransition) return
    let frame
    const tick = () => {
      const now = performance.now()
      const t = Math.min(1, (now - galaxyTransition.start) / galaxyTransition.duration)
      setTransitionProgress(t)
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setGalaxyTransition(null)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [galaxyTransition])

  // Memoized weights
  const weightedPrompts = useMemo(() => calculateWeights(), [calculateWeights])

  const baseGalaxyPrompts = useMemo(() => {
    const currentGalaxy = getGalaxyById(currentGalaxyId)
    if (!currentGalaxy) return []
    if (!galaxyTransition) {
      return currentGalaxy.prompts.map(p => ({ ...p, galaxyId: currentGalaxyId }))
    }
    const fromGalaxy = getGalaxyById(galaxyTransition.fromId)
    const toGalaxy = getGalaxyById(galaxyTransition.toId)
    const fromPrompts = fromGalaxy?.prompts || []
    const toPrompts = toGalaxy?.prompts || []
    const fromWeight = 1 - transitionProgress
    const toWeight = transitionProgress
    return [
      ...fromPrompts.map(p => ({ ...p, weight: (p.weight ?? 1) * fromWeight, galaxyId: fromGalaxy?.id })),
      ...toPrompts.map(p => ({ ...p, weight: (p.weight ?? 1) * toWeight, galaxyId: toGalaxy?.id }))
    ]
  }, [currentGalaxyId, galaxyTransition, transitionProgress, getGalaxyById])

  const constellationPrompts = useMemo(() => {
    return constellations.map(c => ({
      text: c.prompt,
      weight: c.weight,
      constellationId: c.id
    }))
  }, [constellations])

  const blackHoleImpact = useMemo(() => {
    let maxStrength = 0
    const sources = []
    orbs.forEach(orb => sources.push({ position: orb.position }))
    players.forEach(player => {
      player.hands.forEach(hand => {
        sources.push({ position: [hand.position.x * 16 - 8, (hand.position.y - 0.5) * 6, (hand.position.z - 0.5) * 6] })
      })
    })
    blackHoles.forEach(hole => {
      sources.forEach(src => {
        const dx = src.position[0] - hole.position[0]
        const dy = src.position[1] - hole.position[1]
        const dz = src.position[2] - hole.position[2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist < hole.radius) {
          const strength = 1 - dist / hole.radius
          if (strength > maxStrength) maxStrength = strength
        }
      })
    })
    return maxStrength
  }, [blackHoles, orbs, players])

  const combinedPrompts = useMemo(() => {
    const dropMultiplier = 1 - blackHoleImpact * 0.75
    return [
      ...baseGalaxyPrompts.map(p => ({ ...p, weight: (p.weight ?? 1) * dropMultiplier })),
      ...weightedPrompts.map(p => ({ ...p, weight: p.weight * dropMultiplier })),
      ...constellationPrompts.map(p => ({ ...p, weight: p.weight * dropMultiplier }))
    ]
  }, [baseGalaxyPrompts, weightedPrompts, constellationPrompts, blackHoleImpact])

  const effectiveConfig = useMemo(() => {
    if (!galaxyTransition) return config
    const fromGalaxy = getGalaxyById(galaxyTransition.fromId)
    const toGalaxy = getGalaxyById(galaxyTransition.toId)
    const fromConfig = fromGalaxy?.config || config
    const toConfig = toGalaxy?.config || config
    const t = transitionProgress
    const lerp = (a, b) => a + (b - a) * t
    return {
      bpm: Math.round(lerp(fromConfig.bpm, toConfig.bpm)),
      guidance: lerp(fromConfig.guidance, toConfig.guidance),
      density: lerp(fromConfig.density, toConfig.density),
      brightness: lerp(fromConfig.brightness, toConfig.brightness)
    }
  }, [galaxyTransition, transitionProgress, getGalaxyById, config])

  const dynamicConfig = useMemo(() => {
    if (blackHoleImpact <= 0) return effectiveConfig
    const drop = blackHoleImpact
    return {
      bpm: Math.max(50, Math.round(effectiveConfig.bpm * (1 - drop * 0.2))),
      guidance: Math.max(0.5, effectiveConfig.guidance * (1 - drop * 0.6)),
      density: Math.max(0.05, effectiveConfig.density * (1 - drop * 0.85)),
      brightness: Math.max(0.05, effectiveConfig.brightness * (1 - drop * 0.7))
    }
  }, [effectiveConfig, blackHoleImpact])

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
    if (lyriaAudio.isConnected && lyriaAudio.isPlaying && combinedPrompts.length > 0) {
      lyriaAudio.setPrompts(combinedPrompts)
    }
  }, [combinedPrompts, lyriaAudio.isConnected, lyriaAudio.isPlaying])

  useEffect(() => {
    if (lyriaAudio.isConnected && lyriaAudio.isPlaying) {
      lyriaAudio.setConfig(dynamicConfig)
    }
  }, [dynamicConfig, lyriaAudio.isConnected, lyriaAudio.isPlaying])

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
    const now = performance.now()
    if (!isTracking) return
    if (now - lastSceneSwitchRef.current < 900) return
    if (sceneMode === 'solar' && !isPinching && !isFist && handPosition.z > 0.88) {
      setSceneMode('galaxyMap')
      lastSceneSwitchRef.current = now
    } else if (sceneMode === 'galaxyMap' && !isPinching && !isFist && handPosition.z < 0.25) {
      setSceneMode('solar')
      lastSceneSwitchRef.current = now
    }
  }, [sceneMode, isTracking, isPinching, isFist, handPosition])

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
    lyriaAudio.setConfig(dynamicConfig)
    if (combinedPrompts.length > 0) {
      lyriaAudio.setPrompts(combinedPrompts)
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

  const buildConstellationPrompt = useCallback((pointsCount) => {
    if (pointsCount >= 6) return 'polyrhythmic loop, evolving accents, layered pulses'
    if (pointsCount >= 4) return 'syncopated loop, shimmering rhythm, tight groove'
    if (pointsCount >= 3) return 'rhythmic motif, steady loop, crisp attacks'
    return 'minimal pulse, sparse rhythm, gentle loop'
  }, [])

  const handleStarConnect = useCallback((playerId, starId) => {
    if (!starId) return
    const lock = starLocksRef.current[starId]
    const now = performance.now()
    if (lock && lock.playerId !== playerId && now - lock.timestamp < 900) return
    starLocksRef.current[starId] = { playerId, timestamp: now }
    setConstellationDrafts(prev => {
      const draft = prev[playerId] || { points: [] }
      if (draft.points[draft.points.length - 1] === starId) return prev
      return {
        ...prev,
        [playerId]: {
          points: [...draft.points, starId]
        }
      }
    })
  }, [])

  const handleConstellationEnd = useCallback((playerId) => {
    setConstellationDrafts(prev => {
      const draft = prev[playerId]
      if (!draft || draft.points.length < 2) {
        const next = { ...prev }
        delete next[playerId]
        return next
      }
      const points = draft.points
      const edges = points.slice(1).map((point, index) => [points[index], point])
      const id = `c_${playerId}_${Date.now()}`
      const prompt = buildConstellationPrompt(points.length)
      const weight = Math.min(1.2, 0.4 + points.length * 0.12)
      setConstellations(current => [
        ...current,
        { id, ownerId: playerId, points, edges, prompt, weight }
      ])
      const next = { ...prev }
      delete next[playerId]
      return next
    })
  }, [buildConstellationPrompt])

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
              sceneMode={sceneMode}
              galaxies={galaxies}
              currentGalaxyId={currentGalaxyId}
              onSelectGalaxy={(id) => {
                selectGalaxy(id)
                setSceneMode('solar')
              }}
              constellationStars={constellationStars}
              constellations={constellations}
              constellationDrafts={constellationDrafts}
              onStarConnect={handleStarConnect}
              onConstellationEnd={handleConstellationEnd}
              blackHoles={blackHoles}
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
        sceneMode={sceneMode}
        galaxies={galaxies}
        currentGalaxyId={currentGalaxyId}
        onSelectGalaxy={selectGalaxy}
        onToggleSceneMode={() => setSceneMode(mode => mode === 'solar' ? 'galaxyMap' : 'solar')}
        constellations={constellations}
        constellationDrafts={constellationDrafts}
        blackHoleImpact={blackHoleImpact}
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
        config={dynamicConfig}
        setConfig={setConfig}
        videoRef={videoRef}
      />
    </div>
  )
}

export default App

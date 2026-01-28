import React, { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, Text, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import GalaxyMap, { WarpEffect } from './GalaxyMap'
import BlackHole, { BlackHoleDropZone } from './BlackHole'
import NavigationPortal from './NavigationPortal'
import ConstellationSystem from './ConstellationSystem'
import { useAppStore } from '../store/appStore'

/**
 * SpaceScene - 3D environment with orbital camera and depth control
 * Supports multiplayer with multiple cursors
 * 
 * Controls:
 * - Pinch: Grab and drag orbs in 3D space
 * - Fist: Rotate camera (stays in position when released)
 * - Hand depth: Controls orb distance from center
 */
function SpaceScene({
  orbs,
  players = [],
  grabbedOrbs = {},
  setGrabbedOrbId,
  updateOrbPosition,
  toggleOrbActive,
  isTracking,
  weightedPrompts,
  getCameraMode,
  // Legacy props
  handPosition,
  isPinching,
  isFist,
  handVelocity,
  cameraMode,
  grabbedOrbId
}) {
  const { camera, viewport } = useThree()

  // Galaxy navigation state  // Store state
  const zoomLevel = useAppStore(state => state.zoomLevel)
  const setZoomLevel = useAppStore(state => state.setZoomLevel)
  const viewMode = useAppStore(state => state.viewMode)

  // Camera animation
  const cameraAngleRef = useRef({ theta: 0, phi: Math.PI / 3 })
  const cameraRadiusRef = useRef(15)
  const [shouldCenterCamera, setShouldCenterCamera] = useState(false)

  // Reset camera when entering constellation mode for immediate optimal viewing
  useEffect(() => {
    if (viewMode === 'constellation') {
      // Frontal view: theta=0 (facing forward), phi=PI/2 (horizontal)
      cameraAngleRef.current = { theta: 0, phi: Math.PI / 2 }
      // Move camera instantly to the correct position
      const radius = 25
      const theta = 0
      const phi = Math.PI / 2
      const lookAtZ = -15
      camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        lookAtZ + radius * Math.cos(phi),
        lookAtZ + radius * Math.sin(phi) * Math.cos(theta)
      )
      camera.lookAt(0, 0, lookAtZ)
    }
  }, [viewMode, camera])

  // Transition logic
  const isTransitioning = useAppStore(state => state.isTransitioning)
  const transitionProgress = useAppStore(state => state.transitionProgress)
  const startGalaxyTransition = useAppStore(state => state.startGalaxyTransition)
  const updateTransitionProgress = useAppStore(state => state.updateTransitionProgress)
  const galaxies = useAppStore(state => state.galaxies)

  // Zoom animation state
  const targetZoomRadius = useRef(22)
  const zoomRadiusMap = useMemo(() => ({
    'solar_system': 22,
    'galaxy_view': 150,
    'universe_view': 400
  }), [])

  // Track two-hand gesture for zoom
  const prevHandDistanceRef = useRef(null)
  const zoomGestureActiveRef = useRef(false)

  // Track actual visual positions of orbs (updated by SoundOrb components)
  const orbVisualPositionsRef = useRef({}) // { orbId: THREE.Vector3 }

  // Track closest orb for each player's hand
  const closestOrbsRef = useRef({}) // { playerId_handIndex: orbId }

  // Function for SoundOrb to report its current visual position
  const registerOrbPosition = useCallback((orbId, position) => {
    orbVisualPositionsRef.current[orbId] = position.clone()
  }, [])

  // Camera control - uses first player with fist gesture + zoom gestures
  useFrame((state, delta) => {
    // Update transition progress if transitioning
    if (isTransitioning) {
      const newProgress = transitionProgress + delta * 0.5 // 2 seconds transition
      updateTransitionProgress(Math.min(newProgress, 1))
    }

    // Update target zoom radius based on zoom level
    targetZoomRadius.current = zoomRadiusMap[zoomLevel] || 22

    // Smooth zoom animation
    const zoomDiff = targetZoomRadius.current - cameraRadiusRef.current
    if (Math.abs(zoomDiff) > 0.1) {
      cameraRadiusRef.current += zoomDiff * delta * 2
    }

    // Check for two-hand zoom gesture (spread/pinch for zoom)
    if (players.length > 0 && players[0].hands.length >= 2) {
      const hand1 = players[0].hands[0]
      const hand2 = players[0].hands[1]

      // Calculate distance between hands
      const dx = hand1.position.x - hand2.position.x
      const dy = hand1.position.y - hand2.position.y
      const handDistance = Math.sqrt(dx * dx + dy * dy)

      if (prevHandDistanceRef.current !== null) {
        const distanceDelta = handDistance - prevHandDistanceRef.current

        // Significant spread = zoom out, significant pinch = zoom in
        if (Math.abs(distanceDelta) > 0.02) {
          zoomGestureActiveRef.current = true

          if (distanceDelta > 0.05) {
            // Spreading hands - zoom out
            if (zoomLevel === 'solar_system') {
              setZoomLevel('galaxy_view')
            } else if (zoomLevel === 'galaxy_view') {
              setZoomLevel('universe_view')
            }
          } else if (distanceDelta < -0.05) {
            // Pinching hands - zoom in
            if (zoomLevel === 'universe_view') {
              setZoomLevel('galaxy_view')
            } else if (zoomLevel === 'galaxy_view') {
              setZoomLevel('solar_system')
            }
          }
        }
      }

      prevHandDistanceRef.current = handDistance
    } else {
      prevHandDistanceRef.current = null
      zoomGestureActiveRef.current = false
    }

    // Find any player making a fist gesture
    let fistPlayer = null
    let fistHand = null

    for (const player of players) {
      for (let i = 0; i < player.hands.length; i++) {
        const hand = player.hands[i]
        if (hand.isFist && !grabbedOrbs[player.id]) {
          fistPlayer = player
          fistHand = hand
          break
        }
      }
      if (fistPlayer) break
    }

    // Rotate camera based on fist gesture - REDUCED SENSITIVITY
    if (fistPlayer && fistHand) {
      const offsetX = (fistHand.position.x - 0.5) * 2
      const offsetY = (fistHand.position.y - 0.5) * 2

      cameraAngleRef.current.theta += offsetX * delta * 0.8  // Reduced from 2
      cameraAngleRef.current.phi -= offsetY * delta * 0.6    // Reduced from 1.5
      cameraAngleRef.current.phi = Math.max(0.3, Math.min(Math.PI - 0.3, cameraAngleRef.current.phi))
    } else if (cameraMode === 'camera' && isFist && handVelocity) {
      // Legacy single player camera control - REDUCED SENSITIVITY
      cameraAngleRef.current.theta += handVelocity.x * delta * 1.5  // Reduced from 4
      cameraAngleRef.current.phi -= handVelocity.y * delta * 1.2    // Reduced from 3
      cameraAngleRef.current.phi = Math.max(0.3, Math.min(Math.PI - 0.3, cameraAngleRef.current.phi))
    }

    // Handle camera centering request
    if (shouldCenterCamera) {
      if (viewMode === 'constellation') {
        cameraAngleRef.current = { theta: 0, phi: Math.PI / 2 }
      } else {
        cameraAngleRef.current = { theta: 0, phi: Math.PI / 3 }
      }
      setShouldCenterCamera(false)
    }

    // Calculate camera position based on view mode
    let targetCamPos
    let lookAtPos = new THREE.Vector3(0, 0, 0)

    if (viewMode === 'constellation') {
      // Orbital camera for constellation mode
      // Center of orbit is Z = -15 (where stars are)
      lookAtPos = new THREE.Vector3(0, 0, -15)

      // Use existing camera angles but with fixed radius relative to lookAt
      const radius = 25
      const theta = cameraAngleRef.current.theta
      const phi = cameraAngleRef.current.phi

      // Calculate position relative to lookAt
      const relX = radius * Math.sin(phi) * Math.sin(theta)
      const relY = radius * Math.cos(phi)
      const relZ = radius * Math.sin(phi) * Math.cos(theta)

      targetCamPos = new THREE.Vector3(
        lookAtPos.x + relX,
        lookAtPos.y + relY,
        lookAtPos.z + relZ
      )
    } else if (viewMode === 'black_hole') {
      // Fixed view looking at black hole at [0, -5, -10]
      targetCamPos = new THREE.Vector3(0, 2, 5)
      lookAtPos = new THREE.Vector3(0, -5, -10)
    } else {
      // Default orbital camera
      const radius = cameraRadiusRef.current
      const theta = cameraAngleRef.current.theta
      const phi = cameraAngleRef.current.phi

      targetCamPos = new THREE.Vector3(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      )
    }

    camera.position.lerp(targetCamPos, 0.1)
    camera.lookAt(lookAtPos)
  })

  // Handle galaxy selection from GalaxyMap
  const handleSelectGalaxy = useCallback((galaxyId) => {
    console.log('[GALAXY] Transitioning to:', galaxyId)
    startGalaxyTransition(galaxyId)
  }, [startGalaxyTransition])

  // Handle constellation completion
  const addConstellation = useAppStore(state => state.addConstellation)
  const handleConstellationComplete = useCallback((type, name) => {
    console.log(`[CONSTELLATION] Completed: ${name} (${type})`)
    addConstellation(type, name)
    // Here you could trigger audio effects or prompts based on constellation type
  }, [addConstellation])

  // Calculate which orb is closest to a specific hand position
  // Uses VISUAL positions (after animation) for accurate selection
  const getClosestOrbForHand = useCallback((handPos, excludeOrbIds = []) => {
    let closest = null
    let minScore = Infinity // Combined score: lower is better

    orbs.forEach(orb => {
      if (!orb.active) return
      if (excludeOrbIds.includes(orb.id)) return

      // Use VISUAL position if available, otherwise use stored position
      const visualPos = orbVisualPositionsRef.current[orb.id]
      const orbPos = visualPos || new THREE.Vector3(...orb.position)

      // Project orb to screen
      const projected = orbPos.clone().project(camera)

      // CRITICAL: Skip planets behind the camera (Z > 1 in NDC means behind)
      // Also skip planets too far from camera view frustum
      if (projected.z > 1 || projected.z < -1) return

      const screenX = (projected.x + 1) / 2
      const screenY = (projected.y + 1) / 2

      // Screen distance from hand cursor
      const dx = handPos.x - screenX
      const dy = handPos.y - screenY
      const screenDist = Math.sqrt(dx * dx + dy * dy)

      // Calculate dynamic threshold based on planet size and distance from camera
      const planetSize = orb.planetSize || 0.5
      const distFromCamera = orbPos.distanceTo(camera.position)
      const baseThreshold = 0.20
      const sizeBonus = planetSize * 0.10
      const distanceFactor = Math.max(0.5, 20 / distFromCamera)
      const selectionThreshold = Math.min(0.35, baseThreshold + sizeBonus) * distanceFactor

      // If not within selection threshold, skip
      if (screenDist >= selectionThreshold) return

      // DEPTH PRIORITY: Create a score that prioritizes:
      // 1. Closer to cursor on screen (screenDist)
      // 2. Closer to camera (lower distFromCamera)
      // Score = screenDist + (distFromCamera / 100)
      // This way, when two planets overlap on screen, the closer one wins
      const depthPenalty = distFromCamera / 50 // Subtle depth influence
      const score = screenDist + depthPenalty

      if (score < minScore) {
        minScore = score
        closest = orb.id
      }
    })

    return closest
  }, [orbs, camera])

  // LOCK SYSTEM: Prevents selecting wrong planet when pinching
  // When cursor hovers over a planet for LOCK_TIME, it becomes "locked"
  // Only the locked planet can be grabbed until cursor moves away
  const LOCK_TIME = 250 // milliseconds to lock onto a planet (increased for stability)
  const lockedOrbRef = useRef(null)        // Currently locked planet ID
  const lockCandidateRef = useRef(null)    // Planet being considered for lock
  const lockStartTimeRef = useRef(0)       // When we started hovering over candidate

  // Legacy: single player closest orb
  const closestOrbRef = useRef(null)

  // Update closest orbs every frame with LOCK system
  useFrame(() => {
    const alreadyGrabbed = Object.values(grabbedOrbs)
    const now = performance.now()

    // Use legacy handPosition for primary cursor
    const primaryHand = handPosition

    // If currently dragging, maintain lock on grabbed orb
    if (grabbedOrbId) {
      closestOrbRef.current = grabbedOrbId
      lockedOrbRef.current = grabbedOrbId
      lockCandidateRef.current = null
      closestOrbsRef.current = {}
      return
    }

    // If in camera mode or not tracking, clear everything
    if (!isTracking || cameraMode === 'camera') {
      closestOrbRef.current = null
      lockedOrbRef.current = null
      lockCandidateRef.current = null
      closestOrbsRef.current = {}
      return
    }

    // Find what the cursor is currently over
    const currentClosest = getClosestOrbForHand(primaryHand, alreadyGrabbed)

    // LOCK LOGIC
    if (lockedOrbRef.current) {
      // We have a locked planet - check if cursor is still near it
      const lockedOrb = orbs.find(o => o.id === lockedOrbRef.current)
      if (lockedOrb && lockedOrb.active) {
        const visualPos = orbVisualPositionsRef.current[lockedOrb.id]
        const orbPos = visualPos || new THREE.Vector3(...lockedOrb.position)
        const projected = orbPos.clone().project(camera)
        const screenX = (projected.x + 1) / 2
        const screenY = (projected.y + 1) / 2
        const dx = primaryHand.x - screenX
        const dy = primaryHand.y - screenY
        const dist = Math.sqrt(dx * dx + dy * dy)

        // If cursor moved too far from locked planet, release lock
        const unlockThreshold = 0.3 // Generous threshold to prevent accidental unlock
        if (dist > unlockThreshold) {
          // Release lock and start considering new target
          lockedOrbRef.current = null
          lockCandidateRef.current = currentClosest
          lockStartTimeRef.current = now
        }
      } else {
        // Locked orb no longer exists or is inactive
        lockedOrbRef.current = null
        lockCandidateRef.current = currentClosest
        lockStartTimeRef.current = now
      }

      // While locked, the locked orb is THE closest (exclusive)
      closestOrbRef.current = lockedOrbRef.current

    } else {
      // No lock yet - work on acquiring one
      if (currentClosest) {
        if (currentClosest === lockCandidateRef.current) {
          // Same planet as before - check if we've hovered long enough
          const hoverTime = now - lockStartTimeRef.current
          if (hoverTime >= LOCK_TIME) {
            // LOCK acquired!
            console.log(`[LOCK] Locked onto: ${currentClosest}`)
            lockedOrbRef.current = currentClosest
            lockCandidateRef.current = null
          }
        } else {
          // New planet - start timing
          console.log(`[CANDIDATE] Hovering over: ${currentClosest}`)
          lockCandidateRef.current = currentClosest
          lockStartTimeRef.current = now
        }
      } else {
        // Cursor not over any planet - reset candidate
        lockCandidateRef.current = null
      }

      // Set closest (for visual feedback) - locked has priority
      closestOrbRef.current = lockedOrbRef.current || lockCandidateRef.current
    }

    // Clear multiplayer refs (we're using single player lock system)
    closestOrbsRef.current = {}
  })

  // The center is always at origin
  const centerPosition = useMemo(() => new THREE.Vector3(0, 0, 0), [])

  return (
    <>
      {/* Deep space background */}
      <color attach="background" args={['#000005']} />

      {/* Distant stars - multiple layers for depth */}
      <Stars
        radius={200}
        depth={100}
        count={8000}
        factor={6}
        saturation={0.1}
        fade
        speed={0.05}
      />

      {/* Closer stars with more color */}
      <Stars
        radius={80}
        depth={40}
        count={2000}
        factor={4}
        saturation={0.5}
        fade
        speed={0.1}
      />

      {/* Milky way glow effect */}
      <mesh rotation={[Math.PI / 4, 0, Math.PI / 6]}>
        <planeGeometry args={[300, 80]} />
        <meshBasicMaterial
          color="#1a1a3a"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ambient space lighting */}
      <ambientLight intensity={0.08} />

      {/* Ambient space lighting */}
      <ambientLight intensity={0.08} />

      {/* SOLAR SYSTEM ELEMENTS - Only visible in default mode */}
      {viewMode === 'default' && (
        <>
          {/* The Sun - center of our musical solar system */}
          <Sun weightedPrompts={weightedPrompts} />

          {/* Orbital paths for each planet */}
          <OrbitalPaths orbs={orbs} />

          {/* Energy beams from planets to Sun */}
          <ConnectionBeams orbs={orbs} weightedPrompts={weightedPrompts} center={centerPosition} />

          {/* Orbs - with LOCK system for single selection */}
          {orbs.map((orb) => {
            const weightData = weightedPrompts.find(w => w.orbId === orb.id)
            const weight = weightData?.weight || 0

            return (
              <SoundOrb
                key={orb.id}
                orb={orb}
                grabbedOrbId={grabbedOrbId}
                lockedOrbRef={lockedOrbRef}
                lockCandidateRef={lockCandidateRef}
                setGrabbedOrbId={setGrabbedOrbId}
                updateOrbPosition={updateOrbPosition}
                toggleOrbActive={toggleOrbActive}
                registerOrbPosition={registerOrbPosition}
                handPosition={handPosition}
                camera={camera}
                isPinching={isPinching}
                isTracking={isTracking}
                weight={weight}
                cameraMode={cameraMode}
                playerId={'player_0'}
                playerColor={'#00ffaa'}
              />
            )
          })}

          {/* Legacy single player cursor */}
          {players.length === 0 && isTracking && (
            <HandCursor
              handPosition={handPosition}
              isPinching={isPinching}
              isFist={isFist}
              hasGrabbedOrb={grabbedOrbId !== null}
              closestOrb={closestOrbRef.current}
              camera={camera}
              cameraMode={cameraMode}
            />
          )}

          {/* Grid */}
          <ReferenceGrid />
        </>
      )}

      {/* Multiplayer cursors - one per hand per player */}
      {players.map(player =>
        player.hands.map((hand, handIndex) => (
          <HandCursor
            key={`${player.id}_${handIndex}`}
            handPosition={hand.position}
            isPinching={hand.isPinching}
            isFist={hand.isFist}
            hasGrabbedOrb={!!grabbedOrbs[player.id]}
            closestOrb={closestOrbsRef.current[`${player.id}_${handIndex}`]}
            camera={camera}
            cameraMode={getCameraMode ? getCameraMode(player.id) : 'idle'}
            playerColor={player.color}
            playerId={player.id}
          />
        ))
      )}

      {/* BLACK HOLE MINIGAME */}
      {viewMode === 'black_hole' && (
        <>
          <BlackHole position={[0, -5, -10]} size={4} active={true} />
          <BlackHoleDropZone
            position={[0, -5, -10]}
            radius={8}
            orbs={orbs} // You might want distinct orbs for this minigame
            onOrbEnter={(orbId) => console.log('[DROP]', orbId)}
            onOrbApproach={(orbId, proximity) => console.log('[APPROACH]', orbId, proximity)}
          />
          <Text position={[0, 8, -10]} fontSize={1} color="white" anchorX="center" anchorY="middle">
            BURACO NEGRO - DROP ZONE
          </Text>
        </>
      )}

      {/* Navigation Portal - Global Navigation */}
      <NavigationPortal
        handPosition={handPosition}
        isPinching={isPinching}
        isTracking={isTracking}
      />

      {/* Constellation System - connect stars to create musical patterns */}
      {/* Now only active and visible in constellation mode */}
      <ConstellationSystem
        handPosition={handPosition}
        isPinching={isPinching}
        isTracking={isTracking}
        onConstellationComplete={handleConstellationComplete}
      />

      {/* Galaxy Map - visible when zoomed out in default mode */}
      {viewMode === 'default' && (
        <GalaxyMap
          handPosition={handPosition}
          isPinching={isPinching}
          isTracking={isTracking}
          onSelectGalaxy={handleSelectGalaxy}
        />
      )}

      {/* Warp Effect during galaxy transition */}
      <WarpEffect isActive={isTransitioning} progress={transitionProgress} />

      {/* Center Camera Button - Visible in Solar System and Constellation modes */}
      {/* Position at Z=5 in constellation mode to avoid conflict with stars at Z=-15 */}
      {(viewMode === 'default' || viewMode === 'constellation') && zoomLevel === 'solar_system' && (
        <CenterCameraButton
          handPosition={handPosition}
          isPinching={isPinching}
          onCenter={() => setShouldCenterCamera(true)}
          position={viewMode === 'constellation' ? [12, 6, 5] : [8, 6, 0]}
        />
      )}

      {/* Zoom Level Indicator */}
      {zoomLevel !== 'solar_system' && (
        <Text
          position={[0, -5, 0]}
          fontSize={1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {zoomLevel === 'galaxy_view' ? 'VISÃO GALÁCTICA' : 'VISÃO DO UNIVERSO'}
        </Text>
      )}
    </>
  )
}

/**
 * The Sun - Central star of our musical solar system
 * Intensity reflects total musical influence
 */
function Sun({ weightedPrompts }) {
  const sunRef = useRef()
  const coronaRef = useRef()
  const glowRef = useRef()
  const flareRefs = useRef([])

  const totalWeight = weightedPrompts.reduce((sum, w) => sum + w.weight, 0)
  const normalizedPower = Math.min(totalWeight / 8, 1.5)

  useFrame((state) => {
    const time = state.clock.elapsedTime

    // Sun rotation
    if (sunRef.current) {
      sunRef.current.rotation.y = time * 0.1
    }

    // Corona pulsing
    if (coronaRef.current) {
      const pulse = 1 + Math.sin(time * 1.5) * 0.1 * (1 + normalizedPower)
      coronaRef.current.scale.setScalar(pulse)
      coronaRef.current.rotation.z = time * 0.05
    }

    // Outer glow breathing
    if (glowRef.current) {
      const breathe = 1 + Math.sin(time * 0.8) * 0.15
      glowRef.current.scale.setScalar(breathe)
    }

    // Solar flares animation
    flareRefs.current.forEach((flare, i) => {
      if (flare) {
        const offset = (i / 6) * Math.PI * 2
        const flareScale = 0.8 + Math.sin(time * 2 + offset) * 0.3
        flare.scale.setScalar(flareScale)
        flare.rotation.z = time * 0.3 + offset
      }
    })
  })

  // Sun color shifts based on power (yellow -> orange -> white hot)
  const sunColor = useMemo(() => {
    const temp = 0.2 + normalizedPower * 0.3 // 0.2 to 0.5
    return `hsl(${40 - temp * 30}, 100%, ${55 + normalizedPower * 15}%)`
  }, [normalizedPower])

  const coronaColor = '#ffaa33'
  const glowColor = '#ff6600'

  return (
    <group position={[0, 0, 0]}>
      {/* Sun core */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={sunColor} />
      </mesh>

      {/* Sun surface texture (animated noise effect) */}
      <mesh>
        <sphereGeometry args={[1.22, 32, 32]} />
        <meshBasicMaterial
          color="#ffdd44"
          transparent
          opacity={0.3}
          wireframe
        />
      </mesh>

      {/* Corona - outer atmosphere */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial
          color={coronaColor}
          transparent
          opacity={0.15 + normalizedPower * 0.1}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Solar flares */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          ref={el => flareRefs.current[i] = el}
          position={[
            Math.cos(i / 6 * Math.PI * 2) * 1.5,
            Math.sin(i / 6 * Math.PI * 2) * 1.5,
            0
          ]}
        >
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.08 + normalizedPower * 0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Main light source */}
      <pointLight
        color="#fff5e0"
        intensity={3 + normalizedPower * 4}
        distance={50}
        decay={1.5}
      />

      {/* Secondary warm light */}
      <pointLight
        color="#ffaa44"
        intensity={1 + normalizedPower * 2}
        distance={30}
        decay={2}
      />

      {/* Solar particles */}
      <Sparkles
        count={100}
        size={2}
        scale={4}
        speed={0.5}
        color="#ffdd88"
        opacity={0.7}
      />
    </group>
  )
}

/**
 * Legacy InfluenceCore - kept for compatibility, now redirects to Sun
 */
function InfluenceCore({ weightedPrompts }) {
  return <Sun weightedPrompts={weightedPrompts} />
}

/**
 * Orbital Paths - Shows the orbital rings for each planet
 */
function OrbitalPaths({ orbs }) {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {orbs.map((orb) => {
        const radius = orb.orbitRadius || Math.sqrt(
          orb.position[0] ** 2 + orb.position[2] ** 2
        )

        return (
          <mesh key={orb.id}>
            <ringGeometry args={[radius - 0.02, radius + 0.02, 128]} />
            <meshBasicMaterial
              color={orb.color}
              transparent
              opacity={orb.active ? 0.3 : 0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}

      {/* Inner zone marker (high influence) */}
      <mesh>
        <ringGeometry args={[2.4, 2.6, 64]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Legacy InfluenceZones - now shows orbital paths
 */
function InfluenceZones() {
  // Kept for compatibility but does nothing visible now
  // Orbital paths are rendered by OrbitalPaths component
  return null
}

/**
 * Connection Beams
 */
function ConnectionBeams({ orbs, weightedPrompts, center }) {
  return (
    <group>
      {orbs.filter(o => o.active).map(orb => {
        const weightData = weightedPrompts.find(w => w.orbId === orb.id)
        const weight = weightData?.weight || 0.5
        const normalizedWeight = Math.min(weight / 1.5, 1)

        const start = new THREE.Vector3(...orb.position)
        const end = center.clone()

        return (
          <group key={orb.id}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([...start.toArray(), ...end.toArray()])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={orb.color}
                transparent
                opacity={0.2 + normalizedWeight * 0.4}
              />
            </line>

            <EnergyParticles
              start={start}
              end={end}
              color={orb.color}
              intensity={normalizedWeight}
            />
          </group>
        )
      })}
    </group>
  )
}

/**
 * Energy Particles
 */
function EnergyParticles({ start, end, color, intensity }) {
  const particlesRef = useRef([])
  const count = Math.floor(2 + intensity * 4)

  useFrame((state) => {
    const time = state.clock.elapsedTime

    particlesRef.current.forEach((particle, i) => {
      if (particle) {
        const t = ((time * 0.4 + i * 0.25) % 1)
        particle.position.lerpVectors(start, end, t)

        const fade = Math.sin(t * Math.PI)
        particle.material.opacity = fade * 0.7 * intensity

        const scale = 0.06 + Math.sin(time * 4 + i) * 0.02
        particle.scale.setScalar(scale * (1 + intensity * 0.5))
      }
    })
  })

  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={el => particlesRef.current[i] = el}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Planet - Orbiting musical body in our solar system
 * 
 * Features:
 * - Orbital motion around the Sun (when not grabbed)
 * - Grab to change orbit radius (closer = more influence)
 * - Planet-specific visuals (size, rings, moons)
 * - Hand depth controls distance from Sun
 */
function SoundOrb({
  orb,
  grabbedOrbId,          // Currently grabbed orb ID (from parent state)
  lockedOrbRef,          // Ref to locked orb ID (checked in useFrame)
  lockCandidateRef,      // Ref to candidate orb ID (checked in useFrame)
  setGrabbedOrbId,
  updateOrbPosition,
  toggleOrbActive,
  registerOrbPosition,
  handPosition,
  camera,
  isPinching,
  isTracking,
  weight,
  cameraMode,
  playerId = 'player_0',
  playerColor
}) {
  // Compute grabbed state (this is from React state, so it's reliable)
  const isGrabbed = grabbedOrbId === orb.id

  const groupRef = useRef()
  const meshRef = useRef()
  const glowRef = useRef()
  const ringRef = useRef()
  const labelRef = useRef()
  const highlightRef = useRef()
  const ringsRef = useRef() // Saturn's rings
  const moonRef = useRef()  // Earth's moon

  // Visual indicator refs (controlled in useFrame for real-time updates)
  const candidateRingRef = useRef()
  const lockedRingRef = useRef()
  const lockedInnerRingRef = useRef()
  const grabbedRingRef = useRef()
  const grabbedOuterRingRef = useRef()

  // Orbital state
  const orbitAngleRef = useRef(orb.orbitOffset || 0)
  const targetOrbitAngleRef = useRef(orb.orbitOffset || 0)
  const currentOrbitRadius = useRef(orb.orbitRadius || 5)
  const targetOrbitRadius = useRef(orb.orbitRadius || 5)

  const currentPosition = useRef(new THREE.Vector3(...orb.position))
  const targetPosition = useRef(new THREE.Vector3(...orb.position))

  // Grab state
  const grabStartAngleOffset = useRef(0) // Offset between cursor angle and planet angle at grab start
  const wasGrabbed = useRef(false)

  // Orbital distance limits (Sun radius + margin to max orbit)
  const MIN_ORBIT_RADIUS = 2.0   // Close to Sun (high influence)
  const MAX_ORBIT_RADIUS = 12    // Far from Sun (low influence)

  const normalizedWeight = weight > 0 ? Math.min(weight / 1.5, 1) : 0.3
  const planetSize = orb.planetSize || 0.5

  // isClosest is derived from lock state (for visual feedback)
  const isClosest = lockedOrbRef?.current === orb.id || lockCandidateRef?.current === orb.id

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const time = state.clock.elapsedTime

    // Check lock state in real-time from refs
    const isLocked = lockedOrbRef?.current === orb.id
    const isCandidate = lockCandidateRef?.current === orb.id && !isLocked
    const canGrab = isLocked || isGrabbed

    // Don't allow grabbing while in camera mode
    if (cameraMode === 'camera') {
      updatePlanetPosition(time, delta)
      updatePlanetVisuals(time, isLocked, isCandidate)
      return
    }

    // Grab detection - ONLY if locked (prevents multi-selection)
    if (isTracking && orb.active) {
      if (isPinching && canGrab && !isGrabbed) {
        console.log(`[GRAB] ${orb.id} (was locked: ${isLocked})`)
        setGrabbedOrbId(orb.id, playerId)
        wasGrabbed.current = true
      }

      if (!isPinching && isGrabbed) {
        setGrabbedOrbId(null, playerId)
        // Update the orb's stored position
        updateOrbPosition(orb.id, currentPosition.current.toArray())
        wasGrabbed.current = false
      }
    }

    // Update position
    if (isGrabbed) {
      // Convert cursor position to NDC (-1 to 1)
      const ndcX = (handPosition.x - 0.5) * 2
      const ndcY = (handPosition.y - 0.5) * 2

      // RAYCAST: Project cursor onto the orbital plane (Y=0)
      // This makes the planet visually follow the cursor on screen
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

      // Intersect with the horizontal plane at Y=0 (orbital plane)
      const orbitalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const targetPoint = new THREE.Vector3()
      raycaster.ray.intersectPlane(orbitalPlane, targetPoint)

      if (targetPoint) {
        // Calculate angle and radius from the intersection point
        const targetAngle = Math.atan2(targetPoint.z, targetPoint.x)
        const targetDist = Math.sqrt(targetPoint.x * targetPoint.x + targetPoint.z * targetPoint.z)

        // Clamp radius to valid orbit range
        const clampedRadius = Math.max(MIN_ORBIT_RADIUS, Math.min(MAX_ORBIT_RADIUS, targetDist))

        targetOrbitRadius.current = clampedRadius
        targetOrbitAngleRef.current = targetAngle
      }
    }

    updatePlanetPosition(time, delta)

    // Report visual position for selection
    if (registerOrbPosition) {
      registerOrbPosition(orb.id, currentPosition.current)
    }

    updatePlanetVisuals(time, isLocked, isCandidate)
  })

  // Helper to smoothly interpolate angles (handles wraparound)
  function lerpAngle(current, target, t) {
    let diff = target - current
    // Normalize to -PI to PI range
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    return current + diff * t
  }

  function updatePlanetPosition(time, delta) {
    // Smooth orbit radius changes
    const radiusLerpSpeed = isGrabbed ? 0.12 : 0.08
    currentOrbitRadius.current += (targetOrbitRadius.current - currentOrbitRadius.current) * radiusLerpSpeed

    if (!isGrabbed) {
      // Natural orbital motion (Kepler-ish: faster when closer)
      const orbitSpeed = orb.orbitSpeed || 1
      const speedMultiplier = Math.pow(5 / currentOrbitRadius.current, 0.5)
      targetOrbitAngleRef.current += orbitSpeed * speedMultiplier * delta * 0.3
    }

    // Smooth angle interpolation (prevents sudden jumps)
    const angleLerpSpeed = isGrabbed ? 0.2 : 0.15
    orbitAngleRef.current = lerpAngle(orbitAngleRef.current, targetOrbitAngleRef.current, angleLerpSpeed)

    // Calculate orbital position
    const radius = currentOrbitRadius.current
    const angle = orbitAngleRef.current
    const tilt = orb.tiltAngle || 0

    targetPosition.current.set(
      Math.cos(angle) * radius,
      Math.sin(tilt) * Math.sin(angle) * radius * 0.1,
      Math.sin(angle) * radius
    )

    // Smooth position interpolation - faster when grabbed for responsiveness
    const posLerpSpeed = isGrabbed ? 0.25 : 0.1
    currentPosition.current.lerp(targetPosition.current, posLerpSpeed)
  }

  function updatePlanetVisuals(time, isLocked, isCandidate) {
    if (!meshRef.current) return

    meshRef.current.position.copy(currentPosition.current)

    // Planet rotation (self-rotation)
    meshRef.current.rotation.y = time * 0.5

    // Size based on weight when active
    const baseSize = planetSize
    const weightBonus = orb.active ? normalizedWeight * 0.2 : 0
    // Scale up when locked or grabbed
    const grabScale = isGrabbed ? 1.3 : (isLocked ? 1.15 : (isCandidate ? 1.08 : 1))
    const pulseScale = orb.active ? 1 + Math.sin(time * 2) * 0.03 * normalizedWeight : 1

    const finalScale = (baseSize + weightBonus) * grabScale * pulseScale
    meshRef.current.scale.setScalar(finalScale)

    // Update glow
    if (glowRef.current) {
      glowRef.current.position.copy(meshRef.current.position)
      const glowSize = finalScale * 2.5
      glowRef.current.scale.setScalar(glowSize)
      glowRef.current.material.opacity = orb.active ? 0.1 + normalizedWeight * 0.15 : 0.03
    }

    // Update CANDIDATE indicator (yellow ring)
    if (candidateRingRef.current) {
      candidateRingRef.current.position.copy(meshRef.current.position)
      candidateRingRef.current.lookAt(camera.position)
      candidateRingRef.current.visible = isCandidate && !isGrabbed && orb.active
      candidateRingRef.current.rotation.z = time * 3 // Spin faster to show "loading"
    }

    // Update LOCKED indicators (green rings)
    if (lockedRingRef.current) {
      lockedRingRef.current.position.copy(meshRef.current.position)
      lockedRingRef.current.lookAt(camera.position)
      lockedRingRef.current.visible = isLocked && !isGrabbed && orb.active
    }
    if (lockedInnerRingRef.current) {
      lockedInnerRingRef.current.position.copy(meshRef.current.position)
      lockedInnerRingRef.current.lookAt(camera.position)
      lockedInnerRingRef.current.visible = isLocked && !isGrabbed && orb.active
      lockedInnerRingRef.current.rotation.z = time * 2
    }

    // Update GRABBED indicators
    if (grabbedRingRef.current) {
      grabbedRingRef.current.position.copy(meshRef.current.position)
      grabbedRingRef.current.lookAt(camera.position)
      grabbedRingRef.current.visible = isGrabbed
    }
    if (grabbedOuterRingRef.current) {
      grabbedOuterRingRef.current.position.copy(meshRef.current.position)
      grabbedOuterRingRef.current.lookAt(camera.position)
      grabbedOuterRingRef.current.visible = isGrabbed
      grabbedOuterRingRef.current.rotation.z = time * 1.5
    }

    // Update Saturn's rings
    if (ringsRef.current && orb.hasRings) {
      ringsRef.current.position.copy(meshRef.current.position)
      ringsRef.current.rotation.x = Math.PI / 2.5 // Tilted rings
      ringsRef.current.rotation.z = time * 0.1
    }

    // Update Earth's moon
    if (moonRef.current && orb.hasMoon) {
      const moonAngle = time * 2
      const moonDist = finalScale * 2
      moonRef.current.position.set(
        meshRef.current.position.x + Math.cos(moonAngle) * moonDist,
        meshRef.current.position.y + 0.1,
        meshRef.current.position.z + Math.sin(moonAngle) * moonDist
      )
    }

    // Update label
    if (labelRef.current) {
      labelRef.current.position.copy(meshRef.current.position)
      labelRef.current.position.y -= (finalScale + 0.3)
      labelRef.current.lookAt(camera.position)
    }
  }

  const color = orb.active ? orb.color : '#333344'
  const emissiveIntensity = orb.active ? (0.2 + normalizedWeight * 0.4) * (isClosest ? 1.3 : 1) : 0.05
  const displayName = orb.planetName || orb.label

  return (
    <group ref={groupRef}>
      {/* Planet body */}
      <mesh
        ref={meshRef}
        onDoubleClick={() => toggleOrbActive(orb.id)}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          roughness={0.6}
          metalness={0.1}
          transparent={!orb.active}
          opacity={orb.active ? 1 : 0.4}
        />
      </mesh>

      {/* Atmospheric glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          side={THREE.BackSide}
        />
      </mesh>

      {/* CANDIDATE indicator - yellow ring (cursor over, waiting for lock) */}
      <mesh ref={candidateRingRef} visible={false}>
        <ringGeometry args={[1.3, 1.5, 32]} />
        <meshBasicMaterial
          color="#ffaa00"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* LOCKED indicator - green ring (ready to grab!) */}
      <mesh ref={lockedRingRef} visible={false}>
        <ringGeometry args={[1.4, 1.6, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={lockedInnerRingRef} visible={false}>
        <ringGeometry args={[1.2, 1.35, 32]} />
        <meshBasicMaterial
          color="#00ffaa"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* GRABBED indicator - bright green double ring */}
      <mesh ref={grabbedRingRef} visible={false}>
        <ringGeometry args={[1.45, 1.65, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={grabbedOuterRingRef} visible={false}>
        <ringGeometry args={[1.75, 1.9, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Saturn's Rings */}
      {orb.hasRings && (
        <mesh ref={ringsRef}>
          <ringGeometry args={[1.4, 2.2, 64]} />
          <meshBasicMaterial
            color="#d4be8d"
            transparent
            opacity={orb.active ? 0.6 : 0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Earth's Moon */}
      {orb.hasMoon && (
        <mesh ref={moonRef}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color="#aaaaaa"
            emissive="#666666"
            emissiveIntensity={0.1}
            roughness={0.8}
          />
        </mesh>
      )}

      {/* Planet label */}
      <group ref={labelRef}>
        <Text
          fontSize={0.2}
          color={orb.active ? (isClosest ? "#ffffff" : "#cccccc") : "#666666"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#000000"
        >
          {displayName}
        </Text>
        {orb.active && (
          <Text
            position={[0, -0.28, 0]}
            fontSize={0.15}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {Math.round(normalizedWeight * 100)}%
          </Text>
        )}
      </group>

      {/* Planet light emission when active */}
      {orb.active && (
        <pointLight
          position={currentPosition.current.toArray()}
          color={color}
          intensity={(0.3 + normalizedWeight * 0.8) * (isClosest ? 1.3 : 1)}
          distance={2 + normalizedWeight * 1.5}
          decay={2}
        />
      )}

      {/* Particle trail for high-influence planets */}
      {orb.active && normalizedWeight > 0.6 && (
        <Sparkles
          count={Math.floor(normalizedWeight * 15)}
          size={1.5}
          scale={planetSize * 3}
          position={currentPosition.current.toArray()}
          speed={0.3}
          color={color}
          opacity={normalizedWeight * 0.7}
        />
      )}
    </group>
  )
}

/**
 * Hand Cursor - Supports multiplayer with player colors
 */
function HandCursor({
  handPosition,
  isPinching,
  isFist,
  hasGrabbedOrb,
  closestOrb,
  camera,
  cameraMode,
  playerColor,
  playerId
}) {
  const groupRef = useRef()
  const ringsRef = useRef([])

  useFrame((state) => {
    if (!groupRef.current) return

    const time = state.clock.elapsedTime

    const ndcX = (handPosition.x - 0.5) * 2
    const ndcY = (handPosition.y - 0.5) * 2

    const cursorPos = new THREE.Vector3(ndcX, ndcY, 0.5)
    cursorPos.unproject(camera)

    const camToPos = cursorPos.clone().sub(camera.position)
    camToPos.normalize().multiplyScalar(10)
    groupRef.current.position.copy(camera.position).add(camToPos)

    groupRef.current.lookAt(camera.position)

    ringsRef.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.z = time * (1 + i * 0.5) * (cameraMode === 'camera' ? 2 : 1)
      }
    })
  })

  // Base color from player, or default
  const baseColor = playerColor || '#00ffff'

  // Color based on mode (modulate player color)
  let color = baseColor
  let label = playerId ? playerId.replace('player_', 'P') : 'READY'

  if (cameraMode === 'camera') {
    color = '#00ff88'
    label = 'CAM'
  } else if (hasGrabbedOrb) {
    color = playerColor || '#ffaa00'
    label = 'GRAB'
  } else if (isPinching) {
    color = playerColor || '#ff00aa'
    label = 'PINCH'
  } else if (closestOrb) {
    label = 'HOVER'
  }

  const size = cameraMode === 'camera' ? 0.2 : (isPinching ? 0.18 : 0.14)

  return (
    <group ref={groupRef}>
      {/* Core */}
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Outer glow with player color */}
      <mesh>
        <sphereGeometry args={[size * 2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Rings */}
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => (ringsRef.current[i] = el)}>
          <torusGeometry args={[size * (2 + i), 0.015, 8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5 - i * 0.15} />
        </mesh>
      ))}

      {/* Player color indicator ring */}
      {playerColor && (
        <mesh>
          <ringGeometry args={[size * 2.8, size * 3.2, 32]} />
          <meshBasicMaterial color={playerColor} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Camera mode indicator - square */}
      {cameraMode === 'camera' && (
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <ringGeometry args={[size * 2.5, size * 3, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Grab indicator - circle */}
      {hasGrabbedOrb && (
        <mesh>
          <ringGeometry args={[size * 2, size * 2.8, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Hover indicator */}
      {closestOrb && !hasGrabbedOrb && !isPinching && cameraMode !== 'camera' && (
        <mesh>
          <ringGeometry args={[size * 2.2, size * 2.5, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Label */}
      <Text
        position={[0, -size * 3.5, 0]}
        fontSize={0.12}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>

      {/* Depth hint when grabbing */}
      {hasGrabbedOrb && (
        <Text
          position={[0, -size * 5, 0]}
          fontSize={0.08}
          color="#888888"
          anchorX="center"
          anchorY="middle"
        >
          Hand depth = orb distance
        </Text>
      )}

      <pointLight color={color} intensity={cameraMode === 'camera' ? 3 : (isPinching || hasGrabbedOrb ? 2.5 : 1.5)} distance={5} decay={2} />
    </group>
  )
}

/**
 * Reference Grid
 */
/**
 * CenterCameraButton - Interactive 3D button to reset camera position
 * Billboard style - always faces camera
 */
function CenterCameraButton({ handPosition, isPinching, onCenter, position = [8, 6, 0] }) {
  const { camera } = useThree()
  const groupRef = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [wasActivated, setWasActivated] = useState(false)
  const [pulseScale, setPulseScale] = useState(1)

  useFrame((state) => {
    // Billboard effect - always face the camera
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position)
    }

    // Pulse animation
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05
    setPulseScale(pulse)

    if (!handPosition?.x) {
      setIsHovered(false)
      return
    }

    // Convert hand position to NDC
    const ndcX = (handPosition.x - 0.5) * 2
    const ndcY = (handPosition.y - 0.5) * 2

    // Project button position to screen
    const buttonPos = new THREE.Vector3(...position)
    const projected = buttonPos.project(camera.clone())

    const dx = ndcX - projected.x
    const dy = ndcY - projected.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const isInRange = dist < 0.25
    setIsHovered(isInRange)

    // Trigger on pinch while hovering
    if (isInRange && isPinching && !wasActivated) {
      setWasActivated(true)
      onCenter?.()
      console.log('[CAMERA] Centralizando câmera')
    }

    if (!isPinching) {
      setWasActivated(false)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Background glow */}
      <mesh scale={isHovered ? 1.3 : 1.1}>
        <planeGeometry args={[3.5, 1.2]} />
        <meshBasicMaterial
          color={isHovered ? '#00ff88' : '#4488ff'}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Main button background */}
      <mesh scale={pulseScale}>
        <planeGeometry args={[3, 0.9]} />
        <meshBasicMaterial
          color={isHovered ? '#00ff88' : '#224488'}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Border */}
      <mesh>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial
          color={isHovered ? '#00ffaa' : '#6699ff'}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Text */}
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.35}
        color={isHovered ? '#003322' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        🎯 CENTRALIZAR
      </Text>

      {/* Hover indicator */}
      {isHovered && (
        <mesh position={[0, 0, -0.01]} scale={1.2}>
          <ringGeometry args={[1.6, 1.8, 32]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/**
 * Ecliptic Plane - The orbital plane of the solar system
 */
function ReferenceGrid() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Subtle grid for spatial reference */}
      <gridHelper
        args={[50, 25, '#111133', '#080815']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      />
      {/* Removed ecliptic plane mesh - was causing visual obstruction */}
    </group>
  )
}

export default SpaceScene

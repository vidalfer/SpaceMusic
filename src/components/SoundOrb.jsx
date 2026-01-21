import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

/**
 * State Colors for visual feedback
 */
const STATE_COLORS = {
  idle: null, // Uses orb's default color
  grabbed: '#ff00ff',
  loading: '#ffaa00',
  ready: '#00ff88'
}

/**
 * SoundOrb Component
 * Interactive 3D orb that responds to hand gestures
 */
function SoundOrb({ orb, index, handPosition, isPinching, isTracking }) {
  const meshRef = useRef()
  const glowRef = useRef()
  const { viewport } = useThree()
  
  const { updateOrb, grabbedOrbId, setGrabbedOrbId } = useAppStore()
  
  // Local position state
  const [position, setPosition] = useState(() => new THREE.Vector3(...orb.position))
  const targetPosition = useRef(new THREE.Vector3(...orb.position))
  
  // Original position reference
  const originalPosition = useMemo(() => new THREE.Vector3(...orb.position), [orb.position])
  
  // Check if this orb is currently grabbed
  const isGrabbed = grabbedOrbId === orb.id
  
  // Convert hand position (0-1) to 3D world coordinates
  const handWorldPosition = useMemo(() => {
    return new THREE.Vector3(
      (handPosition.x - 0.5) * viewport.width,
      (handPosition.y - 0.5) * viewport.height,
      0
    )
  }, [handPosition.x, handPosition.y, viewport.width, viewport.height])

  // Magnetic attraction threshold
  const GRAB_THRESHOLD = 2.0
  const MAGNETIC_RANGE = 3.5

  /**
   * Handle grab/release logic
   */
  useEffect(() => {
    if (!isTracking) return

    const distanceToHand = position.distanceTo(handWorldPosition)
    const isInRange = distanceToHand < GRAB_THRESHOLD

    // Grab logic
    if (isPinching && isInRange && !grabbedOrbId && !isGrabbed) {
      setGrabbedOrbId(orb.id)
      updateOrb(orb.id, { state: 'grabbed' })
      console.log(`🎯 Grabbed: ${orb.label}`)
    }
    
    // Release logic
    if (isGrabbed && !isPinching) {
      console.log(`📤 Released: ${orb.label}`)
      
      // Check if released in center zone
      const isInCenterZone = position.length() < 1.8
      
      if (isInCenterZone) {
        console.log(`⏳ ${orb.label}: Simulating AI generation...`)
        updateOrb(orb.id, { state: 'loading' })
        
        // Simulate 3s AI latency
        setTimeout(() => {
          updateOrb(orb.id, { state: 'ready' })
          console.log(`🎵 Audio Swapped at Next Bar: ${orb.label}`)
          
          // Reset after showing ready state
          setTimeout(() => {
            updateOrb(orb.id, { state: 'idle' })
          }, 2000)
        }, 3000)
      } else {
        updateOrb(orb.id, { state: 'idle' })
      }
      
      setGrabbedOrbId(null)
      targetPosition.current.copy(originalPosition)
    }
  }, [isPinching, isTracking, isGrabbed, grabbedOrbId, position, handWorldPosition, orb.id, orb.label, originalPosition, setGrabbedOrbId, updateOrb])

  /**
   * Animation frame updates
   */
  useFrame((state, delta) => {
    if (!meshRef.current) return

    const time = state.clock.elapsedTime

    // Update target position if grabbed
    if (isGrabbed) {
      targetPosition.current.copy(handWorldPosition)
    }

    // Smooth position interpolation (LERP)
    position.lerp(targetPosition.current, isGrabbed ? 0.25 : 0.08)
    
    // Magnetic attraction when near hand (but not grabbed)
    if (!isGrabbed && isTracking) {
      const distanceToHand = position.distanceTo(handWorldPosition)
      if (distanceToHand < MAGNETIC_RANGE && distanceToHand > 0.5) {
        const attractionStrength = (1 - distanceToHand / MAGNETIC_RANGE) * 0.15
        const direction = handWorldPosition.clone().sub(position).normalize()
        position.add(direction.multiplyScalar(attractionStrength))
      }
    }

    // Apply position to mesh
    meshRef.current.position.copy(position)

    // Floating animation (disabled when grabbed)
    if (!isGrabbed) {
      const floatOffset = Math.sin(time * 1.5 + index * Math.PI * 0.5) * 0.15
      meshRef.current.position.y += floatOffset
    }

    // Rotation animation
    meshRef.current.rotation.x = time * 0.3 + index
    meshRef.current.rotation.y = time * 0.4 + index * 0.5

    // Scale based on state
    const baseScale = isGrabbed ? 1.4 : 1
    const pulseScale = 1 + Math.sin(time * (orb.state === 'loading' ? 8 : 3)) * (orb.state === 'loading' ? 0.2 : 0.08)
    meshRef.current.scale.setScalar(baseScale * pulseScale)

    // Update glow position
    if (glowRef.current) {
      glowRef.current.position.copy(meshRef.current.position)
      glowRef.current.scale.setScalar(baseScale * 1.8)
    }
  })

  // Determine current color based on state
  const currentColor = useMemo(() => {
    if (orb.state !== 'idle' && STATE_COLORS[orb.state]) {
      return STATE_COLORS[orb.state]
    }
    return orb.color
  }, [orb.state, orb.color])

  return (
    <group>
      {/* Main Orb */}
      <mesh ref={meshRef} position={orb.position}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={currentColor}
          emissive={currentColor}
          emissiveIntensity={orb.state === 'loading' ? 1.5 : 0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      {/* Glow effect */}
      <mesh ref={glowRef} position={orb.position}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial
          color={currentColor}
          transparent
          opacity={0.25}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Label - follows the orb */}
      <OrbLabel 
        meshRef={meshRef} 
        label={orb.label} 
        state={orb.state}
        color={currentColor}
      />

      {/* State indicator ring */}
      {orb.state !== 'idle' && (
        <StateRing meshRef={meshRef} color={currentColor} />
      )}
    </group>
  )
}

/**
 * Label that follows the orb
 */
function OrbLabel({ meshRef, label, state, color }) {
  const textRef = useRef()

  useFrame(() => {
    if (textRef.current && meshRef.current) {
      textRef.current.position.x = meshRef.current.position.x
      textRef.current.position.y = meshRef.current.position.y - 0.9
      textRef.current.position.z = meshRef.current.position.z
    }
  })

  const stateIndicator = state === 'loading' ? ' ⏳' : state === 'ready' ? ' ✓' : ''

  return (
    <Text
      ref={textRef}
      fontSize={0.22}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.03}
      outlineColor="#000000"
    >
      {label}{stateIndicator}
    </Text>
  )
}

/**
 * Animated ring for active states
 */
function StateRing({ meshRef, color }) {
  const ringRef = useRef()

  useFrame((state) => {
    if (ringRef.current && meshRef.current) {
      ringRef.current.position.copy(meshRef.current.position)
      ringRef.current.rotation.x = Math.PI / 2
      ringRef.current.rotation.z = state.clock.elapsedTime * 2
      
      // Pulsing scale
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1
      ringRef.current.scale.setScalar(scale)
    }
  })

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[0.75, 0.03, 8, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.7}
      />
    </mesh>
  )
}

export default SoundOrb

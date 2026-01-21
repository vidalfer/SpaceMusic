import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import SoundOrb from './SoundOrb'
import HandCursor from './HandCursor'
import { useAppStore } from '../store/appStore'

/**
 * Main 3D Scene Component
 * Contains the environment, orbs, and hand cursor
 */
function Scene({ handPosition, isPinching, isTracking }) {
  const { orbs } = useAppStore()
  const groupRef = useRef()

  // Subtle scene rotation for atmosphere
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
  })

  return (
    <>
      {/* Background color */}
      <color attach="background" args={['#0a0a0f']} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#00ffaa" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#ff00aa" />
      <spotLight
        position={[0, 10, 0]}
        angle={0.5}
        penumbra={1}
        intensity={1}
        color="#ffffff"
      />

      {/* Background Elements */}
      <Stars 
        radius={50} 
        depth={50} 
        count={1500} 
        factor={4} 
        saturation={0} 
        fade 
        speed={0.5}
      />
      
      <Sparkles
        count={50}
        scale={12}
        size={2}
        speed={0.3}
        opacity={0.5}
        color="#00ffaa"
      />

      {/* Center Activation Zone */}
      <CenterZone />

      {/* Sound Orbs Group */}
      <group ref={groupRef}>
        {orbs.map((orb, index) => (
          <SoundOrb
            key={orb.id}
            orb={orb}
            index={index}
            handPosition={handPosition}
            isPinching={isPinching}
            isTracking={isTracking}
          />
        ))}
      </group>

      {/* Hand Cursor - always show for debugging, dim when not tracking */}
      <HandCursor 
        position={handPosition} 
        isPinching={isPinching}
        isTracking={isTracking}
      />

      {/* Grid Floor */}
      <GridFloor />
    </>
  )
}

/**
 * Center Activation Zone - where orbs are dropped to activate
 */
function CenterZone() {
  const meshRef = useRef()
  const ringRef = useRef()

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.2
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.05)
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = -state.clock.elapsedTime * 0.3
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Outer ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.5, 0.03, 16, 64]} />
        <meshBasicMaterial color="#00ffaa" transparent opacity={0.6} />
      </mesh>

      {/* Inner pulsing zone */}
      <mesh ref={meshRef}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial 
          color="#00ffaa" 
          transparent 
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Drop Zone Text indicator */}
      <mesh position={[0, -2, 0]}>
        <planeGeometry args={[3, 0.5]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

/**
 * Animated Grid Floor
 */
function GridFloor() {
  const gridRef = useRef()

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.z = (state.clock.elapsedTime * 0.5) % 1
    }
  })

  return (
    <group position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <gridHelper 
        ref={gridRef}
        args={[50, 50, '#00ffaa', '#1a1a2f']} 
      />
      <mesh receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial 
          color="#0a0a0f"
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

export default Scene

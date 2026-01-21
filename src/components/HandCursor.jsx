import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * HandCursor Component
 * Visual representation of the user's hand in 3D space
 */
function HandCursor({ position, isPinching, isTracking }) {
  const groupRef = useRef()
  const innerRef = useRef()
  const outerRef = useRef()
  const ringsRef = useRef([])
  const { viewport } = useThree()

  // Convert normalized position (0-1) to world coordinates
  const worldPosition = useMemo(() => {
    return new THREE.Vector3(
      (position.x - 0.5) * viewport.width,
      (position.y - 0.5) * viewport.height,
      0.5 // Slightly in front
    )
  }, [position.x, position.y, viewport.width, viewport.height])

  // Colors based on state
  const cursorColor = isPinching ? '#ff00aa' : '#00ffaa'
  const opacity = isTracking ? 1 : 0.3

  useFrame((state) => {
    if (!groupRef.current) return

    const time = state.clock.elapsedTime

    // Smooth position update
    groupRef.current.position.lerp(worldPosition, 0.35)

    // Inner sphere animation
    if (innerRef.current) {
      const scale = isPinching ? 0.18 : 0.12
      const pulseScale = scale + Math.sin(time * 8) * 0.02
      innerRef.current.scale.setScalar(pulseScale)
    }

    // Outer glow animation
    if (outerRef.current) {
      const scale = isPinching ? 0.35 : 0.28
      outerRef.current.scale.setScalar(scale + Math.sin(time * 4) * 0.03)
      outerRef.current.rotation.z = time * 2
    }

    // Animate orbit rings
    ringsRef.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.x = time * (1 + i * 0.5)
        ring.rotation.y = time * (0.5 + i * 0.3)
      }
    })
  })

  return (
    <group ref={groupRef}>
      {/* Inner core */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95 * opacity}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={0.4 * opacity}
        />
      </mesh>

      {/* Orbital rings */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => (ringsRef.current[i] = el)}
        >
          <torusGeometry args={[0.22 + i * 0.08, 0.012, 8, 32]} />
          <meshBasicMaterial
            color={cursorColor}
            transparent
            opacity={(0.5 - i * 0.12) * opacity}
          />
        </mesh>
      ))}

      {/* Pinch indicator */}
      {isPinching && (
        <PinchEffect color={cursorColor} />
      )}

      {/* Point light for glow effect */}
      <pointLight
        color={cursorColor}
        intensity={isTracking ? (isPinching ? 2 : 1) : 0.3}
        distance={4}
        decay={2}
      />
    </group>
  )
}

/**
 * Expanding ring effect when pinching
 */
function PinchEffect({ color }) {
  const ringsRef = useRef([])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    ringsRef.current.forEach((ring, i) => {
      if (ring) {
        // Staggered expansion animation
        const phase = (time * 3 + i * 0.4) % 1
        const scale = 0.15 + phase * 0.35
        const opacity = (1 - phase) * 0.6

        ring.scale.setScalar(scale)
        ring.material.opacity = opacity
      }
    })
  })

  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => (ringsRef.current[i] = el)}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.9, 1, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  )
}

export default HandCursor

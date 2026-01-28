import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import * as THREE from 'three'

/**
 * BlackHole - Dramatic visual effect with gravitational influence
 * Creates "drop" or silence zones when planets enter
 * 
 * Features:
 * - Gravitational pull visual (accretion disk)
 * - Event horizon (point of no return)
 * - Particle absorption effect
 * - Audio "drop" trigger zone
 */
function BlackHole({
    position = [0, 0, -20],
    size = 3,
    onPlanetEnter,
    onPlanetNear,
    active = true
}) {
    const groupRef = useRef()
    const diskRef = useRef()
    const eventHorizonRef = useRef()
    const distortionRingsRef = useRef([])
    const particlesRef = useRef([])

    // Generate accretion disk particles
    const diskParticles = useMemo(() => {
        return Array.from({ length: 100 }, (_, i) => ({
            angle: (i / 100) * Math.PI * 2,
            radius: size * 1.5 + Math.random() * size * 2,
            speed: 0.5 + Math.random() * 1.5,
            size: 0.05 + Math.random() * 0.1,
            color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00'
        }))
    }, [size])

    useFrame((state, delta) => {
        if (!active) return

        const time = state.clock.elapsedTime

        // Rotate entire black hole slowly
        if (groupRef.current) {
            groupRef.current.rotation.y = time * 0.05
        }

        // Animate accretion disk
        if (diskRef.current) {
            diskRef.current.rotation.z = time * 0.8
        }

        // Pulsate event horizon
        if (eventHorizonRef.current) {
            const pulse = 1 + Math.sin(time * 2) * 0.05
            eventHorizonRef.current.scale.setScalar(pulse)
        }

        // Animate distortion rings (gravitational lensing effect)
        distortionRingsRef.current.forEach((ring, i) => {
            if (ring) {
                const scale = 1 + Math.sin(time * 3 + i) * 0.1
                ring.scale.setScalar(scale)
                ring.rotation.x = Math.sin(time * 0.5 + i) * 0.2
                ring.rotation.y = time * (0.1 + i * 0.05)
            }
        })

        // Animate particles spiraling in
        particlesRef.current.forEach((particle, i) => {
            if (!particle) return

            const data = diskParticles[i]

            // Spiral inward over time
            const spiralAngle = data.angle + time * data.speed
            const spiralRadius = data.radius * (0.5 + 0.5 * Math.cos(time * 0.2))

            particle.position.x = Math.cos(spiralAngle) * spiralRadius
            particle.position.z = Math.sin(spiralAngle) * spiralRadius
            particle.position.y = Math.sin(spiralAngle * 2) * 0.3

            // Fade out as it gets closer
            const distFromCenter = spiralRadius / (size * 3)
            particle.material.opacity = Math.min(1, distFromCenter)
        })
    })

    if (!active) return null

    return (
        <group ref={groupRef} position={position}>
            {/* Event Horizon - The black sphere */}
            <mesh ref={eventHorizonRef}>
                <sphereGeometry args={[size, 32, 32]} />
                <meshBasicMaterial color="#000000" />
            </mesh>

            {/* Inner glow ring (photon sphere) */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[size * 1.1, 0.1, 16, 64]} />
                <meshBasicMaterial
                    color="#ff6600"
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Accretion disk */}
            <group ref={diskRef} rotation={[Math.PI / 2.5, 0, 0]}>
                {/* Main disk */}
                <mesh>
                    <ringGeometry args={[size * 1.3, size * 4, 64]} />
                    <meshBasicMaterial
                        color="#ff4400"
                        transparent
                        opacity={0.6}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Hot inner edge */}
                <mesh>
                    <ringGeometry args={[size * 1.2, size * 1.5, 64]} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.4}
                        side={THREE.DoubleSide}
                    />
                </mesh>

                {/* Outer cool edge */}
                <mesh>
                    <ringGeometry args={[size * 3, size * 4, 64]} />
                    <meshBasicMaterial
                        color="#880000"
                        transparent
                        opacity={0.3}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* Gravitational distortion rings (lensing effect) */}
            {[0, 1, 2].map((i) => (
                <mesh
                    key={i}
                    ref={el => distortionRingsRef.current[i] = el}
                    rotation={[Math.PI / 2, 0, 0]}
                >
                    <ringGeometry args={[size * (4 + i * 2), size * (4.2 + i * 2), 64]} />
                    <meshBasicMaterial
                        color="#4444ff"
                        transparent
                        opacity={0.15 - i * 0.04}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}

            {/* Swirling particles */}
            {diskParticles.map((data, i) => (
                <mesh
                    key={i}
                    ref={el => particlesRef.current[i] = el}
                    position={[
                        Math.cos(data.angle) * data.radius,
                        0,
                        Math.sin(data.angle) * data.radius
                    ]}
                >
                    <sphereGeometry args={[data.size, 8, 8]} />
                    <meshBasicMaterial
                        color={data.color}
                        transparent
                    />
                </mesh>
            ))}

            {/* Sparkles for extra depth */}
            <Sparkles
                count={50}
                size={1}
                scale={size * 6}
                speed={2}
                color="#ff8800"
                opacity={0.5}
            />

            {/* Trigger zone indicator (debug) */}
            <mesh visible={false}>
                <sphereGeometry args={[size * 5, 16, 16]} />
                <meshBasicMaterial
                    color="#ff0000"
                    transparent
                    opacity={0.1}
                    wireframe
                />
            </mesh>

            {/* Point lights for drama */}
            <pointLight
                color="#ff4400"
                intensity={3}
                distance={size * 10}
                decay={2}
            />
            <pointLight
                color="#ffffff"
                intensity={2}
                distance={size * 5}
                decay={2}
                position={[0, 0, 0]}
            />
        </group>
    )
}

/**
 * BlackHoleDropZone - Invisible trigger zone around black hole
 * Detects when planets enter and triggers audio effects
 */
export function BlackHoleDropZone({
    position,
    radius,
    orbs,
    onOrbEnter,
    onOrbApproach
}) {
    const approachingRef = useRef({})

    useFrame(() => {
        if (!orbs) return

        const center = new THREE.Vector3(...position)

        orbs.forEach(orb => {
            if (!orb.active) return

            const orbPos = new THREE.Vector3(...orb.position)
            const distance = orbPos.distanceTo(center)

            // Approaching zone (outer)
            if (distance < radius * 2 && !approachingRef.current[orb.id]) {
                approachingRef.current[orb.id] = true
                onOrbApproach?.(orb.id, distance / radius)
            }

            // Left zone
            if (distance >= radius * 2 && approachingRef.current[orb.id]) {
                approachingRef.current[orb.id] = false
            }

            // Enter zone (inner - the drop)
            if (distance < radius) {
                onOrbEnter?.(orb.id)
            }
        })
    })

    return null
}

export default BlackHole

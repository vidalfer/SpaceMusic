import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

/**
 * GalaxyMap - Renders the universe view with multiple galaxies
 * Each galaxy represents a different musical mood
 * 
 * Visible when zoomLevel is 'galaxy_view' or 'universe_view'
 */
function GalaxyMap({
    handPosition,
    isPinching,
    isTracking,
    onSelectGalaxy
}) {
    const { camera } = useThree()

    // Get galaxy data from store
    const galaxies = useAppStore(state => state.galaxies)
    const currentGalaxy = useAppStore(state => state.currentGalaxy)
    const zoomLevel = useAppStore(state => state.zoomLevel)
    const isTransitioning = useAppStore(state => state.isTransitioning)

    // Refs for hover detection
    const hoveredGalaxyRef = useRef(null)
    const hoverTimeRef = useRef(0)
    const HOVER_LOCK_TIME = 500 // ms to lock selection

    // Only render in galaxy/universe view
    const isVisible = zoomLevel === 'galaxy_view' || zoomLevel === 'universe_view'

    // Calculate scale based on zoom level
    const scale = useMemo(() => {
        if (zoomLevel === 'universe_view') return 1
        if (zoomLevel === 'galaxy_view') return 2.5
        return 0.1
    }, [zoomLevel])

    // Detect hover over galaxies
    useFrame((state, delta) => {
        if (!isVisible || !isTracking || isTransitioning) return
        if (!handPosition?.x) return // Guard against undefined handPosition

        // Convert hand position to NDC
        const ndcX = (handPosition.x - 0.5) * 2
        const ndcY = (handPosition.y - 0.5) * 2

        // Check each galaxy for hover
        let closestGalaxy = null
        let closestDist = Infinity

        galaxies.forEach(galaxy => {
            if (galaxy.id === currentGalaxy) return // Skip current

            const pos = new THREE.Vector3(...galaxy.position)
            const projected = pos.clone().project(camera)

            const dx = ndcX - projected.x
            const dy = ndcY - projected.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Threshold for selection (generous for large galaxies)
            if (dist < 0.3 && dist < closestDist) {
                closestDist = dist
                closestGalaxy = galaxy.id
            }
        })

        // Update hover state
        if (closestGalaxy) {
            if (closestGalaxy === hoveredGalaxyRef.current) {
                hoverTimeRef.current += delta * 1000

                // Check for pinch to select
                if (isPinching && hoverTimeRef.current > HOVER_LOCK_TIME) {
                    onSelectGalaxy?.(closestGalaxy)
                }
            } else {
                hoveredGalaxyRef.current = closestGalaxy
                hoverTimeRef.current = 0
            }
        } else {
            hoveredGalaxyRef.current = null
            hoverTimeRef.current = 0
        }
    })

    if (!isVisible) return null

    return (
        <group scale={scale}>
            {/* Background stars for depth */}
            <Sparkles
                count={500}
                size={3}
                scale={300}
                speed={0.1}
                color="#ffffff"
                opacity={0.6}
            />

            {/* Render each galaxy */}
            {galaxies.map(galaxy => (
                <Galaxy
                    key={galaxy.id}
                    galaxy={galaxy}
                    isCurrent={galaxy.id === currentGalaxy}
                    isHovered={hoveredGalaxyRef.current === galaxy.id}
                    camera={camera}
                />
            ))}

            {/* Connection lines between galaxies */}
            <GalaxyConnections galaxies={galaxies} currentGalaxy={currentGalaxy} />

            {/* Universe label */}
            <Text
                position={[0, 80, 0]}
                fontSize={8}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.3}
                outlineColor="#000000"
            >
                ESCOLHA SUA GALÁXIA
            </Text>
        </group>
    )
}

/**
 * Individual Galaxy Component
 * Spiral galaxy visual with mood indicator
 */
function Galaxy({ galaxy, isCurrent, isHovered, camera }) {
    const groupRef = useRef()
    const coreRef = useRef()
    const armsRef = useRef([])
    const glowRef = useRef()
    const labelRef = useRef()

    // Animation
    useFrame((state) => {
        const time = state.clock.elapsedTime

        // Rotate galaxy slowly
        if (groupRef.current) {
            groupRef.current.rotation.y = time * 0.1
        }

        // Pulsate core
        if (coreRef.current) {
            const pulse = 1 + Math.sin(time * 2) * 0.1
            coreRef.current.scale.setScalar(pulse * (isCurrent ? 1.2 : 1))
        }

        // Animate spiral arms
        armsRef.current.forEach((arm, i) => {
            if (arm) {
                arm.rotation.z = time * (0.1 + i * 0.02)
            }
        })

        // Glow effect
        if (glowRef.current) {
            const glowPulse = 1 + Math.sin(time * 1.5) * 0.15
            glowRef.current.scale.setScalar(glowPulse * (isHovered ? 1.3 : 1))
            glowRef.current.material.opacity = isHovered ? 0.4 : 0.2
        }

        // Label faces camera
        if (labelRef.current) {
            labelRef.current.lookAt(camera.position)
        }
    })

    const baseSize = isCurrent ? 15 : 12
    const hoverScale = isHovered ? 1.15 : 1

    return (
        <group ref={groupRef} position={galaxy.position}>
            {/* Galaxy core (bright center) */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[baseSize * 0.3 * hoverScale, 32, 32]} />
                <meshBasicMaterial
                    color={galaxy.color}
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Outer glow */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[baseSize * 0.8 * hoverScale, 32, 32]} />
                <meshBasicMaterial
                    color={galaxy.glowColor}
                    transparent
                    opacity={0.2}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Spiral arms (simplified as rings) */}
            {[0, 1, 2].map((i) => (
                <mesh
                    key={i}
                    ref={el => armsRef.current[i] = el}
                    rotation={[Math.PI / 2, 0, (i * Math.PI * 2) / 3]}
                >
                    <torusGeometry args={[baseSize * (0.5 + i * 0.15), 0.5, 8, 64]} />
                    <meshBasicMaterial
                        color={galaxy.color}
                        transparent
                        opacity={0.4 - i * 0.1}
                    />
                </mesh>
            ))}

            {/* Disk of stars */}
            <Sparkles
                count={100}
                size={2}
                scale={baseSize * 2}
                speed={0.2}
                color={galaxy.color}
                opacity={0.7}
            />

            {/* Selection indicator when hovered */}
            {isHovered && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseSize * 1.2, baseSize * 1.3, 32]} />
                    <meshBasicMaterial
                        color="#00ff88"
                        transparent
                        opacity={0.8}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Current galaxy indicator */}
            {isCurrent && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[baseSize * 1.1, baseSize * 1.15, 32]} />
                    <meshBasicMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.5}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Labels */}
            <group ref={labelRef} position={[0, -baseSize * 1.5, 0]}>
                {/* Icon */}
                <Text
                    position={[0, 4, 0]}
                    fontSize={6}
                    anchorX="center"
                    anchorY="middle"
                >
                    {galaxy.icon}
                </Text>

                {/* Name */}
                <Text
                    position={[0, 0, 0]}
                    fontSize={3}
                    color={isCurrent ? "#ffffff" : galaxy.color}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.15}
                    outlineColor="#000000"
                >
                    {galaxy.name}
                </Text>

                {/* Mood */}
                <Text
                    position={[0, -4, 0]}
                    fontSize={2}
                    color="#aaaaaa"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.1}
                    outlineColor="#000000"
                >
                    {galaxy.mood}
                </Text>

                {/* Current indicator text */}
                {isCurrent && (
                    <Text
                        position={[0, -7, 0]}
                        fontSize={1.5}
                        color="#00ff88"
                        anchorX="center"
                        anchorY="middle"
                    >
                        ★ VOCÊ ESTÁ AQUI ★
                    </Text>
                )}
            </group>

            {/* Point light from galaxy core */}
            <pointLight
                color={galaxy.color}
                intensity={isCurrent ? 5 : 2}
                distance={100}
                decay={2}
            />
        </group>
    )
}

/**
 * Connection lines between galaxies
 * Shows travel paths
 */
function GalaxyConnections({ galaxies, currentGalaxy }) {
    const linesRef = useRef([])

    useFrame((state) => {
        const time = state.clock.elapsedTime

        linesRef.current.forEach((line, i) => {
            if (line?.material) {
                // Animate opacity
                line.material.opacity = 0.1 + Math.sin(time + i) * 0.05
            }
        })
    })

    // Create connections from current galaxy to others
    const currentGalaxyData = galaxies.find(g => g.id === currentGalaxy)
    if (!currentGalaxyData) return null

    return (
        <group>
            {galaxies.filter(g => g.id !== currentGalaxy).map((galaxy, i) => {
                const start = new THREE.Vector3(...currentGalaxyData.position)
                const end = new THREE.Vector3(...galaxy.position)

                return (
                    <line key={galaxy.id} ref={el => linesRef.current[i] = el}>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([...start.toArray(), ...end.toArray()])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial
                            color={galaxy.color}
                            transparent
                            opacity={0.15}
                            linewidth={1}
                        />
                    </line>
                )
            })}
        </group>
    )
}

/**
 * Warp Transition Effect
 * Streaking stars effect during galaxy travel
 */
export function WarpEffect({ isActive, progress }) {
    const groupRef = useRef()
    const starsRef = useRef([])

    // Generate random star positions for streak effect
    const starData = useMemo(() => {
        return Array.from({ length: 200 }, () => ({
            angle: Math.random() * Math.PI * 2,
            radius: 2 + Math.random() * 8,
            z: Math.random() * 100 - 50,
            speed: 0.5 + Math.random() * 1.5
        }))
    }, [])

    useFrame((state, delta) => {
        if (!isActive) return

        starsRef.current.forEach((star, i) => {
            if (!star) return

            const data = starData[i]

            // Move stars toward camera (warp effect)
            star.position.z += data.speed * delta * 100 * (0.5 + progress)

            // Reset when past camera
            if (star.position.z > 10) {
                star.position.z = -50
            }

            // Stretch based on speed
            star.scale.z = 1 + progress * data.speed * 5
        })
    })

    if (!isActive) return null

    return (
        <group ref={groupRef}>
            {starData.map((data, i) => (
                <mesh
                    key={i}
                    ref={el => starsRef.current[i] = el}
                    position={[
                        Math.cos(data.angle) * data.radius,
                        Math.sin(data.angle) * data.radius,
                        data.z
                    ]}
                >
                    <boxGeometry args={[0.05, 0.05, 0.3]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            ))}

            {/* Tunnel effect */}
            <mesh>
                <cylinderGeometry args={[15, 5, 100, 32, 1, true]} />
                <meshBasicMaterial
                    color="#4444ff"
                    transparent
                    opacity={0.1 * progress}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    )
}

export default GalaxyMap

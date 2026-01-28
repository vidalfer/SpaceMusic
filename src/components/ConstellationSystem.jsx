import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

/**
 * ConstellationSystem - Interactive star field for creating musical patterns
 * 
 * Mechanics:
 * - Hover over stars to highlight them
 * - Quick pinch (<300ms): Toggle connection to star
 * - Hold + drag: Move star position
 * - Pinch empty area: Disconnect last star
 * - Long pinch (>500ms) empty: Clear all connections
 * - Connected stars show visual lines between them
 */
function ConstellationSystem({
    handPosition,
    isPinching,
    isTracking,
    onConstellationComplete
}) {
    const { camera } = useThree()

    // Store
    const viewMode = useAppStore(state => state.viewMode)

    // State refs
    const hoveredStarRef = useRef(null)
    const draggingStarRef = useRef(null)
    const hoverTimeRef = useRef(0)
    const lastPinchRef = useRef(false)
    const pinchStartTimeRef = useRef(0)

    // IMPORTANT: Use useState for selectedStars so connections re-render!
    const [selectedStars, setSelectedStars] = useState([]) // Array of star IDs in connection order

    const HOVER_LOCK_TIME = 300

    // CONSTANTS for patterns - CENTERED for better visibility
    const PATTERNS = useMemo(() => [
        { name: 'Triângulo', pattern: 'drums', color: '#ff6644', positions: [[-2, 0, -15], [1, 3, -15], [4, 0, -15]] },
        { name: 'Quadrado', pattern: 'bass', color: '#44ff66', positions: [[5, -2, -15], [9, -2, -15], [9, 2, -15], [5, 2, -15]] },
        { name: 'Linha', pattern: 'melody', color: '#6644ff', positions: [[-7, -3, -15], [-5, -1, -15], [-3, 1, -15], [-1, 3, -15]] },
        { name: 'Pentágono', pattern: 'pads', color: '#ffaa00', positions: [[-9, 1, -15], [-11, 3, -15], [-10, 6, -15], [-7, 6, -15], [-6, 3, -15]] },
    ], [])

    // Initial star generation
    const initialStars = useMemo(() => {
        const starData = []

        // Pattern stars
        PATTERNS.forEach((pattern, patternIndex) => {
            pattern.positions.forEach((pos, starIndex) => {
                starData.push({
                    id: `p${patternIndex}_s${starIndex}`,
                    position: new THREE.Vector3(...pos),
                    patternIndex,
                    starIndex,
                    patternName: pattern.name,
                    patternType: pattern.pattern,
                    color: pattern.color,
                    size: 0.3,
                    twinkleSpeed: 1 + Math.random() * 2,
                    twinklePhase: Math.random() * Math.PI * 2
                })
            })
        })

        // Ambient stars
        for (let i = 0; i < 50; i++) {
            starData.push({
                id: `ambient_${i}`,
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 30,
                    -20 - Math.random() * 10
                ),
                patternIndex: -1,
                size: 0.05 + Math.random() * 0.05,
                twinkleSpeed: 2 + Math.random() * 3,
                twinklePhase: Math.random() * Math.PI * 2,
                color: '#ffffff'
            })
        }
        return starData
    }, [PATTERNS])

    // Local state for star positions to allow updates
    const [stars, setStars] = useState(initialStars)

    // Clear connections when exiting constellation mode
    useEffect(() => {
        if (viewMode !== 'constellation') {
            setSelectedStars([])
        }
    }, [viewMode])

    // Check if a pattern is complete (all stars connected in sequence)
    const checkPatternComplete = useCallback((patternIndex) => {
        const patternStars = stars.filter(s => s.patternIndex === patternIndex)
        const selectedPatternStars = selectedStars.filter(id =>
            stars.find(s => s.id === id)?.patternIndex === patternIndex
        )
        return selectedPatternStars.length === patternStars.length
    }, [stars, selectedStars])

    // Get connection line points (in order of selection) - MUST be before any conditional returns!
    const connectionPoints = useMemo(() => {
        if (selectedStars.length < 2) return null
        const points = selectedStars
            .map(id => stars.find(s => s.id === id)?.position)
            .filter(Boolean)
        return points.length >= 2 ? points : null
    }, [selectedStars, stars])

    // Determine line color based on pattern - MUST be before any conditional returns!
    const lineColor = useMemo(() => {
        if (selectedStars.length === 0) return '#ffffff'
        const firstStar = stars.find(s => s.id === selectedStars[0])
        return firstStar?.color || '#00ffcc'
    }, [selectedStars, stars])

    useFrame((state, delta) => {
        if (viewMode !== 'constellation') return
        if (!isTracking || !handPosition?.x) {
            draggingStarRef.current = null
            return
        }

        const ndcX = (handPosition.x - 0.5) * 2
        const ndcY = (handPosition.y - 0.5) * 2

        // --- DRAGGING LOGIC ---
        if (isPinching && draggingStarRef.current) {
            const starIndex = stars.findIndex(s => s.id === draggingStarRef.current)
            if (starIndex !== -1) {
                const star = stars[starIndex]

                const vector = new THREE.Vector3(ndcX, ndcY, 0.5)
                vector.unproject(camera)
                const dir = vector.sub(camera.position).normalize()
                const distance = (star.position.z - camera.position.z) / dir.z
                const newPos = camera.position.clone().add(dir.multiplyScalar(distance))

                const newStars = [...stars]
                newStars[starIndex] = { ...star, position: newPos }
                setStars(newStars)
            }
        }

        // --- SELECTION & INTERACTION STATE LOGIC ---
        let closestStar = null
        let closestDist = Infinity

        stars.forEach(star => {
            if (star.patternIndex < 0) return

            const pos = star.position.clone()
            const projected = pos.project(camera)

            const dx = ndcX - projected.x
            const dy = ndcY - projected.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < 0.5 && dist < closestDist) {
                closestDist = dist
                closestStar = star.id
            }
        })

        // Update hover state
        if (closestStar) {
            if (closestStar === hoveredStarRef.current) {
                hoverTimeRef.current += delta * 1000
            } else {
                hoveredStarRef.current = closestStar
                hoverTimeRef.current = 0
            }
        } else {
            hoveredStarRef.current = null
            hoverTimeRef.current = 0
        }

        // PINCH START
        if (isPinching && !lastPinchRef.current) {
            pinchStartTimeRef.current = Date.now()
            if (closestStar) {
                draggingStarRef.current = closestStar
            } else {
                draggingStarRef.current = null
            }
        }

        // PINCH END (Release)
        if (!isPinching && lastPinchRef.current) {
            const duration = Date.now() - pinchStartTimeRef.current

            if (draggingStarRef.current) {
                // Quick tap on a star = toggle connection
                if (duration < 300) {
                    const starId = draggingStarRef.current
                    const starData = stars.find(s => s.id === starId)

                    if (selectedStars.includes(starId)) {
                        // DESELECT: Remove from chain
                        setSelectedStars(prev => prev.filter(id => id !== starId))
                        console.log(`[CONSTELLATION] Desconectou: ${starId}`)
                    } else {
                        // SELECT: Add to chain
                        setSelectedStars(prev => {
                            const newSelection = [...prev, starId]
                            console.log(`[CONSTELLATION] Conectou: ${starId}`)

                            // Check pattern completion
                            if (starData && checkPatternComplete(starData.patternIndex)) {
                                setTimeout(() => {
                                    onConstellationComplete?.(starData.patternType, starData.patternName)
                                }, 100)
                            }
                            return newSelection
                        })
                    }
                }
            } else {
                // Pinch on empty area
                if (duration > 500) {
                    // Long pinch on empty = clear all
                    setSelectedStars([])
                    console.log(`[CONSTELLATION] Limpou todas conexões`)
                } else if (duration < 300 && selectedStars.length > 0) {
                    // Quick pinch on empty = remove last
                    setSelectedStars(prev => prev.slice(0, -1))
                    console.log(`[CONSTELLATION] Removeu última conexão`)
                }
            }

            draggingStarRef.current = null
        }

        lastPinchRef.current = isPinching
    })

    // Early return AFTER all hooks have been called
    if (viewMode !== 'constellation') return null

    return (
        <group>
            {/* Connection lines between selected stars */}
            {connectionPoints && (
                <Line
                    points={connectionPoints}
                    color={lineColor}
                    lineWidth={3}
                    transparent
                    opacity={0.8}
                    dashed={false}
                />
            )}

            {/* Preview line from last selected to hovered (if not already connected) */}
            {selectedStars.length > 0 && hoveredStarRef.current && !selectedStars.includes(hoveredStarRef.current) && (() => {
                const lastSelected = stars.find(s => s.id === selectedStars[selectedStars.length - 1])
                const hoveredStar = stars.find(s => s.id === hoveredStarRef.current)
                if (lastSelected && hoveredStar) {
                    return (
                        <Line
                            points={[lastSelected.position, hoveredStar.position]}
                            color="#88ccff"
                            lineWidth={2}
                            transparent
                            opacity={0.5}
                            dashed
                            dashSize={0.2}
                            dashScale={3}
                        />
                    )
                }
                return null
            })()}

            {/* Stars */}
            {stars.map(star => (
                <Star
                    key={star.id}
                    star={star}
                    isHovered={hoveredStarRef.current === star.id}
                    isSelected={selectedStars.includes(star.id)}
                    connectionIndex={selectedStars.indexOf(star.id)}
                    hoverProgress={hoveredStarRef.current === star.id ? hoverTimeRef.current / HOVER_LOCK_TIME : 0}
                />
            ))}

            {/* UI Instructions */}
            <Text
                position={[0, 8, -15]}
                fontSize={0.7}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                ⭐ MODO CONSTELAÇÃO
            </Text>
            <Text
                position={[0, 7.2, -15]}
                fontSize={0.3}
                color="#aaaaaa"
                anchorX="center"
                anchorY="middle"
            >
                Punho ✊ = Girar | Pinça 👌 = Conectar | Pinça Vazio = Desfazer
            </Text>
            <Text
                position={[0, 6.7, -15]}
                fontSize={0.22}
                color="#666666"
                anchorX="center"
                anchorY="middle"
            >
                Segure pinça para arrastar | Pinça longa em vazio = Limpar tudo
            </Text>

            {/* Connection counter */}
            {selectedStars.length > 0 && (
                <Text
                    position={[0, -5, -15]}
                    fontSize={0.45}
                    color={lineColor}
                    anchorX="center"
                    anchorY="middle"
                >
                    {`Conectadas: ${selectedStars.length}`}
                </Text>
            )}
        </group>
    )
}

function Star({ star, isHovered, isSelected, connectionIndex, hoverProgress }) {
    const meshRef = useRef()
    const glowRef = useRef()

    useFrame((state) => {
        const time = state.clock.elapsedTime
        const twinkle = 0.7 + Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3

        if (meshRef.current) {
            const scale = star.size * twinkle * (isHovered ? 2 : 1) * (isSelected ? 1.5 : 1)
            meshRef.current.scale.setScalar(scale)
        }

        if (glowRef.current) {
            glowRef.current.rotation.z += 0.01
            glowRef.current.material.opacity = isSelected ? 0.6 : (isHovered ? 0.4 : 0.1)
        }
    })

    const isInteractive = star.patternIndex >= 0

    return (
        <group position={star.position}>
            <mesh ref={meshRef}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color={isSelected ? star.color : (isHovered ? '#ffffff' : star.color)} />
            </mesh>

            {isInteractive && (
                <mesh ref={glowRef}>
                    <planeGeometry args={[star.size * 6, star.size * 6]} />
                    <meshBasicMaterial
                        map={getGlowTexture()}
                        color={star.color}
                        transparent
                        opacity={0.1}
                        depthWrite={false}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Connection indicator ring */}
            {isSelected && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[star.size * 2, star.size * 2.5, 16]} />
                    <meshBasicMaterial color={star.color} transparent opacity={0.9} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Connection order number */}
            {isSelected && connectionIndex >= 0 && (
                <Text
                    position={[star.size * 3, star.size * 3, 0]}
                    fontSize={0.4}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.05}
                    outlineColor={star.color}
                >
                    {connectionIndex + 1}
                </Text>
            )}

            {/* Hover ring progress */}
            {isHovered && !isSelected && hoverProgress > 0 && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[star.size * 1.8, star.size * 2.2, 16, 1, 0, Math.PI * 2 * Math.min(1, hoverProgress)]} />
                    <meshBasicMaterial color="#00ff88" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}

            {isHovered && star.patternName && (
                <Text position={[0, star.size * 4, 0]} fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000000">
                    {star.patternName}
                </Text>
            )}
        </group>
    )
}

// Simple glow texture generator
let glowTexture = null
function getGlowTexture() {
    if (glowTexture) return glowTexture
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
    glowTexture = new THREE.CanvasTexture(canvas)
    return glowTexture
}

export default ConstellationSystem

import React, { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../store/appStore'

/**
 * NavigationPortal - Interactive 3D element for navigation
 * Pinch to activate and change view modes
 * 
 * Inspired by Warframe's navigation system
 */
function NavigationPortal({
    handPosition,
    isPinching,
    isTracking
}) {
    const { camera } = useThree()

    // Store state
    const zoomLevel = useAppStore(state => state.zoomLevel)
    const setZoomLevel = useAppStore(state => state.setZoomLevel)
    const viewMode = useAppStore(state => state.viewMode)
    const setViewMode = useAppStore(state => state.setViewMode)

    // Refs for interaction
    const galaxyPortalRef = useRef()
    const constellationPortalRef = useRef()
    const blackHolePortalRef = useRef()
    const backButtonRef = useRef()

    const hoverStateRef = useRef({
        galaxy: false,
        constellation: false,
        blackhole: false,
        back: false,
        time: 0
    })

    const activatedRef = useRef(false)
    const HOVER_LOCK_TIME = 400 // ms to activate

    // Portal positions
    const galaxyPos = useMemo(() => new THREE.Vector3(15, 2, 0), [])
    const constellationPos = useMemo(() => new THREE.Vector3(-15, 8, -5), [])
    const blackHolePos = useMemo(() => new THREE.Vector3(-15, -5, 5), [])
    const backButtonPos = useMemo(() => new THREE.Vector3(0, 8, 0), [])

    useFrame((state, delta) => {
        const time = state.clock.elapsedTime

        // Animate portals
        if (galaxyPortalRef.current) {
            galaxyPortalRef.current.rotation.z = time * 0.5
            const pulse = 1 + Math.sin(time * 2) * 0.1
            galaxyPortalRef.current.scale.setScalar(pulse * (hoverStateRef.current.galaxy ? 1.3 : 1))
        }

        if (constellationPortalRef.current) {
            constellationPortalRef.current.rotation.z = -time * 0.3
            const pulse = 1 + Math.sin(time * 2.5) * 0.1
            constellationPortalRef.current.scale.setScalar(pulse * (hoverStateRef.current.constellation ? 1.3 : 1))
        }

        if (blackHolePortalRef.current) {
            blackHolePortalRef.current.rotation.z = time * 0.8
            const pulse = 1 + Math.sin(time * 4) * 0.1
            blackHolePortalRef.current.scale.setScalar(pulse * (hoverStateRef.current.blackhole ? 1.3 : 1))
        }

        // Animate back button
        if (backButtonRef.current) {
            backButtonRef.current.rotation.y = time * 0.3
            const pulse = 1 + Math.sin(time * 3) * 0.1
            backButtonRef.current.scale.setScalar(pulse * (hoverStateRef.current.back ? 1.2 : 1))
        }

        // RAYCASTING FOR INTERACTION
        if (isTracking && handPosition) {
            const ndcX = (handPosition.x - 0.5) * 2
            const ndcY = (handPosition.y - 0.5) * 2

            // Helper for hover check
            const checkHover = (pos, key, action) => {
                const projected = pos.clone().project(camera)
                const dx = ndcX - projected.x
                const dy = ndcY - projected.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist < 0.25) {
                    if (!hoverStateRef.current[key]) {
                        // Reset others
                        Object.keys(hoverStateRef.current).forEach(k => {
                            if (k !== 'time') hoverStateRef.current[k] = false
                        })
                        hoverStateRef.current[key] = true
                        hoverStateRef.current.time = 0
                        activatedRef.current = false
                    }
                    hoverStateRef.current.time += delta * 1000

                    if (isPinching && hoverStateRef.current.time > HOVER_LOCK_TIME && !activatedRef.current) {
                        activatedRef.current = true
                        action()
                    }
                } else if (hoverStateRef.current[key]) {
                    hoverStateRef.current[key] = false
                    activatedRef.current = false
                }
            }

            // 1. Galaxy Portal (only in default solar system view)
            if (viewMode === 'default' && zoomLevel === 'solar_system') {
                checkHover(galaxyPos, 'galaxy', () => {
                    console.log('[NAV] Going to galaxy view!')
                    setZoomLevel('galaxy_view')
                })
            }

            // 2. Constellation Portal (only in default view)
            if (viewMode === 'default' && zoomLevel === 'solar_system') {
                checkHover(constellationPos, 'constellation', () => {
                    console.log('[NAV] Entering Constellation Mode')
                    setViewMode('constellation')
                })
            }

            // 3. Black Hole Portal (only in default view)
            if (viewMode === 'default' && zoomLevel === 'solar_system') {
                checkHover(blackHolePos, 'blackhole', () => {
                    console.log('[NAV] Entering Black Hole Mode')
                    setViewMode('black_hole')
                })
            }

            // 4. Back Button (in any other mode/view)
            if (viewMode !== 'default' || zoomLevel !== 'solar_system') {
                checkHover(backButtonPos, 'back', () => {
                    if (viewMode !== 'default') {
                        console.log('[NAV] Returning to Solar System')
                        setViewMode('default')
                    } else if (zoomLevel === 'universe_view') {
                        setZoomLevel('galaxy_view')
                    } else {
                        setZoomLevel('solar_system')
                    }
                })
            }
        }
    })

    // Render nothing if not tracking
    if (!isTracking) return null

    return (
        <>
            {/* HUB PORTALS - visible in default solar system view */}
            {viewMode === 'default' && zoomLevel === 'solar_system' && (
                <>
                    {/* GALAXY PORTAL */}
                    <group position={galaxyPos.toArray()}>
                        <PortalMesh
                            color="#8844ff"
                            hovered={hoverStateRef.current.galaxy}
                            progress={hoverStateRef.current.galaxy ? hoverStateRef.current.time / HOVER_LOCK_TIME : 0}
                            ref={galaxyPortalRef}
                            label="GALÁXIAS"
                            subLabel="Explorar Universo"
                        />
                    </group>

                    {/* CONSTELLATION PORTAL */}
                    <group position={constellationPos.toArray()}>
                        <PortalMesh
                            color="#44ff88"
                            hovered={hoverStateRef.current.constellation}
                            progress={hoverStateRef.current.constellation ? hoverStateRef.current.time / HOVER_LOCK_TIME : 0}
                            ref={constellationPortalRef}
                            label="CONSTELAÇÕES"
                            subLabel="Criar Loops"
                        />
                    </group>

                    {/* BLACK HOLE PORTAL */}
                    <group position={blackHolePos.toArray()}>
                        <PortalMesh
                            color="#ff4444"
                            hovered={hoverStateRef.current.blackhole}
                            progress={hoverStateRef.current.blackhole ? hoverStateRef.current.time / HOVER_LOCK_TIME : 0}
                            ref={blackHolePortalRef}
                            label="BURACO NEGRO"
                            subLabel="Zona de Drop"
                        />
                    </group>
                </>
            )}

            {/* BACK BUTTON - visible when NOT in default solar system view */}
            {(viewMode !== 'default' || zoomLevel !== 'solar_system') && (
                <group position={backButtonPos.toArray()}>
                    <group ref={backButtonRef}>
                        <mesh rotation={[0, 0, Math.PI]}>
                            <coneGeometry args={[0.8, 1.5, 4]} />
                            <meshBasicMaterial color={hoverStateRef.current.back ? '#ffffff' : '#ffaa00'} />
                        </mesh>
                        <mesh position={[0, 1, 0]}>
                            <boxGeometry args={[0.5, 1, 0.5]} />
                            <meshBasicMaterial color={hoverStateRef.current.back ? '#ffffff' : '#ffaa00'} />
                        </mesh>
                        <mesh rotation={[Math.PI / 2, 0, 0]}>
                            <torusGeometry args={[1.5, 0.1, 16, 32]} />
                            <meshBasicMaterial color={hoverStateRef.current.back ? '#ffffff' : '#ff8800'} transparent opacity={0.5} />
                        </mesh>
                    </group>

                    <Text
                        position={[0, -2, 0]}
                        fontSize={0.8}
                        color={hoverStateRef.current.back ? '#ffffff' : '#ffaa00'}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.04}
                        outlineColor="#000000"
                    >
                        ← VOLTAR
                    </Text>

                    <Text position={[0, -3, 0]} fontSize={0.5} color="#888888" anchorX="center" anchorY="middle">
                        {viewMode !== 'default' ? 'Para Sistema Solar' : (zoomLevel === 'universe_view' ? 'Para Galáxia' : 'Para Sistema Solar')}
                    </Text>

                    {hoverStateRef.current.back && (
                        <mesh position={[0, -3.8, 0]}>
                            <planeGeometry args={[3 * Math.min(1, hoverStateRef.current.time / HOVER_LOCK_TIME), 0.15]} />
                            <meshBasicMaterial color="#ffffff" />
                        </mesh>
                    )}
                </group>
            )}
        </>
    )
}

// Reusable Portal Component
const PortalMesh = React.forwardRef(({ color, hovered, progress, label, subLabel }, ref) => {
    return (
        <group>
            <group ref={ref}>
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[1.5, 0.15, 16, 64]} />
                    <meshBasicMaterial color={hovered ? '#ffffff' : color} />
                </mesh>
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[1.2, 0.08, 16, 64]} />
                    <meshBasicMaterial color={color} transparent opacity={0.6} />
                </mesh>
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <circleGeometry args={[1.4, 32]} />
                    <meshBasicMaterial color="#000000" transparent opacity={0.9} side={THREE.DoubleSide} />
                </mesh>
                <Sparkles count={20} size={3} scale={2} speed={2} color={color} opacity={0.8} />
            </group>

            <Text
                position={[0, -2.5, 0]}
                fontSize={0.5}
                color={hovered ? '#ffffff' : color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#000000"
            >
                {label}
            </Text>
            <Text
                position={[0, -3.2, 0]}
                fontSize={0.25}
                color="#aaaaaa"
                anchorX="center"
                anchorY="middle"
            >
                {subLabel}
            </Text>

            {hovered && (
                <mesh position={[0, -3.8, 0]}>
                    <planeGeometry args={[2 * Math.min(1, progress), 0.1]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            )}
            <pointLight color={color} intensity={hovered ? 4 : 2} distance={8} />
        </group>
    )
})

export default NavigationPortal

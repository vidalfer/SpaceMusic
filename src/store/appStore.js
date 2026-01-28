import { create } from 'zustand'

/**
 * Global state store for Gesture-Flow DJ
 * Manages hand tracking data, orb states, audio status, and galaxy navigation
 */
export const useAppStore = create((set, get) => ({
  // ==========================================
  // GALAXY NAVIGATION STATE
  // ==========================================

  // Available galaxies with their musical moods
  galaxies: [
    {
      id: 'milky_way',
      name: 'Via Láctea',
      mood: 'EDM/Eletrônico',
      description: 'Batidas eletrônicas pulsantes',
      color: '#6666ff',
      glowColor: '#8888ff',
      position: [0, 0, 0],  // Center of universe view
      basePrompt: 'electronic dance music, pulsing synths, driving beat',
      icon: '🌌'
    },
    {
      id: 'andromeda',
      name: 'Andrômeda',
      mood: 'Jazz/Neo Soul',
      description: 'Grooves suaves e harmônicos',
      color: '#ffaa44',
      glowColor: '#ffcc66',
      position: [80, 20, -40],  // Upper right in universe view
      basePrompt: 'smooth jazz, neo soul, warm harmonies, groovy',
      icon: '🌀'
    },
    {
      id: 'orion_nebula',
      name: 'Nebulosa de Órion',
      mood: 'Ambient/Chill',
      description: 'Texturas etéreas e relaxantes',
      color: '#4488ff',
      glowColor: '#66aaff',
      position: [-60, -10, 50],  // Lower left in universe view
      basePrompt: 'ambient soundscape, ethereal pads, chill atmosphere',
      icon: '🔵'
    },
    {
      id: 'crab_nebula',
      name: 'Nebulosa do Caranguejo',
      mood: 'Rock/Industrial',
      description: 'Energia intensa e agressiva',
      color: '#ff4444',
      glowColor: '#ff6666',
      position: [50, -30, 60],  // Lower right in universe view
      basePrompt: 'industrial rock, distorted guitars, aggressive drums',
      icon: '🟣'
    }
  ],

  // Current galaxy ID
  currentGalaxy: 'milky_way',

  // Zoom level: 'solar_system' | 'galaxy_view' | 'universe_view'
  zoomLevel: 'solar_system',

  // View Mode: 'default', 'constellation', 'black_hole'
  // Separates interactions into distinct "minigames"
  viewMode: 'default',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Transition state for smooth animations
  isTransitioning: false,
  transitionTarget: null,  // Galaxy ID we're transitioning to
  transitionProgress: 0,   // 0 to 1

  // Get current galaxy data
  getCurrentGalaxy: () => {
    const state = get()
    return state.galaxies.find(g => g.id === state.currentGalaxy)
  },

  // Set zoom level
  setZoomLevel: (level) => set({ zoomLevel: level }),

  // Start transition to another galaxy
  startGalaxyTransition: (targetGalaxyId) => {
    const state = get()
    if (state.isTransitioning || state.currentGalaxy === targetGalaxyId) return

    set({
      isTransitioning: true,
      transitionTarget: targetGalaxyId,
      transitionProgress: 0
    })
  },

  // Update transition progress (called from animation loop)
  updateTransitionProgress: (progress) => {
    const state = get()
    if (!state.isTransitioning) return

    if (progress >= 1) {
      // Transition complete
      set({
        currentGalaxy: state.transitionTarget,
        isTransitioning: false,
        transitionTarget: null,
        transitionProgress: 0,
        zoomLevel: 'solar_system'
      })
    } else {
      set({ transitionProgress: progress })
    }
  },

  // Cancel transition
  cancelTransition: () => set({
    isTransitioning: false,
    transitionTarget: null,
    transitionProgress: 0
  }),

  // ==========================================
  // CONSTELLATION STATE
  // ==========================================

  // Active constellations (completed patterns)
  activeConstellations: [], // Array of { type: 'drums'|'bass'|'melody'|'pads', name: string }

  // Add completed constellation
  addConstellation: (type, name) => set(state => ({
    activeConstellations: [...state.activeConstellations, { type, name, timestamp: Date.now() }]
  })),

  // Remove constellation
  removeConstellation: (type) => set(state => ({
    activeConstellations: state.activeConstellations.filter(c => c.type !== type)
  })),

  // Clear all constellations
  clearConstellations: () => set({ activeConstellations: [] }),

  // ==========================================
  // HAND TRACKING STATE
  // ==========================================
  handData: {
    position: { x: 0.5, y: 0.5, z: 0 },
    isPinching: false,
    isTracking: false
  },
  setHandData: (data) => set({ handData: data }),

  // Orbs State Management
  orbs: [
    {
      id: 'drums',
      label: 'DRUMS',
      position: [-2.5, 1, 0],
      color: '#00aaff',
      state: 'idle', // idle | grabbed | loading | ready
      prompt: 'heavy drums, punchy kick'
    },
    {
      id: 'bass',
      label: 'BASS',
      position: [2.5, 1, 0],
      color: '#ff00aa',
      state: 'idle',
      prompt: 'deep bass, sub frequencies'
    },
    {
      id: 'synth',
      label: 'SYNTH',
      position: [0, 2.5, 0],
      color: '#ffaa00',
      state: 'idle',
      prompt: 'ethereal synth pads, ambient'
    },
    {
      id: 'fx',
      label: 'FX',
      position: [-1.5, -1.5, 0],
      color: '#aa00ff',
      state: 'idle',
      prompt: 'glitch effects, risers'
    },
    {
      id: 'melody',
      label: 'MELODY',
      position: [1.5, -1.5, 0],
      color: '#00ffaa',
      state: 'idle',
      prompt: 'melodic arpeggios, bright'
    }
  ],

  // Update a specific orb
  updateOrb: (id, updates) => set((state) => ({
    orbs: state.orbs.map(orb =>
      orb.id === id ? { ...orb, ...updates } : orb
    )
  })),

  // Get orb by ID
  getOrb: (id) => get().orbs.find(orb => orb.id === id),

  // Currently grabbed orb
  grabbedOrbId: null,
  setGrabbedOrbId: (id) => set({ grabbedOrbId: id }),

  // Audio Engine Status
  audioStatus: {
    isPlaying: false,
    bpm: 120,
    currentBar: 0
  },
  setAudioStatus: (status) => set((state) => ({
    audioStatus: { ...state.audioStatus, ...status }
  })),

  // Debug mode
  debugMode: true,
  toggleDebug: () => set((state) => ({ debugMode: !state.debugMode }))
}))

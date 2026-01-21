import { create } from 'zustand'

/**
 * Global state store for Gesture-Flow DJ
 * Manages hand tracking data, orb states, and audio status
 */
export const useAppStore = create((set, get) => ({
  // Hand Tracking State
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

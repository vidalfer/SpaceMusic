import React, { useState } from 'react'

/**
 * LyriaPlayer Component
 * Controls for Lyria RealTime audio playback
 */
function LyriaPlayer({ lyriaAudio, activePrompts }) {
  const [bpm, setBpm] = useState(120)
  const [config, setConfig] = useState({
    temperature: 1.0,
    guidance: 4.0,
    density: 0.5,
    brightness: 0.5
  })

  const handleConnect = async () => {
    try {
      await lyriaAudio.connect()
    } catch (err) {
      console.error('Connection failed:', err)
    }
  }

  const handlePlay = async () => {
    if (!lyriaAudio.isConnected) {
      await handleConnect()
    }
    
    // Set initial config
    lyriaAudio.setConfig({ bpm, ...config })
    
    // Set prompts if we have any
    if (activePrompts.length > 0) {
      lyriaAudio.setPrompts(activePrompts)
    } else {
      // Default prompt if no slots are filled
      lyriaAudio.setPrompts([{ text: 'electronic music, ambient', weight: 1.0 }])
    }
    
    lyriaAudio.play()
  }

  const handleStop = () => {
    lyriaAudio.stop()
  }

  const handleConfigChange = (key, value) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    
    if (lyriaAudio.isPlaying) {
      lyriaAudio.setConfig({ bpm, ...newConfig })
    }
  }

  const handleBpmChange = (newBpm) => {
    setBpm(newBpm)
    if (lyriaAudio.isPlaying) {
      lyriaAudio.setConfig({ bpm: newBpm, ...config })
    }
  }

  return (
    <div className="lyria-player">
      {/* Transport Controls */}
      <div className="transport-controls">
        <button 
          className={`play-btn ${lyriaAudio.isPlaying ? 'playing' : ''}`}
          onClick={lyriaAudio.isPlaying ? handleStop : handlePlay}
        >
          {lyriaAudio.isPlaying ? '⏹ STOP' : '▶ PLAY'}
        </button>

        {/* BPM Control */}
        <div className="bpm-control">
          <button onClick={() => handleBpmChange(Math.max(60, bpm - 5))}>-</button>
          <div className="bpm-display">
            <span className="bpm-value">{bpm}</span>
            <span className="bpm-label">BPM</span>
          </div>
          <button onClick={() => handleBpmChange(Math.min(200, bpm + 5))}>+</button>
        </div>
      </div>

      {/* Config Sliders */}
      <div className="config-controls">
        <ConfigSlider
          label="Guidance"
          value={config.guidance}
          min={0}
          max={6}
          step={0.5}
          onChange={(v) => handleConfigChange('guidance', v)}
          hint="How closely to follow prompts"
        />
        <ConfigSlider
          label="Density"
          value={config.density}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => handleConfigChange('density', v)}
          hint="Note density (sparse → busy)"
        />
        <ConfigSlider
          label="Brightness"
          value={config.brightness}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => handleConfigChange('brightness', v)}
          hint="Tonal brightness"
        />
        <ConfigSlider
          label="Temperature"
          value={config.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => handleConfigChange('temperature', v)}
          hint="Randomness/creativity"
        />
      </div>

      {/* Active Prompts Display */}
      <div className="active-prompts">
        <h4>Active Prompts</h4>
        {activePrompts.length > 0 ? (
          <ul>
            {activePrompts.map((p, i) => (
              <li key={i}>
                <span className="prompt-weight">{p.weight.toFixed(1)}x</span>
                <span className="prompt-text">{p.text.substring(0, 40)}...</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-prompts">No sounds active. Drag orbs to slots!</p>
        )}
      </div>

      {/* Connection Status */}
      <div className="connection-status">
        {lyriaAudio.error && (
          <div className="error-message">⚠️ {lyriaAudio.error}</div>
        )}
        <div className={`status-dot ${lyriaAudio.isConnected ? 'connected' : ''}`} />
        <span>{lyriaAudio.isConnected ? 'Connected to Lyria' : 'Not connected'}</span>
      </div>
    </div>
  )
}

/**
 * Config Slider Component
 */
function ConfigSlider({ label, value, min, max, step, onChange, hint }) {
  return (
    <div className="config-slider">
      <div className="slider-header">
        <label>{label}</label>
        <span className="slider-value">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <span className="slider-hint">{hint}</span>}
    </div>
  )
}

export default LyriaPlayer

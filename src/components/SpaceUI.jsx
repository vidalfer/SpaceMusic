import React, { useEffect, useRef } from 'react'

/**
 * SpaceUI - Overlay interface with gesture controls
 * Supports single player and multiplayer modes
 */
function SpaceUI({
  orbs,
  players = [],
  weightedPrompts,
  averageInfluence,
  totalInfluence,
  sceneMode,
  galaxies = [],
  currentGalaxyId,
  onSelectGalaxy,
  onToggleSceneMode,
  constellations = [],
  constellationDrafts = {},
  blackHoleImpact = 0,
  isTracking,
  isPinching,
  isFist,
  cameraMode,
  handPosition,
  grabbedOrbId,
  isMultiplayer,
  onToggleMultiplayer,
  multiplayerConnected,
  isConnected,
  isPlaying,
  onPlay,
  onStop,
  config,
  setConfig,
  videoRef
}) {
  return (
    <div className="space-ui">
      {/* Header */}
      <header className="space-header">
        <div className="logo">
          <h1>✦ Solar Symphony</h1>
          <span>
            {isMultiplayer 
              ? `Cosmic Multiplayer • ${players.length} Players` 
              : '8 Planets • Musical Solar System • Lyria AI'}
          </span>
        </div>
        <StatusIndicators
          isTracking={isTracking}
          isPinching={isPinching}
          isFist={isFist}
          cameraMode={cameraMode}
          isConnected={isConnected}
          isPlaying={isPlaying}
          isMultiplayer={isMultiplayer}
          multiplayerConnected={multiplayerConnected}
          playerCount={players.length}
        />
      </header>

      {/* Mode Indicator */}
      {cameraMode !== 'idle' && (
        <ModeIndicator mode={cameraMode} />
      )}

      {/* Depth Indicator removed - was blocking the view */}

      {/* Left Panel */}
      <div className="left-panel">
        <div className="panel-section">
          <h3>🌌 Galáxias</h3>
          <div className="galaxy-status">
            <div className="galaxy-name">
              {galaxies.find(g => g.id === currentGalaxyId)?.name || 'Desconhecida'}
            </div>
            <div className="galaxy-mood">
              {galaxies.find(g => g.id === currentGalaxyId)?.mood || ''}
            </div>
          </div>
          <button
            className={`galaxy-toggle ${sceneMode === 'galaxyMap' ? 'active' : ''}`}
            onClick={onToggleSceneMode}
          >
            {sceneMode === 'galaxyMap' ? '🔭 VOLTAR AO SISTEMA' : '🗺️ ABRIR MAPA'}
          </button>
          <div className="galaxy-list">
            {galaxies.map(galaxy => (
              <button
                key={galaxy.id}
                className={`galaxy-item ${galaxy.id === currentGalaxyId ? 'active' : ''}`}
                onClick={() => onSelectGalaxy?.(galaxy.id)}
              >
                <span className="galaxy-dot" style={{ background: galaxy.color }} />
                <span className="galaxy-label">{galaxy.name}</span>
                <span className="galaxy-tag">{galaxy.mood}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Multiplayer Toggle */}
        <div className="panel-section">
          <h3>👥 Mode</h3>
          <button 
            className={`multiplayer-toggle ${isMultiplayer ? 'active' : ''}`}
            onClick={onToggleMultiplayer}
          >
            {isMultiplayer ? '🌐 MULTIPLAYER' : '👤 SINGLE PLAYER'}
          </button>
          {isMultiplayer && (
            <div className="multiplayer-status">
              <span className={`status-dot ${multiplayerConnected ? 'connected' : ''}`} />
              {multiplayerConnected 
                ? `Connected • ${players.length} player${players.length !== 1 ? 's' : ''}`
                : 'Connecting to server...'}
            </div>
          )}
        </div>

        {/* Players List (Multiplayer) */}
        {isMultiplayer && players.length > 0 && (
          <div className="panel-section">
            <h3>🎮 Players ({players.length})</h3>
            <div className="players-list">
              {players.map(player => (
                <div key={player.id} className="player-item">
                  <div 
                    className="player-color" 
                    style={{ background: player.color }}
                  />
                  <span className="player-name">
                    {player.id.replace('player_', 'Player ')}
                  </span>
                  <span className="player-hands">
                    {player.hands.length} hand{player.hands.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="panel-section">
          <h3>🚀 Navigation</h3>
          <ul className="instructions-list">
            <li><strong>👌 Pinch</strong> → Grab planet</li>
            <li><strong>✊ Fist</strong> → Orbit camera</li>
            <li><strong>🖐️ Hand close</strong> → Push to Sun</li>
            <li><strong>🖐️ Hand far</strong> → Pull to outer orbit</li>
            <li><strong>🧭 Depth near/far</strong> → Zoom map</li>
          </ul>
          <div className="camera-hint">
            {isMultiplayer 
              ? 'Each player controls different planets!'
              : 'Closer to Sun = Higher musical influence!'}
          </div>
        </div>

        <div className="panel-section">
          <h3>🪐 Planets ({weightedPrompts.length}/{orbs.length} active)</h3>
          <div className="weights-list">
            {orbs.map((orb) => {
              const wp = weightedPrompts.find(w => w.orbId === orb.id)
              const isActive = !!wp
              const percentage = isActive ? Math.round((wp.weight / 1.5) * 100) : 0
              const displayName = orb.planetName || orb.label
              return (
                <div key={orb.id} className={`weight-item ${isActive ? 'active' : 'inactive'}`}>
                  <div 
                    className="weight-color" 
                    style={{ background: orb.color, opacity: isActive ? 1 : 0.3 }}
                  />
                  <span className="weight-label">{displayName}</span>
                  {isActive ? (
                    <>
                      <span className="weight-value">{percentage}%</span>
                      <div className="weight-bar-bg">
                        <div 
                          className="weight-bar"
                          style={{ 
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${orb.color}88, ${orb.color})`
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="weight-inactive">OFF</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-section">
          <h3>☀️ Solar Energy</h3>
          <PowerMeter 
            averageInfluence={averageInfluence} 
            totalInfluence={totalInfluence}
            orbCount={weightedPrompts.length}
          />
        </div>

        <div className="panel-section">
          <h3>✨ Constelações</h3>
          <div className="constellation-row">
            <span className="constellation-label">Criadas</span>
            <span className="constellation-value">{constellations.length}</span>
          </div>
          <div className="constellation-row">
            <span className="constellation-label">Em desenho</span>
            <span className="constellation-value">{Object.keys(constellationDrafts).length}</span>
          </div>
        </div>

        <div className="panel-section">
          <h3>🕳️ Buracos Negros</h3>
          <div className={`blackhole-indicator ${blackHoleImpact > 0.15 ? 'active' : ''}`}>
            <span className="blackhole-label">{blackHoleImpact > 0.15 ? 'Drop ativo' : 'Estável'}</span>
            <span className="blackhole-value">{Math.round(blackHoleImpact * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="bottom-controls">
        <div className="transport">
          <button
            className={`play-button ${isPlaying ? 'playing' : ''}`}
            onClick={isPlaying ? onStop : onPlay}
          >
            {isPlaying ? '⏹ STOP' : '▶ PLAY'}
          </button>

          <div className="bpm-control">
            <button onClick={() => setConfig(c => ({ ...c, bpm: Math.max(60, c.bpm - 5) }))}>-</button>
            <div className="bpm-display">
              <span className="bpm-value">{config.bpm}</span>
              <span className="bpm-label">BPM</span>
            </div>
            <button onClick={() => setConfig(c => ({ ...c, bpm: Math.min(200, c.bpm + 5) }))}>+</button>
          </div>
        </div>

        <div className="config-sliders">
          <ConfigSlider
            label="Guidance"
            value={config.guidance}
            min={0}
            max={6}
            step={0.5}
            onChange={(v) => setConfig(c => ({ ...c, guidance: v }))}
            color="#00ffaa"
          />
          <ConfigSlider
            label="Density"
            value={config.density}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => setConfig(c => ({ ...c, density: v }))}
            color="#ffaa00"
          />
          <ConfigSlider
            label="Brightness"
            value={config.brightness}
            min={0}
            max={1}
            step={0.1}
            onChange={(v) => setConfig(c => ({ ...c, brightness: v }))}
            color="#ff00aa"
          />
        </div>

        <div className="prompts-summary">
          <span className="summary-label">Active:</span>
          <span className="summary-count">{weightedPrompts.length} of {orbs.length}</span>
        </div>
      </div>

      {/* Webcam Preview */}
      <WebcamPreview videoRef={videoRef} isTracking={isTracking} />
    </div>
  )
}

/**
 * Mode Indicator - Shows current gesture mode
 */
function ModeIndicator({ mode }) {
  const config = {
    camera: {
      icon: '✊',
      label: 'CAMERA MODE',
      hint: 'Move hand to rotate view',
      color: '#00ff88'
    },
    dragging: {
      icon: '👌',
      label: 'DRAGGING',
      hint: 'Hand close → center | Hand far → away',
      color: '#ffaa00'
    }
  }

  const current = config[mode]
  if (!current) return null

  return (
    <div className="mode-indicator" style={{ borderColor: current.color }}>
      <span className="mode-icon">{current.icon}</span>
      <span className="mode-label" style={{ color: current.color }}>{current.label}</span>
      <span className="mode-hint">{current.hint}</span>
    </div>
  )
}

/**
 * Depth Indicator - Shows current depth level when dragging
 * depth: 0 = close to camera (orb near center)
 * depth: 1 = far from camera (orb far from center)
 */
function DepthIndicator({ depth }) {
  // Invert for display: 0% = far, 100% = close
  const closeness = Math.round((1 - depth) * 100)
  
  // Color: warm colors as planet gets closer to sun
  const getColor = () => {
    if (closeness > 70) return '#ffaa00' // Hot, close to sun
    if (closeness > 40) return '#ff6644'
    return '#4488ff' // Cold, outer orbit
  }
  
  const color = getColor()
  
  return (
    <div className="depth-indicator">
      <div className="depth-header">
        <span className="depth-icon">☀️</span>
        <span className="depth-title">ORBIT DISTANCE</span>
      </div>
      <div className="depth-content">
        <div className="depth-labels">
          <span className="depth-label-far">OUTER ORBIT</span>
          <span className="depth-label-close">NEAR SUN</span>
        </div>
        <div className="depth-bar-container">
          <div 
            className="depth-bar-fill"
            style={{ 
              width: `${closeness}%`,
              background: `linear-gradient(90deg, #4488ff88, ${color})`
            }}
          />
          <div 
            className="depth-marker"
            style={{ left: `${closeness}%`, background: color }}
          />
        </div>
        <div className="depth-value" style={{ color }}>
          {closeness}% to Sun
        </div>
        <div className="depth-hint">
          {closeness < 40 
            ? '← Move hand closer to enter inner orbit'
            : closeness > 70 
              ? '☀️ Solar proximity zone!'
              : 'Approaching inner solar system...'}
        </div>
      </div>
    </div>
  )
}

/**
 * Status Indicators
 */
function StatusIndicators({ 
  isTracking, 
  isPinching, 
  isFist, 
  cameraMode, 
  isConnected, 
  isPlaying,
  isMultiplayer,
  multiplayerConnected,
  playerCount = 0
}) {
  return (
    <div className="status-indicators">
      {isMultiplayer ? (
        <>
          <div className={`status-item ${multiplayerConnected ? 'active' : ''}`}>
            <span className="status-dot" />
            <span>{multiplayerConnected ? 'Server OK' : 'Connecting'}</span>
          </div>
          <div className={`status-item ${playerCount > 0 ? 'active' : ''}`}>
            <span className="status-dot" />
            <span>{playerCount} Player{playerCount !== 1 ? 's' : ''}</span>
          </div>
        </>
      ) : (
        <>
          <div className={`status-item ${isTracking ? 'active' : ''}`}>
            <span className="status-dot" />
            <span>{isTracking ? 'Hand OK' : 'No Hand'}</span>
          </div>
          <div className={`status-item ${cameraMode === 'camera' ? 'active camera' : (isPinching ? 'active warning' : '')}`}>
            <span className="status-dot" />
            <span>{cameraMode === 'camera' ? 'Fist' : (isPinching ? 'Pinch' : 'Open')}</span>
          </div>
        </>
      )}
      <div className={`status-item ${isConnected ? 'active' : ''}`}>
        <span className="status-dot" />
        <span>{isConnected ? 'Lyria' : 'Offline'}</span>
      </div>
      <div className={`status-item ${isPlaying ? 'active playing' : ''}`}>
        <span className="status-dot" />
        <span>{isPlaying ? 'Playing' : 'Stopped'}</span>
      </div>
    </div>
  )
}

/**
 * Power Meter
 */
function PowerMeter({ averageInfluence, totalInfluence, orbCount }) {
  const avgPercentage = Math.round(averageInfluence * 100)
  const maxTotal = orbCount * 1.5
  const totalPercentage = maxTotal > 0 ? Math.round((totalInfluence / maxTotal) * 100) : 0
  
  const getColor = (value) => {
    if (value > 70) return '#00ff88'
    if (value > 40) return '#ffaa00'
    return '#ff4444'
  }

  return (
    <div className="power-meter">
      <div className="power-row">
        <span className="power-label">Avg Influence</span>
        <div className="power-bar-container">
          <div 
            className="power-bar"
            style={{ 
              width: `${avgPercentage}%`,
              background: `linear-gradient(90deg, ${getColor(avgPercentage)}44, ${getColor(avgPercentage)})`
            }}
          />
        </div>
        <span className="power-value" style={{ color: getColor(avgPercentage) }}>
          {avgPercentage}%
        </span>
      </div>
      
      <div className="power-row">
        <span className="power-label">Total Power</span>
        <div className="power-bar-container">
          <div 
            className="power-bar"
            style={{ 
              width: `${totalPercentage}%`,
              background: `linear-gradient(90deg, #00aaff44, #00aaff)`
            }}
          />
        </div>
        <span className="power-value" style={{ color: '#00aaff' }}>
          {totalInfluence.toFixed(1)}
        </span>
      </div>

      <div className="power-tip">
        💡 Drag orbs to CENTER for more power!
      </div>
    </div>
  )
}

/**
 * Config Slider
 */
function ConfigSlider({ label, value, min, max, step, onChange, color }) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="config-slider">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value" style={{ color }}>{value.toFixed(1)}</span>
      </div>
      <div className="slider-track">
        <div 
          className="slider-fill"
          style={{ 
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}44, ${color})`
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}

/**
 * Webcam Preview
 */
function WebcamPreview({ videoRef, isTracking }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId

    const draw = () => {
      const video = videoRef?.current
      if (video && video.readyState >= 2) {
        canvas.width = 180
        canvas.height = 135
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -180, 0, 180, 135)
        ctx.restore()

        if (isTracking) {
          ctx.strokeStyle = 'rgba(0, 255, 170, 0.5)'
          ctx.lineWidth = 2
          ctx.strokeRect(2, 2, 176, 131)
        }
      }
      animationId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animationId)
  }, [videoRef, isTracking])

  return (
    <div className={`webcam-preview ${isTracking ? 'tracking' : ''}`}>
      <canvas ref={canvasRef} />
      <span className="webcam-label">
        {isTracking ? '● TRACKING' : '○ NO HAND'}
      </span>
    </div>
  )
}

export default SpaceUI

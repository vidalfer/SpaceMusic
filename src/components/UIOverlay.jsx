import React from 'react'
import { useAppStore } from '../store/appStore'

/**
 * UIOverlay Component
 * Displays status information and instructions overlay
 */
function UIOverlay({ isTracking, isPinching, handPosition }) {
  const { debugMode, orbs } = useAppStore()

  // Count active orbs (in loading or ready state)
  const activeOrbs = orbs.filter(o => o.state !== 'idle').length

  return (
    <>
      {/* Header */}
      <div className="ui-overlay">
        <div className="logo">
          <h1>Gesture-Flow DJ</h1>
          <span>AI Music Performance Interface</span>
        </div>

        <div className="status-panel">
          <StatusItem 
            label="Hand Tracking" 
            active={isTracking}
          />
          <StatusItem 
            label="Pinch Gesture" 
            active={isPinching}
            warning={isPinching}
          />
          <StatusItem 
            label={`Active Orbs: ${activeOrbs}`} 
            active={activeOrbs > 0}
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="instructions">
        <h3>Como Usar</h3>
        <ul>
          <li>Posicione sua mão na frente da webcam</li>
          <li>Junte o polegar e o indicador para "pinçar"</li>
          <li>Arraste os orbes para o centro</li>
          <li>Solte para ativar a geração de áudio</li>
        </ul>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div className="debug-panel">
          <h4>Hand Data</h4>
          <div className="debug-row">
            <span>X:</span>
            <span>{handPosition.x.toFixed(3)}</span>
          </div>
          <div className="debug-row">
            <span>Y:</span>
            <span>{handPosition.y.toFixed(3)}</span>
          </div>
          <div className="debug-row">
            <span>Z:</span>
            <span>{handPosition.z.toFixed(3)}</span>
          </div>
          <div className="debug-row">
            <span>Pinch:</span>
            <span style={{ color: isPinching ? '#00ff88' : '#666680' }}>
              {isPinching ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="debug-row">
            <span>Track:</span>
            <span style={{ color: isTracking ? '#00ff88' : '#ff4444' }}>
              {isTracking ? 'ACTIVE' : 'LOST'}
            </span>
          </div>
          
          <h4 style={{ marginTop: '16px' }}>Orb States</h4>
          {orbs.map(orb => (
            <div key={orb.id} className="debug-row">
              <span>{orb.label}:</span>
              <span style={{ 
                color: orb.state === 'idle' ? '#666680' : 
                       orb.state === 'loading' ? '#ffaa00' : 
                       orb.state === 'ready' ? '#00ff88' : '#ff00aa'
              }}>
                {orb.state.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Status Item Component
 */
function StatusItem({ label, active, warning }) {
  return (
    <div className="status-item">
      <div className={`status-dot ${active ? (warning ? 'warning' : 'active') : ''}`} />
      <span className="status-label">{label}</span>
    </div>
  )
}

export default UIOverlay

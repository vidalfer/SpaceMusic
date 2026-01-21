import React, { useRef, useEffect, useState } from 'react'

/**
 * MixerInterface Component
 * Interface de DJ com orbes arrastáveis e slots com controle de peso
 */
function MixerInterface({
  availableOrbs,
  activeSlots,
  onDropInSlot,
  onRemoveFromSlot,
  onWeightChange,
  draggedOrb,
  setDraggedOrb,
  hoveredSlot,
  setHoveredSlot,
  handPosition,
  isPinching,
  isTracking
}) {
  const containerRef = useRef(null)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })

  // Update cursor position based on hand
  useEffect(() => {
    if (!containerRef.current || !isTracking) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = handPosition.x * rect.width
    const y = handPosition.y * rect.height
    setCursorPos({ x, y })
  }, [handPosition, isTracking])

  // Handle mouse/touch drag start
  const handleDragStart = (orb, e) => {
    e.preventDefault()
    setDraggedOrb(orb)
  }

  // Handle drop
  const handleDrop = (slotId) => {
    if (draggedOrb) {
      onDropInSlot(slotId, draggedOrb)
    }
  }

  return (
    <div className="mixer-interface" ref={containerRef}>
      {/* Available Orbs Panel */}
      <div className="orbs-panel">
        <h3>🎵 Sound Elements</h3>
        <p className="panel-hint">Drag to slots below</p>
        <div className="orbs-grid">
          {availableOrbs.map(orb => {
            // Check if orb is already in a slot
            const isInSlot = activeSlots.some(s => s.orb?.id === orb.id)
            
            return (
              <div
                key={orb.id}
                className={`orb-item ${isInSlot ? 'in-use' : ''} ${draggedOrb?.id === orb.id ? 'dragging' : ''}`}
                style={{ '--orb-color': orb.color }}
                draggable={!isInSlot}
                onDragStart={(e) => handleDragStart(orb, e)}
                onMouseDown={(e) => !isInSlot && handleDragStart(orb, e)}
              >
                <div className="orb-icon" style={{ background: orb.color }}>
                  <span className="orb-glow" />
                </div>
                <span className="orb-label">{orb.label}</span>
                {isInSlot && <span className="in-use-badge">IN USE</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mix Slots Area */}
      <div className="slots-area">
        <h3>🎛️ Active Mix</h3>
        <p className="panel-hint">Drop sounds here • Adjust weight with slider</p>
        
        <div className="slots-container">
          {activeSlots.map((slot, index) => (
            <MixSlot
              key={slot.slotId}
              slot={slot}
              index={index}
              isHovered={hoveredSlot === slot.slotId}
              onDrop={() => handleDrop(slot.slotId)}
              onRemove={() => onRemoveFromSlot(slot.slotId)}
              onWeightChange={(w) => onWeightChange(slot.slotId, w)}
              onDragOver={() => setHoveredSlot(slot.slotId)}
              onDragLeave={() => setHoveredSlot(null)}
              draggedOrb={draggedOrb}
            />
          ))}
        </div>
      </div>

      {/* Hand Cursor (when tracking) */}
      {isTracking && (
        <div 
          className={`hand-cursor ${isPinching ? 'pinching' : ''}`}
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            pointerEvents: 'none'
          }}
        >
          <div className="cursor-inner" />
          <div className="cursor-ring" />
          {isPinching && <div className="cursor-grab">✊</div>}
        </div>
      )}

      {/* Dragged orb preview */}
      {draggedOrb && (
        <div 
          className="dragged-orb-preview"
          style={{
            '--orb-color': draggedOrb.color,
            left: cursorPos.x || '50%',
            top: cursorPos.y || '50%'
          }}
        >
          <div className="preview-icon" style={{ background: draggedOrb.color }} />
          <span>{draggedOrb.label}</span>
        </div>
      )}
    </div>
  )
}

/**
 * MixSlot Component
 * Individual slot with weight control
 */
function MixSlot({ 
  slot, 
  index, 
  isHovered, 
  onDrop, 
  onRemove, 
  onWeightChange,
  onDragOver,
  onDragLeave,
  draggedOrb
}) {
  const hasOrb = slot.orb !== null

  return (
    <div 
      className={`mix-slot ${hasOrb ? 'filled' : 'empty'} ${isHovered ? 'hovered' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
        onDragLeave()
      }}
      onMouseUp={() => {
        if (draggedOrb) {
          onDrop()
        }
      }}
      style={hasOrb ? { '--slot-color': slot.orb.color } : {}}
    >
      <div className="slot-number">SLOT {index + 1}</div>
      
      {hasOrb ? (
        <>
          {/* Orb in slot */}
          <div className="slot-orb">
            <div 
              className="orb-visual"
              style={{ background: slot.orb.color }}
            />
            <span className="orb-name">{slot.orb.label}</span>
            <button 
              className="remove-btn"
              onClick={onRemove}
              title="Remove"
            >
              ✕
            </button>
          </div>

          {/* Weight Control */}
          <div className="weight-control">
            <label>WEIGHT</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={slot.weight}
              onChange={(e) => onWeightChange(parseFloat(e.target.value))}
              style={{
                '--weight-percent': `${(slot.weight / 2) * 100}%`,
                '--slot-color': slot.orb.color
              }}
            />
            <span className="weight-value">{slot.weight.toFixed(1)}</span>
          </div>

          {/* Weight visualization */}
          <div 
            className="weight-bar"
            style={{ 
              height: `${(slot.weight / 2) * 100}%`,
              background: slot.orb.color
            }}
          />
        </>
      ) : (
        <div className="empty-slot">
          <div className="drop-zone">
            <span className="drop-icon">+</span>
            <span className="drop-text">Drop here</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default MixerInterface

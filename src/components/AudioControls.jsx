import React, { useState, useEffect, useRef } from 'react'

/**
 * AudioControls Component
 * Control panel for audio engine
 */
function AudioControls({ 
  audioEngine, 
  onInitAudio, 
  isTracking,
  activeOrbId,
  handPosition 
}) {
  const { isReady, isPlaying, bpm, currentBar, play, stop, setBPM, getWaveform } = audioEngine
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  // Waveform visualization
  useEffect(() => {
    if (!canvasRef.current || !isReady) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    const draw = () => {
      const waveform = getWaveform()
      
      // Clear
      ctx.fillStyle = 'rgba(10, 10, 15, 0.3)'
      ctx.fillRect(0, 0, width, height)

      // Draw waveform
      ctx.strokeStyle = '#00ffaa'
      ctx.lineWidth = 2
      ctx.beginPath()

      const sliceWidth = width / waveform.length
      let x = 0

      for (let i = 0; i < waveform.length; i++) {
        const v = (waveform[i] + 1) / 2
        const y = v * height

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.stroke()

      // Draw center line
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isReady, getWaveform])

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '20px 32px',
      background: 'rgba(18, 18, 26, 0.95)',
      borderRadius: '16px',
      border: '1px solid rgba(0, 255, 170, 0.2)',
      backdropFilter: 'blur(10px)',
      zIndex: 100,
      minWidth: '400px'
    }}>
      {/* Waveform display */}
      <canvas
        ref={canvasRef}
        width={360}
        height={60}
        style={{
          borderRadius: '8px',
          background: 'rgba(0, 0, 0, 0.3)'
        }}
      />

      {/* Transport controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Init/Play button */}
        {!isReady ? (
          <button
            onClick={onInitAudio}
            style={{
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0a0a0f',
              background: 'linear-gradient(135deg, #00ffaa 0%, #00aaff 100%)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🔊 Initialize Audio
          </button>
        ) : (
          <>
            <button
              onClick={isPlaying ? stop : play}
              style={{
                width: '48px',
                height: '48px',
                fontSize: '20px',
                color: isPlaying ? '#ff4444' : '#00ffaa',
                background: 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${isPlaying ? '#ff4444' : '#00ffaa'}`,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isPlaying ? '⏹' : '▶'}
            </button>

            {/* BPM control */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <button
                onClick={() => setBPM(bpm - 5)}
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                -
              </button>
              
              <div style={{
                padding: '8px 16px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                color: '#00ffaa',
                minWidth: '80px',
                textAlign: 'center'
              }}>
                {bpm} BPM
              </div>
              
              <button
                onClick={() => setBPM(bpm + 5)}
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>

            {/* Bar counter */}
            <div style={{
              padding: '8px 16px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: '#888'
            }}>
              BAR {currentBar.toString().padStart(3, '0')}
            </div>
          </>
        )}
      </div>

      {/* Status row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: '#666'
      }}>
        <span style={{ color: isTracking ? '#00ff88' : '#666' }}>
          ● TRACKING: {isTracking ? 'ON' : 'OFF'}
        </span>
        <span>
          ● GRABBED: {activeOrbId || 'NONE'}
        </span>
        {handPosition && (
          <span>
            ● POS: X={handPosition.x.toFixed(2)} Y={handPosition.y.toFixed(2)}
          </span>
        )}
      </div>

      {/* DSP indicators when orb is grabbed */}
      {activeOrbId && (
        <div style={{
          display: 'flex',
          gap: '24px',
          marginTop: '8px'
        }}>
          <DSPMeter 
            label="VOLUME" 
            value={handPosition?.y || 0.5} 
            color="#00ffaa"
          />
          <DSPMeter 
            label="FILTER" 
            value={handPosition?.x || 0.5} 
            color="#ff00aa"
          />
        </div>
      )}
    </div>
  )
}

/**
 * DSP Meter Component
 */
function DSPMeter({ label, value, color }) {
  const percentage = Math.round(value * 100)
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px'
    }}>
      <span style={{
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: '#666',
        letterSpacing: '1px'
      }}>
        {label}
      </span>
      
      <div style={{
        width: '100px',
        height: '8px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: color,
          borderRadius: '4px',
          transition: 'width 0.05s'
        }} />
      </div>
      
      <span style={{
        fontSize: '12px',
        fontFamily: 'var(--font-mono)',
        color: color
      }}>
        {percentage}%
      </span>
    </div>
  )
}

export default AudioControls

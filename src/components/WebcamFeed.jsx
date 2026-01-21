import React, { useEffect, useRef, useState } from 'react'

/**
 * WebcamFeed Component
 * Displays the webcam preview in the corner
 */
function WebcamFeed({ videoRef, isTracking }) {
  const canvasRef = useRef(null)
  const [hasVideo, setHasVideo] = useState(false)

  // Mirror the video feed to the visible canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId

    const drawFrame = () => {
      const video = videoRef?.current
      
      if (video && video.readyState >= 2) {
        if (!hasVideo) setHasVideo(true)
        
        // Set canvas size to match video
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
        }

        // Mirror horizontally and draw
        ctx.save()
        ctx.scale(-1, 1)
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height)
        ctx.restore()

        // Draw tracking overlay
        if (isTracking) {
          // Add subtle overlay effect
          ctx.fillStyle = 'rgba(0, 255, 170, 0.05)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Border glow effect
          ctx.strokeStyle = 'rgba(0, 255, 170, 0.3)'
          ctx.lineWidth = 4
          ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
        }
      }

      animationId = requestAnimationFrame(drawFrame)
    }

    drawFrame()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [videoRef, isTracking, hasVideo])

  return (
    <div className={`webcam-container ${isTracking ? 'tracking-active' : ''}`}>
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          background: '#12121a'
        }} 
      />
      
      {/* No video message */}
      {!hasVideo && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666680',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px'
        }}>
          <div style={{ marginBottom: '8px' }}>📷</div>
          Aguardando câmera...
        </div>
      )}
      
      {/* Tracking status indicator */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '4px 8px',
        borderRadius: '4px',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px'
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: isTracking ? '#00ff88' : hasVideo ? '#ffaa00' : '#ff4444',
          boxShadow: isTracking ? '0 0 8px #00ff88' : 'none'
        }} />
        <span style={{ color: isTracking ? '#00ff88' : hasVideo ? '#ffaa00' : '#ff4444' }}>
          {isTracking ? 'TRACKING' : hasVideo ? 'NO HAND' : 'NO CAMERA'}
        </span>
      </div>

      {/* Scan lines effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.1) 2px,
          rgba(0, 0, 0, 0.1) 4px
        )`,
        pointerEvents: 'none'
      }} />
    </div>
  )
}

export default WebcamFeed

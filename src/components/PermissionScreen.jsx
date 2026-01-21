import React from 'react'

/**
 * PermissionScreen Component
 * Shows when camera permission is needed or denied
 */
function PermissionScreen({ onRetry, error }) {
  const isDenied = error?.includes('denied') || error?.includes('NotAllowedError')

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2f 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      zIndex: 1000,
      fontFamily: 'var(--font-display)'
    }}>
      {/* Icon */}
      <div style={{
        fontSize: '80px',
        marginBottom: '24px',
        animation: 'pulse 2s infinite'
      }}>
        {isDenied ? '🚫' : '📷'}
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: '32px',
        fontWeight: 600,
        color: isDenied ? '#ff6b6b' : '#00ffaa',
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        {isDenied ? 'Permissão da Câmera Bloqueada' : 'Permissão de Câmera Necessária'}
      </h1>

      {/* Description */}
      <p style={{
        fontSize: '16px',
        color: '#888',
        maxWidth: '500px',
        textAlign: 'center',
        lineHeight: 1.6,
        marginBottom: '32px'
      }}>
        {isDenied 
          ? 'A permissão para usar a câmera foi negada. Você precisa habilitá-la manualmente nas configurações do navegador.'
          : 'O Gesture-Flow DJ precisa de acesso à sua webcam para rastrear os movimentos da sua mão e controlar a música.'}
      </p>

      {/* Instructions for denied permission */}
      {isDenied && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          marginBottom: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{
            fontSize: '14px',
            color: '#00ffaa',
            marginBottom: '16px',
            letterSpacing: '1px'
          }}>
            COMO PERMITIR A CÂMERA:
          </h3>
          
          <ol style={{
            color: '#ccc',
            fontSize: '14px',
            lineHeight: 1.8,
            paddingLeft: '20px',
            margin: 0
          }}>
            <li>Clique no ícone de <strong>cadeado 🔒</strong> ou <strong>câmera 📷</strong> na barra de endereço</li>
            <li>Encontre a opção <strong>"Câmera"</strong></li>
            <li>Mude de <strong>"Bloquear"</strong> para <strong>"Permitir"</strong></li>
            <li>Clique em <strong>"Tentar Novamente"</strong> abaixo</li>
          </ol>

          {/* Visual guide */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>🔒</span>
            <span style={{ color: '#888', fontSize: '13px' }}>
              ← Clique aqui na barra de endereço do navegador
            </span>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <button
          onClick={onRetry}
          style={{
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: 500,
            color: '#0a0a0f',
            background: 'linear-gradient(135deg, #00ffaa 0%, #00aaff 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 4px 20px rgba(0, 255, 170, 0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 6px 30px rgba(0, 255, 170, 0.4)'
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 4px 20px rgba(0, 255, 170, 0.3)'
          }}
        >
          {isDenied ? '🔄 Tentar Novamente' : '📷 Permitir Câmera'}
        </button>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: 500,
            color: '#888',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)'
            e.target.style.color = '#fff'
          }}
          onMouseOut={(e) => {
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
            e.target.style.color = '#888'
          }}
        >
          Recarregar Página
        </button>
      </div>

      {/* Error details (small) */}
      {error && (
        <p style={{
          marginTop: '24px',
          fontSize: '11px',
          color: '#666',
          fontFamily: 'var(--font-mono)'
        }}>
          Erro: {error}
        </p>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}

export default PermissionScreen

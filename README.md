# 🎛️ Gesture-Flow DJ

Uma interface web de performance musical em tempo real onde o usuário atua como um maestro de IA, controlando a música através de gestos manuais detectados via webcam.

![Gesture-Flow DJ](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.161-000000?logo=three.js)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-4285F4?logo=google)
![Tone.js](https://img.shields.io/badge/Tone.js-15.0-FF6B6B)

## 🎯 Visão Geral

O **Gesture-Flow DJ** é uma demo interativa que replica a sensação do "MusicFX DJ" do Google, mas controlada inteiramente por gestos manuais via webcam. O sistema usa **MediaPipe** para detecção de mãos em tempo real, **React Three Fiber** para visualização 3D imersiva, e **Tone.js** para processamento de áudio com latência zero.

### O Conceito: "Latency Hiding"

O segredo do MusicFX DJ é dar feedback **imediato** ao usuário enquanto a IA gera o novo áudio em background:

1. **Feedback Instantâneo (0ms)**: Filtros e volume são controlados em tempo real pelo gesto
2. **Geração AI (2-3s)**: A API Lyria gera o novo loop em background
3. **Transição Seamless**: O novo áudio é sincronizado no próximo compasso

## 🚀 Quick Start

### Frontend

```bash
# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:5173`

### Backend (Opcional - para geração AI real)

```bash
cd backend

# Crie um ambiente virtual
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Instale as dependências
pip install -r requirements.txt

# Configure sua API key
# Copie env.example.txt para .env e adicione sua GEMINI_API_KEY

# Inicie o servidor
uvicorn main:app --reload --port 8000
```

## 🎮 Como Usar

1. **Permita acesso à webcam** quando solicitado
2. **Clique em "Initialize Audio"** (necessário para ativar o áudio no navegador)
3. **Posicione sua mão** na frente da câmera
4. **Faça o gesto de pinça** (polegar + indicador juntos) para agarrar um orbe
5. **Arraste o orbe** e observe os efeitos:
   - **Eixo Y (altura)**: Controla o Volume/Intensidade
   - **Eixo X (lateral)**: Controla o Filtro (LowPass)
6. **Solte no centro** para ativar a geração de áudio

### Feedback Visual

| Estado | Cor | Significado |
|--------|-----|-------------|
| Idle | 🔵 Azul/Original | Orbe inativo |
| Grabbed | 🟣 Magenta | Orbe sendo arrastado |
| Loading | 🟡 Amarelo | IA gerando áudio |
| Ready | 🟢 Verde | Áudio pronto! |

## 🏗️ Arquitetura

```
gesture-flow-dj/
├── src/
│   ├── components/
│   │   ├── Scene.jsx          # Cena 3D principal
│   │   ├── SoundOrb.jsx       # Orbes interativos com física
│   │   ├── HandCursor.jsx     # Cursor 3D da mão
│   │   ├── AudioControls.jsx  # Painel de controle de áudio
│   │   ├── UIOverlay.jsx      # Interface de status
│   │   └── WebcamFeed.jsx     # Preview da webcam
│   ├── hooks/
│   │   ├── useHandTracking.js   # MediaPipe + LERP smoothing
│   │   ├── useAudioEngine.js    # Tone.js DSP engine
│   │   └── useLyriaRealtime.js  # WebSocket para Lyria API
│   ├── services/
│   │   └── audioService.js      # API client
│   └── store/
│       └── appStore.js          # Estado global (Zustand)
├── backend/
│   ├── main.py                  # FastAPI server
│   └── requirements.txt
└── public/
    └── samples/                 # Loops de áudio de teste
```

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Uso |
|------------|-----|
| **React + Vite** | Framework e bundler |
| **React Three Fiber** | Renderização 3D |
| **@react-three/drei** | Helpers para R3F |
| **MediaPipe Hands** | Detecção de gestos |
| **Tone.js** | Audio engine com DSP |
| **Zustand** | Gerenciamento de estado |

### Backend
| Tecnologia | Uso |
|------------|-----|
| **FastAPI** | API REST + WebSocket |
| **google-genai** | SDK para Lyria API |
| **uvicorn** | ASGI server |

## 🎵 Integração com Google Lyria

O projeto está preparado para integração com a [API Lyria RealTime](https://ai.google.dev/gemini-api/docs/music-generation):

```python
# backend/main.py - Exemplo de uso
from google import genai
from google.genai import types

client = genai.Client(http_options={'api_version': 'v1alpha'})

async with client.aio.live.music.connect(model='models/lyria-realtime-exp') as session:
    await session.set_weighted_prompts(prompts=[
        types.WeightedPrompt(text='minimal techno', weight=1.0),
    ])
    await session.set_music_generation_config(
        config=types.LiveMusicGenerationConfig(bpm=120, temperature=1.0)
    )
    await session.play()
```

### Parâmetros Lyria mapeados para gestos:

| Gesto | Parâmetro Lyria | Range |
|-------|-----------------|-------|
| Mão Y (altura) | `density` | 0.0 - 1.0 |
| Mão X (lateral) | `brightness` | 0.0 - 1.0 |
| Zona extrema Y | Prompt: "intense, powerful" | - |
| Zona extrema X | Prompt: "complex, syncopated" | - |

## 🔧 Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` no diretório `backend/`:

```env
GEMINI_API_KEY=your_api_key_here
```

Obtenha sua API key em: https://aistudio.google.com/app/apikey

### Samples de Áudio

Para testar sem a API Lyria, coloque arquivos de áudio em `public/samples/`:
- `drums.mp3` - Loop de bateria
- `bass.mp3` - Loop de baixo
- `synth.mp3` - Pad de sintetizador
- `fx.mp3` - Efeitos/risers
- `melody.mp3` - Melodia/arpejo

## 📚 Referências

- [Google Lyria RealTime](https://ai.google.dev/gemini-api/docs/music-generation?hl=pt-br)
- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Tone.js](https://tonejs.github.io/)

## 📄 Licença

MIT © 2026

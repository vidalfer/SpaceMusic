# 🪐 SpaceMusic: O Universo Musical Interativo

Uma experiência imersiva em 3D onde a mixagem e a criação musical são controladas pela exploração espacial. Atue como um "Arquiteto Cósmico", navegando entre galáxias e manipulando planetas e estrelas usando gestos manuais via webcam.

## 🌌 Modos de Experiência

O SpaceMusic expandiu de um simples mixer para um vasto sistema multi-escala:

### 1. Sistema Solar (Mixer Orbital)
O núcleo original da experiência.
- **Mixagem por Gravidade**: A distância de um planeta ao Sol define o volume e a intensidade do seu "stem" musical.
- **Posicionamento Orbital**: Arraste planetas para mudar a fase e o arranjo da música em tempo real.
- **Interação Refinada**: Sistema de detecção com prioridade de profundidade, garantindo que você selecione sempre o objeto visualmente mais próximo.

### 2. Modo Constelação (Sequenciador Estelar)
Um minijogo interativo onde você cria padrões musicais.
- **Conexões Estelares**: Conecte estrelas para ativar gatilhos rítmicos e melódicos (Drums, Bass, Melody, Pads).
- **Gestos Dedicados**:
  - **Pinça Rápida (<300ms)**: Alterna a conexão de uma estrela.
  - **Pinça e Arraste**: Move as estrelas para reorganizar sua constelação.
  - **Pinça no Vazio**: Desfaz a última conexão.
  - **Pinça Longa no Vazio**: Limpa todas as conexões da constelação atual.

### 3. Portal de Navegação
Uma interface holográfica central para transição entre modos:
- **Mapa da Galáxia**: Visão macro para troca de galáxias e estilos musicais.
- **Buraco Negro**: Área mística para descoberta de novos sons e armazenamento.
- **Modo Constelação**: Acesso rápido ao minijogo musical.

## 🎮 Controles e Interação

Utilizamos **Google MediaPipe** para um rastreamento preciso das mãos sem necessidade de hardware extra.

### Gestos Principais
- **Pinça (Pinch) 👌**: Agarrar planetas, mover estrelas ou ativar botões.
- **Punho Fechado (Fist) ✊**: Ativa o modo de controle de câmera. Mova a mão para orbitar a visão ao redor da cena.
- **Centralizar Câmera 🎯**: Use o botão flutuante no canto superior direito para resetar a visão instantaneamente. O botão possui efeito *billboard* (sempre olha para você) e animações responsivas.

## 🛠️ Stack Tecnológica

- **Frontend**: React 18, Vite
- **3D Engine**: React Three Fiber (Three.js)
- **Componentes UI/UX**: Drei, Sparkles, Cloud, Text
- **Estado Global**: Zustand (appStore.js)
- **Hand Tracking**: MediaPipe Hands
- **Audio**: Tone.js para síntese e manipulação de áudio em tempo real.

## 🚀 Como Executar

### Pré-requisitos
- Node.js (v16+)
- Webcam funcional

### Instalação

```bash
# Clone o repositório e entre na pasta
# Instale as dependências
npm install

# Inicie o ambiente de desenvolvimento
npm run dev
```
Acesse `http://localhost:5173` no seu navegador.

## 🏗️ Estrutura de Arquivos Chave

- `src/components/SpaceScene.jsx`: Gerenciador principal da cena 3D e lógica de câmera.
- `src/components/ConstellationSystem.jsx`: Lógica do sistema de constelações e sequenciador.
- `src/components/NavigationPortal.jsx`: Interface de transição entre modos.
- `src/store/appStore.js`: Estado global (ViewMode, Galaxy, ZoomLevel).
- `src/hooks/useHandTracking.js`: Driver de integração com MediaPipe.

---

📄 **Licença**: MIT © 2026 SpaceMusic Team.

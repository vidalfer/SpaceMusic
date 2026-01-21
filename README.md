🪐 SpaceMusic: O Sistema Solar MusicalUma experiência musical colaborativa em 3D onde o mixagem de áudio é controlado pela física orbital. Você atua como um "Arquiteto Cósmico", arranjando planetas (stems musicais) ao redor de um Sol central (o master) usando gestos manuais via webcam.🌌 Visão GeralO SpaceMusic transforma a mixagem de áudio em um ambiente espacial imersivo. Diferente de faders lineares tradicionais, aqui a distância orbital define a intensidade. O projeto utiliza:Renderização 3D Imersiva: Um sistema solar completo com estrelas, nebulosas e iluminação dinâmica.Controle Gestual Avançado: Sistema de "Lock & Pinch" para precisão e gestos de punho para câmera.Áudio Espacial: A proximidade do planeta ao Sol dita sua influência no mix final.Multiplayer Local/Remoto: Suporte para múltiplos cursores e jogadores simultâneos interagindo na mesma galáxia.🎮 Controles e GestosO sistema utiliza MediaPipe para rastrear suas mãos. A interação foi desenhada para evitar seleções acidentais.1. Sistema de Seleção "Lock-on"Para evitar agarrar o planeta errado no espaço 3D:Hover (Aproximar): Mova o cursor sobre um planeta. Um anel Amarelo aparecerá (Candidato).Lock (Travar): Mantenha o cursor por alguns milissegundos. O anel ficará Verde e brilhante.Grab (Agarrar): Faça o gesto de Pinça (Pinch) para assumir o controle.2. Manipulação OrbitalPinça (Polegar + Indicador): Agarra o planeta travado.Arrastar para Perto do Sol: Aumenta o volume/intensidade e a influência daquela faixa.Arrastar para Longe: Diminui a intensidade, enviando o instrumento para o "espaço profundo".Movimento Circular: Altera a posição na órbita (faseamento).3. Controle de CâmeraPunho Fechado (Fist): Ao fechar a mão (sem pinçar), você assume o controle da câmera.Mova a mão para rotacionar a visão ao redor do sistema solar e explorar novos ângulos.🚀 Quick StartFrontendBash# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
Acesse http://localhost:5173 e permita o acesso à webcam.Backend (Python - Opcional para IA)O backend gerencia a integração com a API Google Lyria (MusicFX) e coordenação de usuários.Bashcd backend

# Crie e ative o ambiente virtual
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

# Instale dependências
pip install -r requirements.txt

# Configure a API Key do Gemini no arquivo .env
# GEMINI_API_KEY=sua_chave_aqui

# Inicie o servidor
uvicorn main:app --reload --port 8000
🏗️ Estrutura do Projetocomponents/SpaceScene.jsx: O coração da aplicação. Gerencia a cena Three.js, lógica de câmera orbital e o sistema de "Lock" dos planetas.components/SoundOrb.jsx: Representa cada planeta. Contém a lógica física de órbita, efeitos visuais (anéis, luas, brilho) e feedback de estado.components/Sun.jsx: O núcleo visual que reage à intensidade total da música (pulsação, erupções solares).hooks/useHandTracking.js: Abstração do MediaPipe para coordenadas normalizadas e detecção de gestos (Pinça/Punho).store/appStore.js: Gerenciamento de estado global com Zustand.🎨 Feedback VisualO sistema fornece feedback visual constante para que você saiba o que está acontecendo:ElementoVisualSignificadoAnel Amarelo🟡 GirandoCursor sobre o planeta (Aguardando Lock)Anel Verde🟢 FixoPlaneta Travado (Pronto para Agarrar)Anel Duplo🟢🟢 BrilhantePlaneta Agarrado (Sendo movido)Sol☀️ PulsandoIntensidade total do mix (Brilho aumenta com a música)Cursor🔵/🟣/🟢Muda de cor baseada no ID do jogador ou estado🛠️ Stack TecnológicaFrontend: React, Vite3D Engine: React Three Fiber, Drei, Three.jsComputer Vision: Google MediaPipe HandsAudio Engine: Tone.jsBackend: Python FastAPI (para orquestração e IA)📄 LicençaMIT © 2026

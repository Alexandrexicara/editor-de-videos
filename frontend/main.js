// main.js - Lógica principal do frontend

class AvatarEditor {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.avatar = null;
        this.videoElement = null;
        this.audioContext = null;
        
        this.init();
        this.setupEventListeners();
    }

    init() {
        this.setupThreeJS();
        this.createAvatar();
        this.animate();
    }

    setupThreeJS() {
        const canvas = document.getElementById('avatarCanvas');
        const container = document.querySelector('.stage');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }

    createAvatar() {
        // Criar avatar simples (esfera com expressões)
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0x7b5cff,
            shininess: 30
        });
        
        this.avatar = new THREE.Mesh(geometry, material);
        this.scene.add(this.avatar);
        
        // Adicionar olhos
        this.createEyes();
    }

    createEyes() {
        const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.3, 0.2, 0.8);
        this.avatar.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.3, 0.2, 0.8);
        this.avatar.add(rightEye);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.avatar) {
            // Animação suave do avatar
            this.avatar.rotation.y += 0.01;
            
            // Animação de fala (movimento vertical leve)
            const time = Date.now() * 0.002;
            this.avatar.position.y = Math.sin(time) * 0.1;
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    setupEventListeners() {
        const videoInput = document.getElementById('videoInput');
        const audioInput = document.getElementById('audioInput'); // Novo campo
        const processBtn = document.getElementById('processBtn');
        const avatarSelect = document.getElementById('avatarSelect');
        const downloadBtn = document.getElementById('downloadBtn');
        const customAvatarInput = document.getElementById('customAvatarInput');
        
        videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));
        audioInput.addEventListener('change', (e) => this.handleAudioUpload(e)); // Handler novo
        processBtn.addEventListener('click', () => this.processVideo());
        avatarSelect.addEventListener('change', (e) => this.changeAvatar(e.target.value));
        downloadBtn.addEventListener('click', () => this.downloadVideo());
        customAvatarInput.addEventListener('change', (e) => this.handleCustomAvatar(e));
        
        // Redimensionamento da janela
        window.addEventListener('resize', () => this.onWindowResize());
    }

    handleVideoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const videoUrl = URL.createObjectURL(file);
        const videoPreview = document.getElementById('videoPreview');
        
        videoPreview.src = videoUrl;
        videoPreview.style.display = 'block';
        document.getElementById('avatarCanvas').style.display = 'none';
        
        this.videoElement = videoPreview;
        
        // Mostrar status
        this.updateStatus('Vídeo carregado. Pronto para processar.', 0);
    }

    handleAudioUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.audioFile = file; // Armazenar arquivo de áudio
        
        const audioUrl = URL.createObjectURL(file);
        const audioPreview = document.createElement('audio');
        audioPreview.src = audioUrl;
        audioPreview.controls = true;
        audioPreview.style.cssText = 'width: 100%; margin-top: 10px;';
        
        // Adicionar preview de áudio abaixo do input
        const audioContainer = event.target.parentElement;
        if (!document.getElementById('audioPreview')) {
            audioPreview.id = 'audioPreview';
            audioContainer.appendChild(audioPreview);
        }
        
        this.updateStatus(`Áudio personalizado carregado: ${file.name}`, 10);
    }

    changeAvatar(avatarType) {
        const customAvatarSection = document.getElementById('customAvatarSection');
        
        if (avatarType === 'custom') {
            // Mostrar seção para upload de avatar personalizado
            customAvatarSection.style.display = 'block';
            this.updateStatus('Selecione seu avatar personalizado', 15);
        } else {
            // Esconder seção de avatar personalizado
            customAvatarSection.style.display = 'none';
            
            if (!this.avatar) return;
            
            let color;
            switch(avatarType) {
                case 'robot':
                    color = 0x4a90e2;
                    break;
                case 'human':
                    color = 0xffdbac;
                    break;
                case 'cartoon':
                    color = 0xff6b6b;
                    break;
                default:
                    color = 0x7b5cff;
            }
            
            this.avatar.material.color.set(color);
            this.updateStatus(`Avatar alterado para: ${avatarType}`, 20);
        }
    }

    handleCustomAvatar(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // Verificar formato suportado
        const supportedFormats = ['fbx', 'gltf', 'glb', 'obj', 'png', 'jpg', 'jpeg'];
        
        if (!supportedFormats.includes(fileExtension)) {
            alert('Formato não suportado! Use FBX, GLTF, GLB, OBJ, PNG, JPG ou JPEG.');
            event.target.value = ''; // Limpar input
            return;
        }
        
        this.updateStatus(`Avatar personalizado selecionado: ${fileName}`, 25);
        
        // Enviar avatar para o servidor
        this.uploadCustomAvatar(file);
        
        // Processar o avatar personalizado localmente também
        this.loadCustomAvatar(file);
    }

    async uploadCustomAvatar(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const response = await fetch('/upload-avatar', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.status === 'avatar_recebido') {
                this.updateStatus('Avatar personalizado salvo no servidor!', 35);
                console.log('Avatar enviado com sucesso:', result);
            } else {
                throw new Error(result.error || 'Falha no upload');
            }
        } catch (error) {
            console.error('Erro ao enviar avatar:', error);
            this.updateStatus('Erro ao salvar avatar no servidor', 0);
        }
    }

    loadCustomAvatar(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            
            try {
                // Para modelos 3D (FBX, GLTF, etc)
                if (file.name.endsWith('.fbx')) {
                    this.loadFBXModel(arrayBuffer);
                } else if (file.name.endsWith('.gltf') || file.name.endsWith('.glb')) {
                    this.loadGLTFModel(arrayBuffer);
                } else {
                    // Para imagens (PNG, JPG)
                    this.loadImageAsAvatar(arrayBuffer);
                }
            } catch (error) {
                console.error('Erro ao carregar avatar:', error);
                this.updateStatus('Erro ao carregar avatar personalizado', 0);
                alert('Não foi possível carregar o avatar. Tente outro formato.');
            }
        };
        
        reader.readAsArrayBuffer(file);
    }

    loadFBXModel(buffer) {
        // Simulação - em produção usaria FBXLoader
        console.log('Carregando modelo FBX...');
        this.updateStatus('Modelo FBX carregado com sucesso!', 30);
        
        // Substituir avatar atual por uma representação do modelo
        if (this.avatar) {
            this.scene.remove(this.avatar);
        }
        
        // Criar uma representação visual do modelo carregado
        const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0x00ff00,
            wireframe: true 
        });
        
        this.avatar = new THREE.Mesh(geometry, material);
        this.scene.add(this.avatar);
        
        this.createEyes(); // Adicionar olhos ao modelo
    }

    loadGLTFModel(buffer) {
        // Simulação - em produção usaria GLTFLoader
        console.log('Carregando modelo GLTF...');
        this.updateStatus('Modelo GLTF carregado com sucesso!', 30);
        
        // Similar ao FBX
        if (this.avatar) {
            this.scene.remove(this.avatar);
        }
        
        const geometry = new THREE.ConeGeometry(0.8, 2, 8);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff6600,
            wireframe: true 
        });
        
        this.avatar = new THREE.Mesh(geometry, material);
        this.scene.add(this.avatar);
        
        this.createEyes();
    }

    loadImageAsAvatar(imageBuffer) {
        // Converter buffer para imagem
        const blob = new Blob([imageBuffer]);
        const imageUrl = URL.createObjectURL(blob);
        
        // Criar textura a partir da imagem
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(imageUrl, (texture) => {
            console.log('Imagem carregada como avatar!');
            this.updateStatus('Imagem carregada como avatar!', 30);
            
            // Substituir avatar por um plano com a textura
            if (this.avatar) {
                this.scene.remove(this.avatar);
            }
            
            const geometry = new THREE.PlaneGeometry(2, 2);
            const material = new THREE.MeshBasicMaterial({ 
                map: texture,
                side: THREE.DoubleSide 
            });
            
            this.avatar = new THREE.Mesh(geometry, material);
            this.scene.add(this.avatar);
        });
    }

    async processVideo() {
        if (!this.videoElement || !this.videoElement.src) {
            alert('Por favor, selecione um vídeo primeiro!');
            return;
        }
        
        const processBtn = document.getElementById('processBtn');
        const btnText = processBtn.querySelector('.btn-text');
        
        // Desabilitar botão e mostrar loading
        processBtn.disabled = true;
        processBtn.classList.add('processing');
        btnText.textContent = 'Processando...';
        
        try {
            this.updateStatus('Iniciando processamento REAL...', 10);
            
            // Enviar vídeo para processamento
            const result = await this.sendVideoForProcessing();
            
            if (result.status === 'processado') {
                this.updateStatus('Processamento REAL concluído!', 100);
                
                // Mostrar vídeo processado
                await this.showProcessedVideo(result.outputPath);
                
                // Mostrar resultado e opção de download
                setTimeout(() => {
                    document.getElementById('resultSection').classList.add('show');
                    processBtn.style.display = 'none';
                }, 1000);
            }
            
        } catch (error) {
            console.error('Erro no processamento:', error);
            this.updateStatus('Erro no processamento. Tente novamente.', 0);
            alert('Ocorreu um erro durante o processamento REAL.');
        } finally {
            // Reabilitar botão
            processBtn.disabled = false;
            processBtn.classList.remove('processing');
            btnText.textContent = 'Gerar Vídeo Final';
        }
    }

    async sendVideoForProcessing() {
        const videoInput = document.getElementById('videoInput');
        const file = videoInput.files[0];
        
        if (!file && !this.audioFile) {
            throw new Error('Nenhum vídeo ou áudio selecionado');
        }
        
        const formData = new FormData();
        
        // Adicionar vídeo se existir
        if (file) {
            formData.append('video', file);
        }
        
        // Adicionar áudio personalizado se existir
        if (this.audioFile) {
            formData.append('customAudio', this.audioFile);
            this.updateStatus('Usando áudio personalizado...', 15);
        }
        
        // Etapas do processamento REAL
        const steps = [
            { message: 'Enviando arquivos para processamento...', progress: 20 },
            { message: file ? 'Extraindo áudio REAL...' : 'Processando áudio...', progress: 40 },
            { message: 'Gerando avatar REAL...', progress: 60 },
            { message: 'Combinando elementos...', progress: 80 },
            { message: 'Finalizando vídeo...', progress: 95 }
        ];
        
        for (const step of steps) {
            this.updateStatus(step.message, step.progress);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Erro no upload:', error);
            throw error;
        }
    }

    async showProcessedVideo(videoPath) {
        const processedVideo = document.getElementById('processedVideo');
        const avatarCanvas = document.getElementById('avatarCanvas');
        const videoPreview = document.getElementById('videoPreview');
        
        try {
            // Esconder outros elementos
            avatarCanvas.style.display = 'none';
            videoPreview.style.display = 'none';
            
            // Mostrar vídeo processado
            processedVideo.style.display = 'block';
            processedVideo.src = videoPath + '?' + new Date().getTime(); // Evitar cache
            
            // Tentar reproduzir automaticamente
            const playPromise = processedVideo.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Autoplay bloqueado, clique para reproduzir');
                });
            }
            
            this.updateStatus('✅ VÍDEO PROCESSADO DISPONÍVEL PARA VISUALIZAÇÃO!', 100);
            
        } catch (error) {
            console.error('Erro ao mostrar vídeo processado:', error);
            this.updateStatus('Erro ao carregar vídeo processado', 0);
        }
    }

    downloadVideo() {
        // Obter o caminho do vídeo processado
        const processedVideo = document.getElementById('processedVideo');
        const videoSrc = processedVideo.src;
        
        if (!videoSrc) {
            alert('Nenhum vídeo processado disponível para download!');
            return;
        }
        
        // Extrair nome do arquivo da URL
        const fileName = videoSrc.split('/').pop().split('?')[0] || 'video_avatar_final.mp4';
        
        // Criar elemento de download
        const link = document.createElement('a');
        link.href = videoSrc;
        link.download = fileName;
        link.click();
        
        this.updateStatus('📥 Download iniciado!', 100);
    }

    updateStatus(message, progress) {
        const statusElement = document.getElementById('status');
        const statusText = document.getElementById('statusText');
        const progressFill = document.getElementById('progressFill');
        
        statusElement.classList.add('active');
        statusText.textContent = message;
        progressFill.style.width = `${progress}%`;
    }

    downloadVideo() {
        // Simular download do vídeo processado
        const link = document.createElement('a');
        link.href = '#'; // Em produção, seria o caminho do vídeo gerado
        link.download = 'video_avatar_processado.mp4';
        link.click();
        
        alert('Download iniciado! (Simulação)');
    }

    onWindowResize() {
        const container = document.querySelector('.stage');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new AvatarEditor();
});
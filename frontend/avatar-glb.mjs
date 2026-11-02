import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const preview = document.getElementById('avatarPreview');
const status = (message, type = '') => window.avatarStudioRender?.status(message, type);
const controls = document.createElement('div');
controls.className = 'row';
controls.innerHTML = '<div class="field"><label for="gesturePreset">Gestos do modelo 3D</label><select id="gesturePreset"><option value="natural">Natural</option><option value="presentation">Apresentação</option><option value="calm">Calmo</option><option value="energetic">Energético</option></select></div><div class="field"><label for="expressionPreset">Expressão facial</label><select id="expressionPreset"><option value="neutral">Neutra</option><option value="smile">Sorridente</option><option value="serious">Séria</option></select></div><div class="field"><label for="animationClip">Animação incluída no modelo</label><select id="animationClip" disabled><option value="">Sem animações embutidas</option></select></div>';
preview.parentElement.insertBefore(controls, preview);
const field = document.createElement('div');
field.className = 'field';
field.innerHTML = '<label for="avatarModelFile">Modelo 3D do personagem (GLB)</label><div class="upload"><input id="avatarModelFile" type="file" accept=".glb,model/gltf-binary"></div><div class="hint">Envie um arquivo .GLB autocontido. Para boca e gestos articulados, o modelo precisa conter morph targets e esqueleto rigado. O modelo é processado localmente.</div>';
preview.parentElement.insertBefore(field, preview);
const style = document.createElement('style');
style.textContent = '#avatarPreview canvas{display:block;width:100%;height:auto;max-height:560px;object-fit:contain}';
document.head.appendChild(style);

let renderer = null, scene = null, camera = null, root = null, mixer = null, currentModelFile = null;
let clock = new THREE.Clock(), activeAnalyser = null, bones = [], morphTargets = [], expressionTargets = [], loadedAnimations = [];

function updateCameraFrame(width, height) {
  if (!camera || !root) return;
  camera.aspect = width / height;
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const distanceForHeight = (size.y / 2) / Math.tan(halfFov);
  const distanceForWidth = (size.x / 2) / (Math.tan(halfFov) * camera.aspect);
  camera.position.set(0, size.y * 0.04, Math.max(3.6, distanceForHeight, distanceForWidth) * 1.22 + size.z * 0.5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}
function fitModel(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  object.position.sub(center);
  object.scale.setScalar(2.1 / largest);
  updateCameraFrame(800, 600);
}
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(delta);
  const t = performance.now() / 1000;
  let mouth = 0;
  if (activeAnalyser) {
    const data = new Uint8Array(activeAnalyser.frequencyBinCount);
    activeAnalyser.getByteFrequencyData(data);
    mouth = Math.min(1, data.reduce((a, b) => a + b, 0) / Math.max(1, data.length) / 255 * 2.2);
  }
  for (const target of morphTargets) target.mesh.morphTargetInfluences[target.index] = mouth;
  const gesture = document.getElementById('gesturePreset')?.value || 'natural';
  const intensity = gesture === 'energetic' ? 0.22 : gesture === 'presentation' ? 0.16 : gesture === 'calm' ? 0.035 : 0.09;
  const speed = gesture === 'energetic' ? 3.1 : gesture === 'calm' ? 0.8 : 1.7;
  // Aplica o gesto também sobre modelos que já possuem animações embutidas.
  // O mixer atualiza o clipe primeiro; este ajuste acrescenta movimento sutil aos braços.
  bones.forEach((entry, index) => {
    // Remove o deslocamento do quadro anterior antes de aplicar o novo,
    // evitando acumular rotação e fazer os braços girarem sem limite.
    entry.bone.rotation.z -= entry.lastOffset || 0;
    const animatedRotation = entry.bone.rotation.z;
    const offset = Math.sin(t * speed + index * 1.4) * intensity;
    entry.bone.rotation.z = animatedRotation + offset;
    entry.lastOffset = offset;
  });
  const expression = document.getElementById('expressionPreset')?.value || 'neutral';
  expressionTargets.forEach(target => { const amount = expression === 'smile' && /smile|happy/i.test(target.name) ? 0.75 : expression === 'serious' && /frown|angry/i.test(target.name) ? 0.45 : 0; target.mesh.morphTargetInfluences[target.index] = amount; });
  if (renderer && scene && camera) renderer.render(scene, camera);
}
async function loadModel(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('Selecione um arquivo .GLB. Arquivos .gltf externos ainda não são aceitos.');
  if (file.size > 100 * 1024 * 1024) throw new Error('O modelo deve ter no máximo 100 MB.');
  status('Carregando modelo 3D...');
  const url = URL.createObjectURL(file);
  try {
    const loader = new GLTFLoader();
    const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    if (renderer) renderer.dispose();
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#151d30');
    camera = new THREE.PerspectiveCamera(32, 4/3, 0.01, 100);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(800, 600);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x46506b, 2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 4, 3);
    scene.add(key);
    root = gltf.scene;
    currentModelFile = file;
    scene.add(root);
    fitModel(root);
    bones = [];
    morphTargets = [];
    expressionTargets = [];
    root.traverse(object => {
      if (object.isBone && /arm|shoulder|upperarm/i.test(object.name)) bones.push({ bone: object, base: object.rotation.z });
      if (object.morphTargetDictionary && object.morphTargetInfluences) {
        for (const [name, index] of Object.entries(object.morphTargetDictionary)) {
          if (/jawopen|mouthopen|viseme_aa/i.test(name)) morphTargets.push({ mesh: object, index });
          if (/smile|happy|frown|angry/i.test(name)) expressionTargets.push({ mesh: object, index, name });
        }
      }
    });
    loadedAnimations = gltf.animations || [];
    const animationSelect = document.getElementById('animationClip');
    animationSelect.replaceChildren();
    if (loadedAnimations.length) {
      loadedAnimations.forEach((clip, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = clip.name || 'Animação ' + (index + 1);
        animationSelect.appendChild(option);
      });
      animationSelect.disabled = false;
      mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(loadedAnimations[0]).play();
    } else {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Sem animações embutidas';
      animationSelect.appendChild(option);
      animationSelect.disabled = true;
      mixer = null;
    }
    preview.replaceChildren(renderer.domElement);
    window.avatarStudioCanvas = renderer.domElement;
    window.avatarStudioResizeCanvas = (width, height) => { renderer.setSize(width, height, false); updateCameraFrame(width, height); };
    window.avatarStudioStartAnimation = analyser => { activeAnalyser = analyser || null; };
    status('Modelo 3D carregado. ' + (bones.length ? 'Esqueleto detectado.' : 'Sem ossos de braço detectados.') + ' ' + (morphTargets.length ? 'Sincronização de boca disponível.' : 'O modelo não possui morph target de boca detectável.'), 'ok');
    clock.start();
  } finally {
    URL.revokeObjectURL(url);
  }
}
document.getElementById('avatarModelFile').addEventListener('change', async event => {
  try { await loadModel(event.target.files[0]); }
  catch (error) { status('Não foi possível abrir o modelo: ' + error.message, 'error'); }
});
document.getElementById('animationClip').addEventListener('change', event => {
  if (!mixer) return;
  mixer.stopAllAction();
  const clip = loadedAnimations[Number(event.target.value)];
  if (clip) mixer.clipAction(clip).reset().play();
});
window.avatarStudioLoadModel = loadModel;
window.avatarStudioClearModel = () => { currentModelFile = null; activeAnalyser = null; window.avatarStudioCanvas = null; window.avatarStudioResizeCanvas = null; window.avatarStudioStartAnimation = null; if (renderer) { renderer.dispose(); renderer = null; } scene = null; camera = null; root = null; mixer = null; loadedAnimations = []; bones = []; morphTargets = []; expressionTargets = []; const select = document.getElementById('animationClip'); select.replaceChildren(); const option = document.createElement('option'); option.value = ''; option.textContent = 'Sem animações embutidas'; select.appendChild(option); select.disabled = true; };
window.avatarStudioCurrentModel = () => currentModelFile;
document.getElementById('createAvatar').addEventListener('click', () => { if (!document.getElementById('avatarPrompt').value.trim()) return; window.avatarStudioClearModel(); window.avatarStudioResizeCanvas = null; window.avatarStudioStartAnimation = null; activeAnalyser = null; });
document.getElementById('avatarFile').addEventListener('change', () => {
  window.avatarStudioClearModel();
  window.avatarStudioCanvas = null;
  window.avatarStudioResizeCanvas = null;
  window.avatarStudioStartAnimation = null;
  activeAnalyser = null;
});
animate();

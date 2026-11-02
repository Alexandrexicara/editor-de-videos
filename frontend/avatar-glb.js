import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const preview = document.getElementById('avatarPreview');
const status = (message, type = '') => window.avatarStudioRender?.status(message, type);
const field = document.createElement('div');
field.className = 'field';
field.innerHTML = '<label for="avatarModelFile">Modelo 3D do personagem (GLB)</label><div class="upload"><input id="avatarModelFile" type="file" accept=".glb,model/gltf-binary"></div><div class="hint">Envie um arquivo .GLB autocontido. Para boca e gestos articulados, o modelo precisa conter morph targets e esqueleto rigado. O modelo é processado localmente.</div>';
preview.parentElement.insertBefore(field, preview);
const style = document.createElement('style');
style.textContent = '#avatarPreview canvas{display:block;width:100%;height:auto;max-height:560px;object-fit:contain}';
document.head.appendChild(style);

let renderer = null, scene = null, camera = null, root = null, mixer = null;
let clock = new THREE.Clock(), activeAnalyser = null, bones = [], morphTargets = [];

function fitModel(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  object.position.sub(center);
  object.scale.setScalar(2.1 / largest);
  camera.position.set(0, 0.1, 3.6);
  camera.lookAt(0, 0, 0);
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
  bones.forEach((entry, index) => {
    if (!mixer) entry.bone.rotation.z = entry.base + Math.sin(t * 1.7 + index) * 0.07;
  });
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
    scene.add(root);
    fitModel(root);
    bones = [];
    morphTargets = [];
    root.traverse(object => {
      if (object.isBone && /arm|shoulder|upperarm/i.test(object.name)) bones.push({ bone: object, base: object.rotation.z });
      if (object.morphTargetDictionary && object.morphTargetInfluences) {
        for (const [name, index] of Object.entries(object.morphTargetDictionary)) {
          if (/jawopen|mouthopen|viseme_aa/i.test(name)) morphTargets.push({ mesh: object, index });
        }
      }
    });
    mixer = gltf.animations?.length ? new THREE.AnimationMixer(root) : null;
    if (mixer) gltf.animations.forEach(clip => mixer.clipAction(clip).play());
    preview.replaceChildren(renderer.domElement);
    window.avatarStudioCanvas = renderer.domElement;
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
document.getElementById('avatarFile').addEventListener('change', () => {
  window.avatarStudioCanvas = null;
  window.avatarStudioStartAnimation = null;
  activeAnalyser = null;
});
animate();

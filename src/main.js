import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#webgl');
const loaderScreen = document.querySelector('#loader');
const progressBar = document.querySelector('.scroll-progress span');

const MODEL_PATH = './assets/mclaren.glb';

const config = await fetch('./config/cameraPath.json').then((response) => response.json());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.0075);

/*
  V20:
  - o projeto passa a usar apenas um GLB: assets/mclaren.glb;
  - removidos os carregamentos separados de carro e studio;
  - removidas as luzes fixas anteriores do código;
  - a iluminação real é derivada somente das barras de luz que existem dentro do próprio GLB.
*/
scene.environment = null;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.34;
renderer.shadowMap.enabled = false;

const camera = new THREE.PerspectiveCamera(
  config.camera.fov,
  window.innerWidth / window.innerHeight,
  config.camera.near,
  config.camera.far
);

const cameraRig = {
  currentPosition: new THREE.Vector3(),
  currentTarget: new THREE.Vector3(),
  desiredPosition: new THREE.Vector3(),
  desiredTarget: new THREE.Vector3(),
  lookTarget: new THREE.Vector3()
};

const clock = new THREE.Clock();
const pointer = new THREE.Vector2(0, 0);
const smoothPointer = new THREE.Vector2(0, 0);

const modelRoot = new THREE.Group();
const modelLightRig = new THREE.Group();

let modelBaseRotationY = config.model.rotationY ?? 0;
let desiredScroll = 0;
let smoothScroll = 0;
let bokehPass;

scene.add(modelRoot);
modelRoot.add(modelLightRig);

function removeExternalLights(root) {
  /*
    Remove qualquer luz importada que não faça parte do sistema visual de barras.
    O arquivo enviado não traz KHR_lights_punctual, mas a função protege caso
    novas exportações tragam luzes escondidas.
  */
  const toRemove = [];

  root.traverse((child) => {
    if (child.isLight) {
      toRemove.push(child);
    }
  });

  toRemove.forEach((child) => child.parent?.remove(child));
}

function prepareSingleModelMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    materials.forEach((material) => {
      if (!material) return;

      const name = (material.name ?? '').toLowerCase();
      const isLed = name.includes('led_bar');

      /*
        Mantém apenas os materiais emissivos que são realmente luzes do studio.
        O material glass_details_mat vinha emissivo e atrapalhava a leitura do carro.
      */
      if (isLed) {
        if (material.emissive) material.emissive.setRGB(1.0, 0.9, 0.86);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 3.6;
      } else {
        if (material.emissive) material.emissive.set(0x000000);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
        if ('emissiveMap' in material) material.emissiveMap = null;
      }

      /*
        Sem luz de ambiente externa. Mantém só um reflexo mínimo para leitura de
        materiais metálicos, sem substituir as luzes do modelo.
      */
      material.envMapIntensity = material.metalness > 0.25 ? 0.025 : 0.01;

      if (name.includes('glass')) {
        material.transparent = true;
        material.opacity = Math.min(material.opacity ?? 0.58, 0.54);
        material.depthWrite = false;
      }

      material.needsUpdate = true;
    });
  });
}

function createLightsFromModelBars(root) {
  /*
    WebGL não calcula iluminação indireta real a partir de materiais emissivos.
    Então as barras emissivas do próprio GLB são usadas como referência para gerar
    luzes reais exatamente nas mesmas posições. As intensidades estão 1,5x mais fortes que na v20.
  */
  while (modelLightRig.children.length) {
    modelLightRig.remove(modelLightRig.children[0]);
  }

  const worldPosition = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const topBars = [];
  const floorBars = [];

  root.updateWorldMatrix(true, true);
  modelRoot.updateWorldMatrix(true, true);

  root.traverse((child) => {
    if (!child.name || !child.name.toLowerCase().includes('led_light_cylinder')) return;

    child.getWorldPosition(worldPosition);
    localPosition.copy(worldPosition);
    modelRoot.worldToLocal(localPosition);

    if (localPosition.y > 2.2) {
      topBars.push(localPosition.clone());
    } else {
      floorBars.push(localPosition.clone());
    }
  });

  floorBars.forEach((position) => {
    const light = new THREE.PointLight(0xfff0e3, 1.725, 3.4, 2.15);
    light.position.set(position.x, position.y + 0.18, position.z);
    modelLightRig.add(light);
  });

  topBars.forEach((position, index) => {
    if (index % 2 !== 0) return;

    const target = new THREE.Object3D();
    target.position.set(0, 0.68, 0);
    modelLightRig.add(target);

    const light = new THREE.SpotLight(
      0xfff2e8,
      3.9,
      9.5,
      THREE.MathUtils.degToRad(36),
      0.78,
      2.0
    );

    light.position.copy(position);
    light.target = target;
    modelLightRig.add(light);
  });

  /*
    Núcleo muito leve, derivado do rig do modelo, apenas para evitar que o carro
    desapareça completamente entre as barras de luz. Mantido dentro do modelLightRig.
  */
  const softCore = new THREE.PointLight(0xffffff, 0.42, 5.2, 2.25);
  softCore.position.set(0, 1.1, 0);
  modelLightRig.add(softCore);
}

function getScrollProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  return THREE.MathUtils.clamp(window.scrollY / scrollable, 0, 1);
}

function interpolateKeyframes(progress) {
  const frames = config.keyframes;
  let start = frames[0];
  let end = frames[frames.length - 1];

  for (let i = 0; i < frames.length - 1; i++) {
    if (progress >= frames[i].progress && progress <= frames[i + 1].progress) {
      start = frames[i];
      end = frames[i + 1];
      break;
    }
  }

  const span = Math.max(end.progress - start.progress, 0.0001);
  const localT = THREE.MathUtils.clamp((progress - start.progress) / span, 0, 1);
  const easedT = localT * localT * (3 - 2 * localT);

  const position = new THREE.Vector3().fromArray(start.position).lerp(new THREE.Vector3().fromArray(end.position), easedT);
  const target = new THREE.Vector3().fromArray(start.target).lerp(new THREE.Vector3().fromArray(end.target), easedT);
  const focus = THREE.MathUtils.lerp(start.lensFocus ?? 8, end.lensFocus ?? 8, easedT);
  const rotationY = THREE.MathUtils.lerp(start.modelRotationY ?? modelBaseRotationY, end.modelRotationY ?? modelBaseRotationY, easedT);
  const fov = THREE.MathUtils.lerp(start.fov ?? config.camera.fov, end.fov ?? config.camera.fov, easedT);

  return { position, target, focus, rotationY, fov };
}

function updateSceneFromScroll(delta) {
  desiredScroll = getScrollProgress();
  smoothScroll = THREE.MathUtils.damp(smoothScroll, desiredScroll, 4.0, delta);

  const frame = interpolateKeyframes(smoothScroll);
  cameraRig.desiredPosition.copy(frame.position);
  cameraRig.desiredTarget.copy(frame.target);

  smoothPointer.lerp(pointer, 0.035);
  const handheldX = smoothPointer.x * 0.045;
  const handheldY = smoothPointer.y * 0.03;

  cameraRig.currentPosition.lerp(cameraRig.desiredPosition, config.camera.smoothness ?? 0.07);
  cameraRig.currentTarget.lerp(cameraRig.desiredTarget, config.camera.smoothness ?? 0.07);

  camera.position.copy(cameraRig.currentPosition);
  camera.position.x += handheldX;
  camera.position.y += handheldY;

  cameraRig.lookTarget.copy(cameraRig.currentTarget);
  cameraRig.lookTarget.x += handheldX * 0.08;
  cameraRig.lookTarget.y += handheldY * 0.08;
  camera.lookAt(cameraRig.lookTarget);

  /*
    Mantém a mesma lógica de movimento do cameraPath:
    os ângulos da câmera continuam iguais em relação ao carro.
  */
  modelRoot.rotation.y = THREE.MathUtils.damp(modelRoot.rotation.y, frame.rotationY, 2.6, delta);

  camera.fov = THREE.MathUtils.damp(camera.fov, frame.fov ?? config.camera.fov, 3.0, delta);
  camera.updateProjectionMatrix();

  if (bokehPass) {
    bokehPass.uniforms.focus.value = THREE.MathUtils.damp(
      bokehPass.uniforms.focus.value,
      frame.focus,
      1.8,
      delta
    );
  }

  progressBar.style.width = `${desiredScroll * 100}%`;
}

function createComposer() {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.008,
    0.10,
    1.05
  );
  composer.addPass(bloom);

  /*
    Profundidade de campo inspirada em f/1.2.
  */
  bokehPass = new BokehPass(scene, camera, {
    focus: 9,
    aperture: 0.00012,
    maxblur: 0.0026
  });
  composer.addPass(bokehPass);

  composer.addPass(new OutputPass());
  return composer;
}

function loadGltf(path, label) {
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      resolve,
      (event) => {
        if (!event.total) {
          loaderScreen.querySelector('p').textContent = label;
          return;
        }

        const percent = Math.round((event.loaded / event.total) * 100);
        loaderScreen.querySelector('p').textContent = `${label} — ${percent}%`;
      },
      reject
    );
  });
}

async function loadSingleScene() {
  try {
    const gltf = await loadGltf(MODEL_PATH, 'Carregando cena 3D');
    const singleScene = gltf.scene;

    removeExternalLights(singleScene);
    prepareSingleModelMaterials(singleScene);

    modelRoot.add(singleScene);
    modelRoot.rotation.y = modelBaseRotationY;

    createLightsFromModelBars(singleScene);

    loaderScreen.classList.add('is-hidden');
  } catch (error) {
    console.error('Erro ao carregar cena única:', error);
    loaderScreen.classList.add('has-error');
    loaderScreen.querySelector('p').innerHTML = `
      Erro ao carregar a cena 3D.<br><br>
      Caminho testado:<br>
      <code>${MODEL_PATH}</code><br><br>
      Confira se o arquivo está em <code>assets/mclaren.glb</code> e se o GitHub Pages já terminou o deploy.
    `;
  }
}

const composer = createComposer();
const firstFrame = interpolateKeyframes(0);
cameraRig.currentPosition.copy(firstFrame.position);
cameraRig.currentTarget.copy(firstFrame.target);
camera.position.copy(firstFrame.position);
camera.lookAt(firstFrame.target);

loadSingleScene();

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
  pointer.y = -(event.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
});

function animate() {
  const delta = Math.min(clock.getDelta(), 0.033);
  updateSceneFromScroll(delta);
  composer.render();
  requestAnimationFrame(animate);
}

animate();

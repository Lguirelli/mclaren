import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#webgl');
const loaderScreen = document.querySelector('#loader');
const progressBar = document.querySelector('.scroll-progress span');

const MODEL_PATH = './assets/mclaren-mp4-5.glb';
const STUDIO_PATH = './assets/studio.glb'; // versão otimizada

const config = await fetch('./config/cameraPath.json').then((response) => response.json());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x020202, 0.0075);
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

const rootGroup = new THREE.Group();
const studioGroup = new THREE.Group();
const modelGroup = new THREE.Group();

let modelBaseRotationY = config.model.rotationY ?? 0;
let desiredScroll = 0;
let smoothScroll = 0;
let bokehPass;

scene.add(rootGroup);
rootGroup.add(studioGroup);
rootGroup.add(modelGroup);

/*
  Análise visual aplicada:
  - o retângulo de luzes no chão do studio.glb ocupa aproximadamente:
    x: -8.91 até 17.85
    z: -7.13 até 6.83
  - centro aproximado: x 4.47, z -0.15
  - altura das barras de luz do chão: y -1.042

  Em vez de mover o carro para esse centro, o estúdio é recentrado
  para que o retângulo de luzes fique ao redor da origem.
  Assim o carro pode permanecer em (0, 0, 0) e encaixa visualmente
  dentro da moldura luminosa do chão.
*/
const STUDIO_CENTER = new THREE.Vector3(4.4699, -1.0423, -0.1495);

function stripHelpers(root) {
  const toRemove = [];
  root.traverse((child) => {
    if (child.isLight || child.isCamera) {
      toRemove.push(child);
    }
  });
  toRemove.forEach((child) => child.parent?.remove(child));
}

function fitModelToScene(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = 5.7 / maxAxis;

  root.position.sub(center);
  root.scale.setScalar(scale);

  const fittedBox = new THREE.Box3().setFromObject(root);
  root.position.y -= fittedBox.min.y - (config.model.floorOffset ?? 0);
}

function selectPrimaryModel(root) {
  const named = root.getObjectByName('McLaren mp4.5');
  const model = (named ?? root).clone(true);
  stripHelpers(model);
  return model;
}

function improveCarMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;

      /*
        Desliga todas as emissões do carro e elimina a "auto-iluminação".
      */
      if (material.emissive) material.emissive.set(0x000000);
      if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
      if ('emissiveMap' in material) material.emissiveMap = null;

      /*
        Reduz bastante a influência de ambiente/reflexo para que
        o carro responda principalmente ao cenário do studio.
      */
      material.envMapIntensity = material.metalness > 0.25 ? 0.04 : 0.02;

      if (material.name && material.name.toLowerCase().includes('glass')) {
        material.transparent = true;
        material.opacity = Math.min(material.opacity ?? 0.62, 0.56);
        material.depthWrite = false;
      }

      material.needsUpdate = true;
    });
  });
}

function prepareStudioMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;

      /*
        O studio vira o cenário e a fonte de luz.
        Mantém o material emissivo das barras de LED do próprio studio
        e remove reflexos desnecessários do restante.
      */
      if (material.name && material.name.toLowerCase().includes('led_bar')) {
        if (material.emissive) material.emissive.setRGB(1.0, 0.9, 0.9);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 2.4;
      } else {
        if ('envMapIntensity' in material) material.envMapIntensity = 0;
      }

      material.needsUpdate = true;
    });
  });
}

function createStageLightsFromStudio(stageRoot) {
  const tempPosition = new THREE.Vector3();
  const tempQuaternion = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const targetPosition = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, -1);

  /*
    Desliga qualquer luz atual do código.
    A partir daqui, a luz vem apenas do studio.glb:
    - ponto exportado no arquivo
    - nós Area.* convertidos em luzes reais
    - barras emissivas do próprio cenário
  */

  stageRoot.traverse((child) => {
    if (child.isLight) {
      // Se houver luz punctual exportada pelo GLB, ajusta em vez de somar luz demais.
      child.intensity = child.type === 'PointLight' ? 65 : child.intensity;
      child.decay = 1.6;
      child.distance = 28;
      child.color?.set(0xffffff);
    }
  });

  const areaNodes = [];
  stageRoot.traverse((child) => {
    if (child.name && child.name.startsWith('Area.')) {
      areaNodes.push(child);
    }
  });

  areaNodes.forEach((node) => {
    node.updateWorldMatrix(true, false);
    node.matrixWorld.decompose(tempPosition, tempQuaternion, tempScale);

    const direction = forward.clone().applyQuaternion(tempQuaternion).normalize();
    targetPosition.copy(tempPosition).add(direction.multiplyScalar(6));

    // Intensidade diferenciada por altura para manter leitura cinematográfica
    let intensity = 16;
    let angle = THREE.MathUtils.degToRad(34);
    let penumbra = 0.62;

    if (tempPosition.y > 7) {
      intensity = 24;
      angle = THREE.MathUtils.degToRad(28);
      penumbra = 0.52;
    } else if (tempPosition.y > 3) {
      intensity = 18;
      angle = THREE.MathUtils.degToRad(32);
      penumbra = 0.56;
    } else {
      intensity = 7;
      angle = THREE.MathUtils.degToRad(42);
      penumbra = 0.72;
    }

    const light = new THREE.SpotLight(0xffffff, intensity, 30, angle, penumbra, 1.35);
    light.position.copy(tempPosition);
    light.target.position.copy(targetPosition);
    scene.add(light);
    scene.add(light.target);
  });
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

  modelGroup.rotation.y = THREE.MathUtils.damp(modelGroup.rotation.y, frame.rotationY, 2.6, delta);

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
    0.01,
    0.14,
    1.0
  );
  composer.addPass(bloom);

  /*
    Simulação de lente mais cinematográfica, com profundidade de campo equivalente
    a uma abertura bem rasa, inspirada em f/1.2.
  */
  const DOF_FSTOP = 1.2;

  bokehPass = new BokehPass(scene, camera, {
    focus: 9,
    aperture: 0.00012,
    maxblur: 0.0026
  });
  composer.addPass(bokehPass);

  composer.addPass(new OutputPass());
  return composer;
}

function loadGltf(path, onProgressLabel) {
  const gltfLoader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      resolve,
      (event) => {
        if (!event.total) {
          loaderScreen.querySelector('p').textContent = onProgressLabel;
          return;
        }
        const percent = Math.round((event.loaded / event.total) * 100);
        loaderScreen.querySelector('p').textContent = `${onProgressLabel} — ${percent}%`;
      },
      reject
    );
  });
}

async function loadStudio() {
  const gltf = await loadGltf(STUDIO_PATH, 'Carregando cenário do estúdio');
  const stage = gltf.scene;

  prepareStudioMaterials(stage);

  // Recentrar o estúdio para que o retângulo de luzes do chão envolva o carro.
  stage.position.set(-STUDIO_CENTER.x, -STUDIO_CENTER.y, -STUDIO_CENTER.z);

  studioGroup.add(stage);
  createStageLightsFromStudio(stage);
}

async function loadCar() {
  const gltf = await loadGltf(MODEL_PATH, 'Carregando modelo 3D');
  const car = selectPrimaryModel(gltf.scene);

  improveCarMaterials(car);
  fitModelToScene(car);

  // Pequeno lift para o carro “sentar” visualmente dentro do retângulo do chão.
  car.position.y += 0.02;

  modelGroup.add(car);
  modelGroup.rotation.y = modelBaseRotationY;
}

async function bootstrap() {
  try {
    await loadStudio();
    await loadCar();
    loaderScreen.classList.add('is-hidden');
  } catch (error) {
    console.error('Erro ao carregar cena:', error);
    loaderScreen.classList.add('has-error');
    loaderScreen.querySelector('p').innerHTML = `
      Erro ao carregar a cena 3D.<br><br>
      Caminhos testados:<br>
      <code>${STUDIO_PATH}</code><br>
      <code>${MODEL_PATH}</code><br><br>
      Confira se os arquivos estão em <code>assets/</code> e se o GitHub Pages já terminou o deploy.
    `;
  }
}

const composer = createComposer();
const firstFrame = interpolateKeyframes(0);
cameraRig.currentPosition.copy(firstFrame.position);
cameraRig.currentTarget.copy(firstFrame.target);
camera.position.copy(firstFrame.position);
camera.lookAt(firstFrame.target);

bootstrap();

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

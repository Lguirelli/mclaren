import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#webgl');
const loaderScreen = document.querySelector('#loader');
const progressBar = document.querySelector('.scroll-progress span');

const MODEL_PATH = './assets/mclaren-mp4-5.glb';
const config = await fetch('./config/cameraPath.json').then((response) => response.json());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030303);
scene.fog = new THREE.FogExp2(0x030303, 0.0085);

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
renderer.toneMappingExposure = 0.46;
renderer.shadowMap.enabled = false;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.018).texture;

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
let modelGroup = new THREE.Group();
let modelBaseRotationY = config.model.rotationY ?? 0;
let desiredScroll = 0;
let smoothScroll = 0;
let bokehPass;

scene.add(modelGroup);

function addLighting() {
  /*
    Iluminação cinematográfica de 3 pontos pensada para o enquadramento inicial:
    câmera em frente 3/4 baixa, olhando para o lado dianteiro do carro.
    1) Key light: quente, vinda da frente superior esquerda do quadro.
    2) Fill light: fria e suave, do lado oposto, para abrir sombras sem achatar.
    3) Rim light: atrás do carro, para desenhar contorno no airbox, asa e pneus.
  */

  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0.55, 0.84, 0.18);
  scene.add(keyTarget);

  const fillTarget = new THREE.Object3D();
  fillTarget.position.set(0.1, 0.72, 0.05);
  scene.add(fillTarget);

  const rimTarget = new THREE.Object3D();
  rimTarget.position.set(-0.45, 0.86, -0.18);
  scene.add(rimTarget);

  const key = new THREE.SpotLight(
    0xfff0de,
    2.15,
    0,
    THREE.MathUtils.degToRad(30),
    0.42,
    1.1
  );
  key.position.set(6.4, 4.8, 7.2);
  key.target = keyTarget;
  scene.add(key);

  const fill = new THREE.SpotLight(
    0xd8e7ff,
    0.62,
    0,
    THREE.MathUtils.degToRad(38),
    0.5,
    1.15
  );
  fill.position.set(-1.2, 2.2, 6.8);
  fill.target = fillTarget;
  scene.add(fill);

  const rim = new THREE.SpotLight(
    0xffffff,
    1.28,
    0,
    THREE.MathUtils.degToRad(28),
    0.36,
    1.0
  );
  rim.position.set(-7.6, 3.5, -6.6);
  rim.target = rimTarget;
  scene.add(rim);
}

function addStage() {
  const backdrop = new THREE.SphereGeometry(70, 48, 24);
  const backdropMaterial = new THREE.MeshBasicMaterial({
    color: 0x020202,
    side: THREE.BackSide
  });
  scene.add(new THREE.Mesh(backdrop, backdropMaterial));
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

function stripHelpers(root) {
  const toRemove = [];
  root.traverse((child) => {
    if (child.isLight || child.isCamera) toRemove.push(child);
  });
  toRemove.forEach((child) => child.parent?.remove(child));
}

function selectPrimaryModel(root) {
  const named = root.getObjectByName('McLaren mp4.5');
  const model = (named ?? root).clone(true);
  stripHelpers(model);
  return model;
}

function improveMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      material.envMapIntensity = material.metalness > 0.25 ? 0.16 : 0.1;
      material.needsUpdate = true;
    });
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
    bokehPass.uniforms.focus.value = THREE.MathUtils.damp(bokehPass.uniforms.focus.value, frame.focus, 1.8, delta);
  }

  progressBar.style.width = `${desiredScroll * 100}%`;
}

function createComposer() {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.005,
    0.10,
    1.0
  );
  composer.addPass(bloom);

  bokehPass = new BokehPass(scene, camera, {
    focus: 9,
    aperture: 0.000024,
    maxblur: 0.0014
  });
  composer.addPass(bokehPass);

  composer.addPass(new OutputPass());
  return composer;
}

function loadGltf(path) {
  const gltfLoader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      resolve,
      (event) => {
        if (!event.total) {
          loaderScreen.querySelector('p').textContent = 'Carregando modelo 3D';
          return;
        }
        const percent = Math.round((event.loaded / event.total) * 100);
        loaderScreen.querySelector('p').textContent = `Carregando modelo 3D — ${percent}%`;
      },
      reject
    );
  });
}

async function loadCarModel() {
  try {
    const gltf = await loadGltf(MODEL_PATH);
    const car = selectPrimaryModel(gltf.scene);

    improveMaterials(car);
    fitModelToScene(car);
    modelGroup.add(car);
    modelGroup.rotation.y = modelBaseRotationY;
    loaderScreen.classList.add('is-hidden');
  } catch (error) {
    console.error('Erro ao carregar GLB:', error);
    loaderScreen.classList.add('has-error');
    loaderScreen.querySelector('p').innerHTML = `
      Erro ao carregar o modelo 3D.<br><br>
      Caminho testado:<br>
      <code>${MODEL_PATH}</code><br><br>
      Confira se o arquivo está em <code>assets/mclaren-mp4-5.glb</code> e se o GitHub Pages já terminou o deploy.
    `;
  }
}

addLighting();
addStage();

const composer = createComposer();
const firstFrame = interpolateKeyframes(0);
cameraRig.currentPosition.copy(firstFrame.position);
cameraRig.currentTarget.copy(firstFrame.target);
camera.position.copy(firstFrame.position);
camera.lookAt(firstFrame.target);

loadCarModel();

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

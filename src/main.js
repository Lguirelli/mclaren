import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createPracticalLighting } from './practicalLighting.js';
import { advanceCameraProgress } from './cameraMotion.js';
import { prepareMaterial } from './materials.js';
import { isolateCar, createShadowCatcher } from './scenery.js';
import { createPostProcessing } from './postprocessing.js';

const $ = (selector) => document.querySelector(selector);
const chapters = [...document.querySelectorAll('.chapter')];
const links = [...document.querySelectorAll('.chapter-nav a')];
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
let ready = false;
let scene, camera, renderer, post;
let positions, targets, config, intro = 0, scrollValue = 0, activeChapter = -1;
let frameId = 0, lastTime = 0, slowTime = 0, qualityDropped = false;
let anchors = [];
const pointer = new THREE.Vector2(), smoothPointer = new THREE.Vector2();
const target = new THREE.Vector3(), desired = new THREE.Vector3(), direction = new THREE.Vector3();
let mobile = innerWidth <= 700;
const clamp = THREE.MathUtils.clamp;

function applyMotion() {
  document.body.classList.toggle('motion-enabled', !reduced);
  document.body.classList.toggle('reduced-motion', reduced);
  document.documentElement.style.scrollBehavior = reduced ? 'auto' : 'smooth';
  $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
  $('#motion-toggle').textContent = reduced ? 'Ativar movimento' : 'Reduzir movimento';
  if (post) post.setQuality({mobile,reduced,low:qualityDropped});
  if (reduced) intro = 4;
  requestFrame();
}
$('#motion-toggle').addEventListener('click', () => { reduced = !reduced; applyMotion(); });
motionQuery.addEventListener('change', () => { reduced = motionQuery.matches; applyMotion(); });
chapters.forEach(chapter => chapter.querySelectorAll('.reveal').forEach((el,i) => el.style.setProperty('--delay', `${i * 140}ms`)));
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
    else if (entry.boundingClientRect.top > innerHeight) entry.target.classList.remove('is-visible');
  });
}, { threshold: .12 });
function revealStory() { chapters.forEach(chapter => observer.observe(chapter.querySelector('.chapter-copy'))); }
$('#skip-loading').addEventListener('click', revealStory);
applyMotion();

function measure() {
  mobile = innerWidth <= 700;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  anchors = chapters.map((section, i) => i === 0 ? 0 : Math.min(maxScroll, section.offsetTop + section.offsetHeight / 2 - innerHeight / 2));
}
function storyProgress() {
  const y = scrollY;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y <= anchors[i + 1]) return i + clamp((y - anchors[i]) / Math.max(1,anchors[i + 1] - anchors[i]), 0, 1);
  }
  return chapters.length - 1;
}
function updateEditorial() {
  const index = Math.round(storyProgress());
  if (index !== activeChapter) {
    activeChapter = index;
    links.forEach((link,i) => i === index ? link.setAttribute('aria-current','step') : link.removeAttribute('aria-current'));
    $('#chapter-label').textContent = `${String(index + 1).padStart(2,'0')} — ${chapters[index].dataset.chapter}`;
  }
  const p = clamp(scrollY / Math.max(1,document.documentElement.scrollHeight - innerHeight),0,1);
  $('.scroll-progress span').style.transform = `scaleX(${p})`;
}
measure(); updateEditorial();
document.fonts.ready.then(() => { measure(); requestFrame(); });

async function loadModel() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./assets/mclaren.glb', event => {
    const p = event.total ? Math.round(event.loaded / event.total * 100) : 0;
    $('#loader p').textContent = p ? `Carregando a cena · ${p}%` : 'Carregando a cena';
    $('.loader-track span').style.width = `${Math.max(5,p)}%`;
  });
  const root = gltf.scene;
  root.rotation.y = config.model.rotationY;
  const car = isolateCar(root);
  car.traverse(object => {
    if (!object.isMesh) return;
    object.frustumCulled = true;
    const wasArray = Array.isArray(object.material);
    const materials = wasArray ? object.material : [object.material];
    object.material = materials.map(original => {
      const { material, isCar } = prepareMaterial(original, renderer);
      const name = material.name.toLowerCase();
      object.castShadow = isCar && !name.includes('glass');
      object.receiveShadow = isCar;
      return material;
    });
    if (!wasArray) object.material = object.material[0];
  });
  scene.add(car, createShadowCatcher(car));
}

function resize() {
  measure();
  if (!renderer) return;
  const ratio = Math.min(devicePixelRatio,mobile || qualityDropped ? 1 : 1.5);
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth,innerHeight);
  
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  post?.setQuality({mobile,reduced,low:qualityDropped});
  updateEditorial(); requestFrame();
}
function requestFrame() { if (ready && !document.hidden && !frameId) frameId = requestAnimationFrame(render); }
function render(now) {
  frameId = 0;
  const rawDt = lastTime ? (now - lastTime) / 1000 : 1/60;
  const dt = Math.min(rawDt,.05); lastTime = now;
  const wanted = storyProgress();
  scrollValue = advanceCameraProgress(scrollValue, wanted, dt);
  const u = clamp(scrollValue / (chapters.length - 1),0,1);
  positions.getPoint(u,desired); targets.getPoint(u,target);
  const a = Math.floor(scrollValue), b = Math.min(a+1,config.keyframes.length-1), t = scrollValue-a;
  let fov = THREE.MathUtils.lerp(config.keyframes[a].fov,config.keyframes[b].fov,t);
  if (mobile) {
    direction.copy(desired).sub(target).multiplyScalar(1.42);
    desired.copy(target).add(direction); fov = 43;
  }
  intro += dt;
  const reveal = reduced ? 1 : THREE.MathUtils.smoothstep(intro,.3,2.8);
  if (!reduced) {
    smoothPointer.lerp(pointer,1-Math.exp(-3*dt));
    desired.x += smoothPointer.x * .045; desired.y += smoothPointer.y * .025;
    // Initial dolly only; no perpetual camera shaking while reading.
    direction.copy(desired).sub(target).multiplyScalar((1-reveal)*.035);
    desired.add(direction);
  }
  camera.position.copy(desired); camera.fov = fov;
  camera.lookAt(target);
  // Shift subject away from copy; portrait leaves the lower screen for the story.
  const side = Math.cos(scrollValue*Math.PI);
  document.body.style.setProperty('--copy-side', String((1-side)/2));
  camera.setViewOffset(innerWidth,innerHeight,mobile ? 0 : -innerWidth*.15*side,mobile ? innerHeight*.19 : 0,innerWidth,innerHeight);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  direction.copy(target).applyMatrix4(camera.matrixWorldInverse);
  post.focus.value = Math.max(.1,-direction.z);
  renderer.toneMappingExposure = .85;
  post.render();
  if (!qualityDropped && intro > 4 && rawDt > .038 && rawDt < .3) slowTime += rawDt;
  else slowTime = Math.max(0,slowTime-dt*.5);
  if (slowTime > 3) { qualityDropped = true; resize(); }
  const cameraMoving = Math.abs(scrollValue-wanted) > .0001;
  const effectsMoving = !reduced && (intro < 4 || smoothPointer.distanceTo(pointer) > .001);
  if (cameraMoving || effectsMoving) requestFrame();
}
window.addEventListener('scroll',()=>{updateEditorial(); requestFrame();},{passive:true});
window.addEventListener('pointermove',event=>{if(mobile || reduced)return;pointer.set((event.clientX/innerWidth-.5)*2,-(event.clientY/innerHeight-.5)*2);requestFrame();},{passive:true});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){cancelAnimationFrame(frameId);frameId=0;}else requestFrame();});

async function init() {
  try {
    const response = await fetch('./config/cameraPath.json');
    if (!response.ok) throw new Error('Camera configuration unavailable');
    config = await response.json();
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x08090b);
    scene.fog = new THREE.FogExp2(0x08090b,.018);
    renderer = new THREE.WebGPURenderer({canvas:$('#webgl'),antialias:true,alpha:false,
      forceWebGL:new URLSearchParams(location.search).get('renderer') === 'webgl'});
    await renderer.init();
    document.documentElement.dataset.renderer = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    renderer.onDeviceLost = () => {
      ready = false; cancelAnimationFrame(frameId); frameId = 0;
      document.body.classList.remove('motion-enabled');
      revealStory();
      console.warn('A cena foi pausada porque o dispositivo gráfico ficou indisponível. Recarregue a página para retomar.');
    };
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = .85;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

    camera = new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,150);
    positions = new THREE.CatmullRomCurve3(config.keyframes.map(f=>new THREE.Vector3(...f.position)),false,'centripetal');
    targets = new THREE.CatmullRomCurve3(config.keyframes.map(f=>new THREE.Vector3(...f.target)),false,'centripetal');
    post = createPostProcessing(renderer,scene,camera);
    resize();
    await loadModel();
    await createPracticalLighting(scene, renderer, new GLTFLoader(), mobile);
    $('#loader p').textContent = 'Preparando materiais e iluminação';
    scrollValue = storyProgress();
    positions.getPoint(scrollValue / (chapters.length - 1),camera.position);
    targets.getPoint(scrollValue / (chapters.length - 1),target);
    camera.lookAt(target);
    await renderer.compileAsync(scene,camera);
    ready = true; intro = reduced ? 4 : 0;
    render(performance.now());
    $('#loader').classList.add('is-hidden'); revealStory();
    $('#webgl').addEventListener('webglcontextlost',event=>{event.preventDefault();ready=false;cancelAnimationFrame(frameId);frameId=0;document.body.classList.remove('motion-enabled');});
    $('#webgl').addEventListener('webglcontextrestored',()=>location.reload());
  } catch(error) {
    console.error('Scene initialization failed:',error);
    $('#loader p').textContent='A cena 3D não pôde ser carregada. A história continua disponível.';
    $('#skip-loading').textContent='Continuar para a história';
    document.body.classList.remove('motion-enabled'); revealStory();
  }
}
init();

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { advanceCameraProgress } from './cameraMotion.js';

const $ = (selector) => document.querySelector(selector);
const chapters = [...document.querySelectorAll('.chapter')];
const links = [...document.querySelectorAll('.chapter-nav a')];
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
let ready = false;
let scene, camera, renderer, composer, bokeh, bloom, keyLight, rimLight, sweepLight;
let positions, targets, config, intro = 0, scrollValue = 0, activeChapter = -1;
let frameId = 0, lastTime = 0, slowTime = 0, qualityDropped = false;
let anchors = [], ledMaterials = [];
const pointer = new THREE.Vector2(), smoothPointer = new THREE.Vector2();
const target = new THREE.Vector3(), desired = new THREE.Vector3(), direction = new THREE.Vector3();
const lightTarget = new THREE.Vector3(0,.65,0);
let mobile = innerWidth <= 700;
const clamp = THREE.MathUtils.clamp;

function applyMotion() {
  document.body.classList.toggle('motion-enabled', !reduced);
  document.body.classList.toggle('reduced-motion', reduced);
  document.documentElement.style.scrollBehavior = reduced ? 'auto' : 'smooth';
  $('#motion-toggle').setAttribute('aria-pressed', String(reduced));
  $('#motion-toggle').textContent = reduced ? 'Ativar movimento' : 'Reduzir movimento';
  if (bokeh) bokeh.enabled = !mobile && !reduced && !qualityDropped;
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

function createEnvironment() {
  // Static softboxes generate reflections without adding visible geometry to the set.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x090b10);
  const card = (position, size, color, intensity) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    mesh.material.color.multiplyScalar(intensity);
    mesh.position.set(...position); mesh.lookAt(0,0,0); studio.add(mesh);
  };
  card([-4,6,2],[3,8],0xfff5ec,2);
  card([5,3,-3],[2,7],0xe5ebf2,.65);
  card([0,7,0],[5,2],0xffffff,.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(studio,.06,.1,50);
  scene.environment = map.texture;
  studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();
}
function createLighting() {
  RectAreaLightUniformsLib.init();
  scene.add(new THREE.HemisphereLight(0xe3e7ed,0x111016,.08));
  keyLight = new THREE.RectAreaLight(0xfff5ec,2,4,7);
  keyLight.position.set(-3.5,5,2); keyLight.lookAt(lightTarget); scene.add(keyLight);
  rimLight = new THREE.RectAreaLight(0xe5ebf2,.65,2,6);
  rimLight.position.set(3.5,3,-3); rimLight.lookAt(lightTarget); scene.add(rimLight);
  sweepLight = new THREE.RectAreaLight(0xfff8ef,.25,1.1,5);
  sweepLight.position.set(1,4,2); sweepLight.lookAt(lightTarget); scene.add(sweepLight);
  const shadowLight = new THREE.SpotLight(0xfff5ec,22,24,Math.PI/4,.8,2);
  shadowLight.position.set(-3,7,4); shadowLight.target.position.set(0,0,0);
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.set(1024,1024);
  shadowLight.shadow.bias = -.00015; shadowLight.shadow.normalBias = .025;
  shadowLight.shadow.camera.near = .5; shadowLight.shadow.camera.far = 22;
  scene.add(shadowLight, shadowLight.target);
}
async function loadModel() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('./assets/mclaren.glb', event => {
    const p = event.total ? Math.round(event.loaded / event.total * 100) : 0;
    $('#loader p').textContent = p ? `Carregando a cena · ${p}%` : 'Carregando a cena';
    $('.loader-track span').style.width = `${Math.max(5,p)}%`;
  });
  const root = gltf.scene;
  root.rotation.y = config.model.rotationY;
  const importedLights = [];
  root.traverse(object => {
    if (object.isLight) importedLights.push(object);
    if (!object.isMesh) return;
    object.frustumCulled = true;
    const wasArray = Array.isArray(object.material);
    const materials = wasArray ? object.material : [object.material];
    object.material = materials.map(original => {
      const material = original.clone();
      const name = material.name.toLowerCase();
      const isCar = /body_mat|wheels_mat|bottom_details_mat|glass_details_mat|interior_mat/.test(name);
      object.castShadow = isCar && !name.includes('glass');
      object.receiveShadow = isCar || name === 'material.004';
      material.envMapIntensity = isCar ? .3 : .12;
      if (name === 'led_bar') {
        material.emissive.set(0xffe8d4); material.emissiveIntensity = 0;
        ledMaterials.push(material);
      } else {
        material.emissive?.set(0x000000);
        material.emissiveIntensity = 0;
      }
      if (name === 'material.004') { material.roughness = .6; material.metalness = .06; }
      if (name === 'wheels_mat') {
        // Keep the original wheel maps and their rim detail, but damp the glossy response.
        material.envMapIntensity = .1;
        material.roughness = 1;
        material.metalness = .25;
      }
      if (name.includes('glass')) { material.transparent = true; material.opacity = .5; material.depthWrite = false; }
      return material;
    });
    if (!wasArray) object.material = object.material[0];
  });
  importedLights.forEach(light => light.removeFromParent());
  scene.add(root);
  // Grounding shadow: a soft baked-style contact patch supplements the single shadow map.
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 128;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64,64,12,64,64,64);
  gradient.addColorStop(0,'rgba(0,0,0,.65)'); gradient.addColorStop(.6,'rgba(0,0,0,.3)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(4.4,8.2),new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(textureCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1 }));
  patch.rotation.x = -Math.PI/2; patch.rotation.z = -config.model.rotationY; patch.position.y = -.020;
  scene.add(patch);
  renderer.shadowMap.needsUpdate = true;
}
function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  bokeh = new BokehPass(scene,camera,{focus:10,aperture:.000035,maxblur:.003});
  bokeh.enabled = !mobile && !reduced;
  composer.addPass(bokeh);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.035,.2,1.2);
  composer.addPass(bloom); composer.addPass(new OutputPass());
}
function resize() {
  measure();
  if (!renderer) return;
  const ratio = Math.min(devicePixelRatio,mobile || qualityDropped ? 1 : 1.5);
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth,innerHeight);
  composer.setPixelRatio(ratio); composer.setSize(innerWidth,innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  bokeh.enabled = !mobile && !reduced && !qualityDropped;
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
  bokeh.uniforms.focus.value = Math.max(.1,-direction.z);
  bokeh.uniforms.aperture.value = .000025 + .00002*Math.pow(Math.sin(u*Math.PI),2);
  keyLight.intensity = .8 + reveal*1.2;
  rimLight.intensity = .25 + reveal*.4;
  sweepLight.position.x = -3 + u*6;
  sweepLight.position.z = 2*Math.cos(u*Math.PI);
  sweepLight.lookAt(lightTarget);
  sweepLight.intensity = .2 + .12*Math.sin(u*Math.PI);
  ledMaterials.forEach((material,i) => { material.emissiveIntensity = reduced ? 1.1 : 1.1*THREE.MathUtils.smoothstep(intro,i*.075,.65+i*.075); });
  renderer.toneMappingExposure = .62;
  composer.render();
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
    renderer = new THREE.WebGLRenderer({canvas:$('#webgl'),antialias:true,powerPreference:'high-performance'});
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    camera = new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,150);
    positions = new THREE.CatmullRomCurve3(config.keyframes.map(f=>new THREE.Vector3(...f.position)),false,'centripetal');
    targets = new THREE.CatmullRomCurve3(config.keyframes.map(f=>new THREE.Vector3(...f.target)),false,'centripetal');
    createEnvironment(); createLighting(); setupComposer(); resize();
    await loadModel();
    scrollValue = storyProgress();
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

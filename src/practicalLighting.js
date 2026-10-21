import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export const fixtureLayout = [
  {kind:'hanging', name:'Luz superior principal', shadows:true, position:[-1.35,3.5,0], rotationY:Math.PI/2, scale:2, area:4.5, power:22, emission:1, reflection:1.3},
  {kind:'hanging', name:'Luz superior de preenchimento', position:[1.45,3.8,-.6], rotationY:Math.PI/2, scale:2, area:2.5, power:12, emission:.65, reflection:.7},
  {kind:'industrial', name:'Refletores laterais direitos', shadows:true, position:[2.9,-.0621,-2.7], scale:1.5, power:6, emission:.65, reflection:.6},
  {kind:'industrial', name:'Refletores dianteiros esquerdos', position:[-3.3,-.0621,2.8], scale:1.5, power:5, emission:.55, reflection:.5},
  {kind:'industrial', name:'Refletores traseiros esquerdos', position:[-3.2,-.0621,-3], scale:1.5, power:3, emission:.4, reflection:.3}
];

// Actual emitting face centers and normals measured from the imported geometry.
const faces = [
  {center:[-.275325,1.051729,.376241],normal:[-.444386,-.19384,.874612]},
  {center:[.045721,1.051301,.510397],normal:[-.323947,-.166213,.93136]}
];

export function assemblePracticalLighting(scene, renderer, templates, mobile) {
  RectAreaLightUniformsLib.init();
  const sources = [];
  const shadowSettings = (light, size, far) => {
    light.castShadow = true;
    light.shadow.mapSize.setScalar(size);
    light.shadow.camera.near = .05; light.shadow.camera.far = far;
    light.shadow.bias = -.00015; light.shadow.normalBias = .012;
    light.shadow.autoUpdate = false; light.shadow.needsUpdate = true;
  };
  for (const layout of fixtureLayout) {
    // Instances reuse geometry and textures; emission is calibrated per fixture.
    const model = templates[layout.kind].clone(true);
    model.name = layout.name;
    model.position.set(...layout.position);
    model.rotation.y = layout.rotationY ?? Math.atan2(-layout.position[0],-layout.position[2]) + .405;
    model.scale.setScalar(layout.scale);
    const materials = new Map();
    model.traverse(object => {
      if (!object.isMesh) return;
      const convert = original => {
        if (materials.has(original)) return materials.get(original);
        const material = original.clone();
        if (!material) throw new Error('Unsupported fixture material: '+original.name);
        material.envMapIntensity = .25;
        material.emissiveIntensity *= layout.emission;
        materials.set(original,material);
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      object.castShadow = true; object.receiveShadow = true;
    });
    scene.add(model); model.updateWorldMatrix(true,true);
    if (layout.kind === 'hanging') {
      const position = model.localToWorld(new THREE.Vector3(0,-.025,0));
      const target = position.clone().add(new THREE.Vector3(0,-1,0));
      const key = new THREE.RectAreaLight(0xf1f4ff,layout.area,.34,2.9);
      key.position.copy(position); key.lookAt(target); scene.add(key);
      const light = new THREE.SpotLight(0xf1f4ff,layout.power,16,Math.PI/2.9,1,2);
      light.position.copy(position); light.target.position.copy(target);
      if (layout.shadows) shadowSettings(light,mobile ? 512 : 1024,16);
      scene.add(light,light.target);
      sources.push({position,target,width:.34,height:2.9,color:0xf1f4ff,intensity:layout.reflection});
    } else {
      for (const face of faces) {
        const normal = new THREE.Vector3(...face.normal).transformDirection(model.matrixWorld);
        const position = model.localToWorld(new THREE.Vector3(...face.center)).addScaledVector(normal,.025);
        const target = position.clone().add(normal);
        const light = new THREE.SpotLight(0xffe4c4,layout.power,12,Math.PI/3.5,.85,2);
        light.position.copy(position); light.target.position.copy(target);
        // Side lights remain unshadowed to keep one shadow map.
        scene.add(light,light.target);
        sources.push({position,target,width:.24,height:.12,color:0xffe4c4,intensity:layout.reflection});
      }
    }
  }
  return sources;
}

export async function createPracticalLighting(scene, renderer, loader, mobile, onProgress = () => {}) {
  const load = async key => {
    const result = await loader.loadAsync(`./assets/${key}.glb`,event=>onProgress(key,event));
    onProgress(key,{complete:true});
    return result;
  };
  const [hanging,industrial] = await Promise.all([load('hanging-light'),load('industrial-light')]);
  const sources = assemblePracticalLighting(scene,renderer,{hanging:hanging.scene,industrial:industrial.scene},mobile);
  // The environment contains only cards matching the installed lamps, plus weak room bounce.
  const environment = new THREE.Scene(); environment.background = new THREE.Color(0x101116);
  for (const source of sources) {
    const material = new THREE.MeshBasicMaterial({color:source.color,side:THREE.DoubleSide});
    material.color.multiplyScalar(source.intensity);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(source.width,source.height),material);
    card.position.copy(source.position); card.lookAt(source.target); environment.add(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(environment,.06,.1,50);
  scene.environment = map.texture;
  environment.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); pmrem.dispose();
  // Update the static shadow maps once after all fixtures and the car are present.
  scene.traverse(o=>{if(o.isLight && o.castShadow){o.shadow.autoUpdate=false;o.shadow.needsUpdate=true;}});
}

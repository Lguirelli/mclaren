import * as THREE from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';

export const fixtureLayout = {
  hanging: { position: [-1.35, 3.5, 0], rotationY: Math.PI / 2, scale: 2 },
  industrial: { position: [2.9, -.0621, -2.7], rotationY: -.44, scale: 1.5 }
};

export async function createPracticalLighting(scene, renderer, loader, mobile) {
  THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
  const sources = [];
  const load = async kind => {
    const {scene: model} = await loader.loadAsync(`./assets/${kind}-light.glb`);
    const layout = fixtureLayout[kind];
    model.name = `${kind} fixture`;
    model.position.set(...layout.position); model.rotation.y = layout.rotationY; model.scale.setScalar(layout.scale);
    model.traverse(object => {
      if (!object.isMesh) return;
      const convert = original => {
        const material = renderer.library.fromMaterial(original);
        if (!material) throw new Error(`Unsupported fixture material: ${original.name}`);
        material.envMapIntensity = .25;
        return material;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      object.castShadow = true; object.receiveShadow = true;
    });
    scene.add(model); model.updateWorldMatrix(true, true);
    return model;
  };
  // Actual emitting face centers and normals measured from the imported geometry.
  const hanging = await load('hanging');
  const topPosition = hanging.localToWorld(new THREE.Vector3(0, -.025, 0));
  const topTarget = topPosition.clone().add(new THREE.Vector3(0,-1,0));
  const key = new THREE.RectAreaLight(0xf1f4ff, 7, .34, 2.9);
  key.position.copy(topPosition); key.lookAt(topTarget); scene.add(key);
  sources.push({position:topPosition,target:topTarget,width:.34,height:2.9,color:0xf1f4ff,intensity:2});
  const shadow = new THREE.SpotLight(0xf1f4ff, 34, 16, Math.PI / 2.9, 1, 2);
  shadow.position.copy(topPosition); shadow.target.position.copy(topTarget);
  shadow.castShadow = true; shadow.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  shadow.shadow.bias = -.00015; shadow.shadow.normalBias = .012;
  shadow.shadow.camera.near = .08; shadow.shadow.camera.far = 16;
  scene.add(shadow,shadow.target);

  const industrial = await load('industrial');
  const faces = [
    {center:[-.275325,1.051729,.376241],normal:[-.444386,-.19384,.874612]},
    {center:[.045721,1.051301,.510397],normal:[-.323947,-.166213,.93136]}
  ];
  for (const face of faces) {
    const normal = new THREE.Vector3(...face.normal).transformDirection(industrial.matrixWorld);
    const position = industrial.localToWorld(new THREE.Vector3(...face.center)).addScaledVector(normal,.025);
    const target = position.clone().add(normal);
    const light = new THREE.SpotLight(0xffe4c4, 14, 12, Math.PI / 3.5, .85, 2);
    light.position.copy(position); light.target.position.copy(target);
    light.castShadow = true; light.shadow.mapSize.setScalar(mobile ? 512 : 1024);
    light.shadow.camera.near = .05; light.shadow.camera.far = 12;
    light.shadow.bias = -.00015; light.shadow.normalBias = .012;
    scene.add(light,light.target);
    sources.push({position,target,width:.24,height:.12,color:0xffe4c4,intensity:1.4});
  }
  // The environment contains only cards matching the installed lamps, plus weak room bounce.
  const environment = new THREE.Scene(); environment.background = new THREE.Color(0x101116);
  for (const source of sources) {
    const material = new THREE.MeshBasicMaterial({color:source.color,side:THREE.DoubleSide});
    material.color.multiplyScalar(source.intensity);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(source.width,source.height),material);
    card.position.copy(source.position); card.lookAt(source.target); environment.add(card);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = await pmrem.fromSceneAsync(environment,.06,.1,50,{size:256});
  scene.environment = map.texture;
  environment.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); pmrem.dispose();
  // Update the static shadow maps once after all fixtures and the car are present.
  scene.traverse(o=>{if(o.isLight && o.castShadow){o.shadow.autoUpdate=false;o.shadow.needsUpdate=true;}});
}

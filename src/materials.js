import * as THREE from 'three/webgpu';
import { materialRoughness, materialMetalness, max, mix } from 'three/tsl';

export function prepareMaterial(original, renderer) {
  const name = original.name.toLowerCase();
  let source = original.clone();
  if (name === 'body_mat') {
    source = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(source, original);
    source.clearcoat = .18;
    source.clearcoatRoughness = .32;
    source.ior = 1.46;
    source.metalness = 0;
  }
  const material = renderer.library.fromMaterial(source);
  if (!material) throw new Error(`Unsupported material: ${original.name}`);
  const isCar = /body_mat|wheels_mat|bottom_details_mat|glass_details_mat|interior_mat/.test(name);
  material.envMapIntensity = isCar ? .32 : .12;
  if (name === 'led_bar') {
    material.emissive.set(0xfff3e5);
    material.emissiveIntensity = 0;
    material.metalness = 0;
    material.roughness = .75;
  } else {
    material.emissive?.set(0x000000);
    material.emissiveIntensity = 0;
    material.emissiveMap = null;
  }
  if (name === 'body_mat') material.roughnessNode = max(materialRoughness,.3);
  if (name === 'wheels_mat') {
    // Retain the original metalness texture to distinguish rims from rubber.
    material.metalness = 1;
    material.roughnessNode = max(materialRoughness,mix(.78,.3,materialMetalness));
    material.envMapIntensity = .2;
  }
  if (name === 'bottom_details_mat') material.roughnessNode = max(materialRoughness,.38);
  if (name === 'interior_mat') {
    material.roughnessNode = max(materialRoughness,.65);
    material.envMapIntensity = .14;
  }
  if (name === 'material.004') {
    material.roughnessNode = max(materialRoughness,.6);
    material.metalness = 0;
    material.envMapIntensity = .15;
  }
  if (name.includes('glass')) {
    material.transparent = true;
    material.opacity = Math.min(original.opacity,.48);
    material.depthWrite = false;
    material.metalness = 0;
    material.roughnessNode = max(materialRoughness,.12);
  }
  return { material, isCar };
}

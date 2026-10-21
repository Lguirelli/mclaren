import * as THREE from 'three';

export function prepareMaterial(original) {
  const name = original.name.toLowerCase();
  const material = original.clone();
  const isCar = /^(body_mat|wheels_mat|bottom_details_mat|glass_details_mat|interior_mat)$/.test(name);
  material.envMapIntensity = .32;
  material.emissive?.set(0x000000);
  material.emissiveIntensity = 0;
  material.emissiveMap = null;
  if (name === 'body_mat') {
    material.metalness = 0;
    material.roughness = .55;
  }
  if (name === 'wheels_mat') {
    material.metalness = 1;
    material.roughness = .9;
    material.envMapIntensity = .2;
  }
  if (name === 'bottom_details_mat') material.roughness = .65;
  if (name === 'interior_mat') { material.roughness = .9; material.envMapIntensity = .14; }
  if (name.includes('glass')) {
    material.transparent = true;
    material.opacity = Math.min(original.opacity,.48);
    material.depthWrite = false;
    material.metalness = 0;
    material.roughness = .25;
  }
  return {material,isCar};
}

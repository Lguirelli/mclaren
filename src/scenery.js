import * as THREE from 'three/webgpu';

const carMaterials = new Set(['body_mat', 'wheels_mat', 'bottom_details_mat', 'glass_details_mat', 'interior_mat']);

export function isolateCar(root) {
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length && materials.every(material => carMaterials.has(material.name.toLowerCase()))) meshes.push(object);
  });
  if (!meshes.length) throw new Error('Car geometry was not found in the model');
  const car = new THREE.Group();
  car.name = 'McLaren';
  // Keep the imported transforms while excluding the complete studio hierarchy.
  meshes.forEach(mesh => car.attach(mesh));
  return car;
}

export function createShadowCatcher(car) {
  const bounds = new THREE.Box3().setFromObject(car, true);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(size.x, size.z) * 4, Math.max(size.x, size.z) * 4),
    new THREE.ShadowNodeMaterial({color: 0x000000, opacity: .45, depthWrite: false})
  );
  plane.name = 'Shadow catcher';
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(center.x, bounds.min.y - .003, center.z);
  plane.receiveShadow = true;
  return plane;
}

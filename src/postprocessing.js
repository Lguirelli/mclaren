import * as THREE from 'three/webgpu';
import { pass, uniform, mix, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

export function createPostProcessing(renderer, scene, camera) {
  const pipeline = new THREE.PostProcessing(renderer);
  const scenePass = pass(scene,camera,{samples:4});
  const color = scenePass.getTextureNode('output');
  const occlusion = ao(scenePass.getTextureNode('depth'),null,camera);
  occlusion.resolutionScale = .5;
  occlusion.radius.value = .24;
  occlusion.thickness.value = .2;
  occlusion.distanceExponent.value = 1.5;
  occlusion.samples.value = 12;
  const grounded = vec4(color.rgb.mul(mix(1,occlusion.r,.32)),color.a);
  const focus = uniform(10);
  const depthOfField = dof(grounded,scenePass.getViewZNode(),focus,uniform(7),uniform(.3));
  // Different graphs prevent disabled effects from consuming render passes on mobile.
  const glow = bloom(color,.025,.15,1.4);
  const graphs = { full:depthOfField.add(glow), medium:grounded.add(glow), light:color };
  let current = '';
  return {
    focus,
    setQuality({mobile,reduced,low}) {
      const next = low || mobile ? 'light' : reduced || !renderer.backend.isWebGPUBackend ? 'medium' : 'full';
      if(next!==current){current=next;pipeline.outputNode=graphs[next];pipeline.needsUpdate=true;}
    },
    render(){pipeline.render();},
    dispose(){pipeline.dispose();scenePass.dispose();occlusion.dispose();depthOfField.dispose();glow.dispose();}
  };
}

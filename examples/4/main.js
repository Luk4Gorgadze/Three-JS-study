import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TextureLoader } from "three";
import { getBody } from "./getBodies.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.es.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  1,
  500,
);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xff94ad);

const baseLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(baseLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(6, 8, 10);
scene.add(keyLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bokehPass = new BokehPass(scene, camera, {
  focus: 5,
  aperture: 0.002,
  maxblur: 0.01,
});
composer.addPass(bokehPass);
composer.addPass(new OutputPass());

const getViewHalfHeight = () =>
  Math.tan(THREE.MathUtils.degToRad(camera.fov * 1)) *
  Math.abs(camera.position.z);

// ── Physics ────────────────────────────────────────────────────────────────────
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });

const loader = new GLTFLoader();
const textureLoader = new TextureLoader();
const assetBase = import.meta.env.BASE_URL;
const baseMaps = [
  textureLoader.load(`${assetBase}models/textures/New Group_Color_Baked_0.png`),
  textureLoader.load(`${assetBase}models/textures/New Group_Color_Baked_2.png`),
  textureLoader.load(`${assetBase}models/textures/New Group_Color_Baked_1.png`),
];
baseMaps.forEach((map) => {
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = true;
});

const gltf = await loader.loadAsync(`${assetBase}models/Strawberry.glb`);
const modelRoot = gltf.scene;
let meshIndex = 0;
modelRoot.traverse((node) => {
  if (node.isMesh) {
    const map = baseMaps[meshIndex % baseMaps.length];
    meshIndex += 1;
    node.material = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.8,
      metalness: 0.0,
    });
    node.material.transparent = true;
  }
});

const numBodies = 30;
const bodies = [];
for (let i = 0; i < numBodies; i++) {
  const body = getBody(RAPIER, world, modelRoot, getViewHalfHeight);
  bodies.push(body);
  scene.add(body.mesh);
}

function animate(time) {
  // controls.update();
  world.step();
  bodies.forEach((b) => b.update());
  composer.render();
}
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

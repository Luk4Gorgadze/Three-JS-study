import * as THREE from "three";
import { getBody, getMouseBall } from "./getBodies.js";
import getLayer from "./getLayer.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { ssgi } from "three/addons/tsl/display/SSGINode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import {
  add,
  colorToDirection,
  depth,
  diffuseColor,
  directionToColor,
  mrt,
  normalView,
  output,
  pass,
  sample,
  vec4,
  velocity,
} from "three/tsl";
import { RenderPipeline, WebGPURenderer } from "three/webgpu";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/rapier.es.js";

if (!navigator.gpu) {
  throw new Error("WebGPU is not available in this browser.");
}

const renderer = new WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

new EXRLoader().load("./Hdri/studio_small_09_2k.exr", (texture) => {
  scene.environment = texture;
});

scene.background = new THREE.Color(0x0e0f14);
scene.environmentIntensity = 0.2;
renderer.toneMappingExposure = 1;

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 14);
const renderPipeline = new RenderPipeline(renderer);

const scenePass = pass(scene, camera);
scenePass.setMRT(
  mrt({
    output: output,
    diffuseColor: diffuseColor,
    normal: directionToColor(normalView),
    velocity: velocity,
  }),
);

const scenePassColor = scenePass.getTextureNode("output");
const scenePassDiffuse = scenePass.getTextureNode("diffuseColor");
const scenePassDepth = scenePass.getTextureNode("depth");
const scenePassNormal = scenePass.getTextureNode("normal");
const scenePassVelocity = scenePass.getTextureNode("velocity");

const sceneNormal = sample((uv) => {
  return colorToDirection(scenePassNormal.sample(uv));
});

// ── SSGI ──────────────────────────────────────────────────────────────────────
const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera);
giPass.sliceCount.value = 1;
giPass.stepCount.value = 1;
giPass.radius.value = 1;
giPass.giIntensity.value = 1.5;

const gi = giPass.rgb;
const ao = giPass.a;

const compositePass = vec4(
  add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)),
  scenePassColor.a,
);

// ── TRAA ──────────────────────────────────────────────────────────────────────
const traaPass = traa(compositePass, scenePassDepth, scenePassVelocity, camera);

// ── Bloom ─────────────────────────────────────────────────────────────────────
// bloomNode(inputColor, strength, radius, threshold)
const bloomPass = bloom(compositePass, 0.3, 0.5, 0.0);
const finalBloomPass = traaPass.add(bloomPass.mul(1));

// ── Depth of Field (Bokeh) ────────────────────────────────────────────────────
// dof(color, depth, camera, { focus, aperture, maxblur })
const dofPass = dof(finalBloomPass, scenePassDepth, camera, {
  focus: 1, // actual camera→origin distance
  aperture: 1.8, // much gentler — barely-there bokeh on far edges
  maxblur: 0.3, // tight cap so nothing goes mushy
});

renderPipeline.outputNode = dofPass;

// ── Physics ────────────────────────────────────────────────────────────────────
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: 0, z: 0 });

const numBodies = 16;
const bodies = [];
const colorCycle = [0xffe68c, 0x4cc9f0, 0x90be6d, 0xfee440, 0xf72585];
for (let i = 0; i < numBodies; i++) {
  const body = getBody(RAPIER, world);
  const initialColor = body.mesh.material.color?.getHex?.();
  body.mesh.userData.colorIndex = initialColor === 0xffe68c ? 0 : -1;
  if (body.mesh.userData.colorIndex === 0) {
    body.mesh.userData.targetColor = body.mesh.material.color.clone();
  }
  bodies.push(body);
  scene.add(body.mesh);
}

const mouseBall = getMouseBall(RAPIER, world);

const hemiLight = new THREE.HemisphereLight(0x00bbff, 0xaa00ff);
hemiLight.intensity = 0.2;
scene.add(hemiLight);

const baseLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(baseLight);

// ── Debug points ───────────────────────────────────────────────────────────────
const pointsGeo = new THREE.BufferGeometry();
const pointsMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true });
const points = new THREE.Points(pointsGeo, pointsMat);
scene.add(points);

// ── Mouse raycasting ───────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointerPos = new THREE.Vector2(0, 0);
const mousePos = new THREE.Vector3(0, 0, 0);

const mousePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(48, 48, 48, 48),
  new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ff00,
    transparent: true,
    opacity: 0.0,
  }),
);
mousePlane.position.set(0, 0, 0.2);
mousePlane.visible = false;
scene.add(mousePlane);

window.addEventListener("mousemove", (evt) => {
  pointerPos.set(
    (evt.clientX / window.innerWidth) * 2 - 1,
    -(evt.clientY / window.innerHeight) * 2 + 1,
  );
});

window.addEventListener("pointerdown", () => {
  bodies.forEach((body) => {
    const index = body.mesh.userData.colorIndex;
    if (index === undefined || index < 0) {
      return;
    }

    const nextIndex = (index + 1) % colorCycle.length;
    body.mesh.userData.colorIndex = nextIndex;
    body.mesh.userData.targetColor = new THREE.Color(colorCycle[nextIndex]);
  });
});

let cameraDirection = new THREE.Vector3();

function handleRaycast() {
  camera.getWorldDirection(cameraDirection);
  cameraDirection.multiplyScalar(-1);
  mousePlane.lookAt(cameraDirection);
  raycaster.setFromCamera(pointerPos, camera);
  const intersects = raycaster.intersectObjects([mousePlane], false);
  if (intersects.length > 0) mousePos.copy(intersects[0].point);
}

// ── Animate ────────────────────────────────────────────────────────────────────
function animate() {
  world.step();
  handleRaycast();
  mouseBall.update(mousePos);
  bodies.forEach((b) => {
    const target = b.mesh.userData.targetColor;
    if (!target) {
      return;
    }
    b.mesh.material.color.lerp(target, 0.08);
  });
  bodies.forEach((b) => b.update());
  renderPipeline.render();
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const sceneMiddle = new THREE.Vector3(0, 0, 0);
// const colorPallete = [0x780000, 0xc1121f, 0xfdf0d5, 0x003049, 0x669bbc];
const colorPallete = [
  0x0067b1, 0x4e99ce, 0x9bcbeb, 0x55d7e2, 0xffffff, 0x9ca9b2, 0x4e6676,
  0xf69230, 0xf5d81f,
];
// const colorPallete = [0xff6d00, 0xff7900, 0xff8500, 0xff9100, 0xff9e00, 0x240046, 0x3c096c, 0x5a189a, 0x7b2cbf, 0x9d4edd];

// geos:
const geometries = [
  //   new THREE.SphereGeometry(0.65, 64, 64),
  new RoundedBoxGeometry(1.0, 1.0, 1.0, 2, 0.1),
  //   new THREE.IcosahedronGeometry(1.0, 0),
  //   new THREE.TorusGeometry(0.65, 0.3, 16, 64),
  //   new THREE.TorusKnotGeometry(0.65, 0.25, 128, 32),
  //   new THREE.TetrahedronGeometry(1.0, 0),
  //   new THREE.OctahedronGeometry(1.0, 0),
  //   new THREE.DodecahedronGeometry(1.0),
];

const glbLoader = new GLTFLoader();
const glbPaths = ["duck.glb"]; // Add more paths as needed

const textureLoader = new THREE.TextureLoader();
const baseColorUrl = new URL(
  "./textures/2K/Poliigon_PlasticMoldDryBlast_7495_BaseColor.jpg",
  import.meta.url,
).href;
const normalUrl = new URL(
  "./textures/2K/Poliigon_PlasticMoldDryBlast_7495_Normal.png",
  import.meta.url,
).href;
const baseColorMap = textureLoader.load(baseColorUrl);
baseColorMap.colorSpace = THREE.SRGBColorSpace;
const normalMap = textureLoader.load(normalUrl);

function getGeometry(size) {
  const randomGeo = geometries[Math.floor(Math.random() * geometries.length)];
  const geo = randomGeo.clone();
  geo.scale(size, size, size);
  return geo;
}

function getBody(RAPIER, world) {
  const size = 1.5; // 0.1 + Math.random() * 0.25;
  const range = 12;
  const density = size * 1.0;
  let x = Math.random() * range - range * 0.5;
  let y = Math.random() * range - range * 0.5 + 3;
  let z = Math.random() * range - range * 0.5;

  const geometry = getGeometry(size);
  const prob = Math.random();
  const options =
    prob < 0.33
      ? {
          normalMap,
          normalScale: new THREE.Vector2(3, 3),
          color: 0x000000,
          roughness: 0.0,
          metalness: 0.0,
          reflectivity: 1,
        }
      : prob < 0.66
        ? {
            normalMap,
            normalScale: new THREE.Vector2(3, 3),
            color: 0xffffff,
            roughness: 0.0,
            metalness: 0.0,
            reflectivity: 1,
          }
        : {
            normalMap,
            normalScale: new THREE.Vector2(3, 3),
            color: 0xffe68c,
            roughness: 0.0,
            metalness: 0.0,
            reflectivity: 1,
          };
  const material = new MeshStandardNodeMaterial(options);
  const mesh = new THREE.Mesh(geometry, material);

  // physics
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(1.0)
    .setAngularDamping(1.0);
  let rigid = world.createRigidBody(rigidBodyDesc);
  let points = geometry.attributes.position.array;
  let colliderDesc = RAPIER.ColliderDesc.convexHull(points).setDensity(density);
  world.createCollider(colliderDesc, rigid);

  function update() {
    rigid.resetForces(true);
    let { x, y, z } = rigid.translation();
    let pos = new THREE.Vector3(x, y, z);
    let dir = pos.clone().sub(sceneMiddle).normalize();
    let q = rigid.rotation();
    let rote = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    mesh.rotation.setFromQuaternion(rote);
    let strength = 0.4;
    let dist = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2) || 1;
    let force = {
      x: (-dir.x / dist) * strength * dist,
      y: (-dir.y / dist) * strength * dist,
      z: (-dir.z / dist) * strength * dist,
    };
    rigid.applyImpulse(force, true);
    mesh.position.set(x, y, z);
  }
  return { mesh, rigid, update };
}

function getMouseBall(RAPIER, world) {
  const mouseSize = 1.5;
  const geometry = new THREE.IcosahedronGeometry(mouseSize, 8);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
  });
  const mouseMesh = new THREE.Mesh(geometry, material);
  // RIGID BODY
  let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
    0,
    0,
    0,
  );
  let mouseRigid = world.createRigidBody(bodyDesc);
  let dynamicCollider = RAPIER.ColliderDesc.ball(mouseSize);
  world.createCollider(dynamicCollider, mouseRigid);
  function update(mousePos) {
    mouseRigid.setTranslation({ x: mousePos.x, y: mousePos.y, z: mousePos.z });
    let { x, y, z } = mouseRigid.translation();
    mouseMesh.position.set(x, y, z);
  }
  return { mesh: mouseMesh, update };
}

export { getBody, getMouseBall };

import * as THREE from "three";
const moveDir = new THREE.Vector3(0, 1, 0);

function getBody(RAPIER, world, modelRoot, getViewHalfHeight) {
  const size = 1.4 + Math.random() * 0.5;
  const range = 12;
  const zRange = 10;
  const yRange = getViewHalfHeight ? getViewHalfHeight() * 2 : 12;
  const density = size * 1.0;
  const spinAxis = new THREE.Vector3(
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
    Math.random() * 2 - 1,
  ).normalize();
  const spinStrength = 0.01;
  let x = Math.random() * range - range * 0.5;
  let y = Math.random() * yRange - yRange * 0.5;
  let z = Math.random() * zRange - zRange * 0.5 - 1;

  const mesh = modelRoot.clone(true);
  const bounds = new THREE.Box3().setFromObject(mesh);
  const center = new THREE.Vector3();
  const sizeVec = new THREE.Vector3();
  bounds.getCenter(center);
  bounds.getSize(sizeVec);
  const maxSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
  const scale = size / maxSize;
  mesh.scale.setScalar(scale);
  mesh.position.sub(center.multiplyScalar(scale));
  const group = new THREE.Group();
  group.add(mesh);

  // physics
  let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(1.0)
    .setAngularDamping(1.0);
  let rigid = world.createRigidBody(rigidBodyDesc);
  const halfExtents = sizeVec.multiplyScalar(scale * 0.5);
  let colliderDesc = RAPIER.ColliderDesc.cuboid(
    halfExtents.x,
    halfExtents.y,
    halfExtents.z,
  ).setDensity(density);
  world.createCollider(colliderDesc, rigid);

  function respawn() {
    const viewHalfHeight =
      typeof getViewHalfHeight === "function" ? getViewHalfHeight() : 6;
    const x = Math.random() * range - range * 0.5;
    const y = -viewHalfHeight - size;
    const z = Math.random() * zRange - zRange * 0.5 - 1;

    rigid.setTranslation({ x, y, z }, true);
    rigid.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rigid.setAngvel({ x: 0, y: 0, z: 0 }, true);
    rigid.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    group.position.set(x, y, z);
  }

  function update() {
    rigid.resetForces(true);
    let { x, y, z } = rigid.translation();
    const viewHalfHeight =
      typeof getViewHalfHeight === "function" ? getViewHalfHeight() : 6;
    if (y > viewHalfHeight + size) {
      respawn();
      return;
    }
    let q = rigid.rotation();
    let rote = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    group.rotation.setFromQuaternion(rote);
    const moveSpeed = 0.5;
    const velocity = moveDir.clone().normalize().multiplyScalar(moveSpeed);
    rigid.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    rigid.applyTorqueImpulse(
      {
        x: spinAxis.x * spinStrength,
        y: spinAxis.y * spinStrength,
        z: spinAxis.z * spinStrength,
      },
      true,
    );
    group.position.set(x, y, z);
  }
  return { mesh: group, rigid, update };
}
export { getBody };

import * as THREE from "/vendor/three.module.js";
import { createGame } from "/src/game.js";

function seededPositions(seed, count, offset) {
  let state = seed >>> 0;
  return Array.from({ length: count }, (_, i) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const angle = i * 2.39996 + offset + state / 4294967296 * 0.83;
    const radius = Math.sqrt((i + 0.5) / count) * 37;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  });
}

function batch(parent, geometry, color, count, emissive = "#000000") {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial({ color, emissive }), count);
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

function makeBatches(parent, game, glow) {
  const count = game.shades.length;
  const shade = batch(parent, new THREE.IcosahedronGeometry(0.59, 1), "#120A1A", count, "#221137");
  shade.castShadow = true;
  const rim = batch(parent, new THREE.TorusGeometry(0.67, 0.06, 5, 18), "#7A3CFF", count, "#5630aa");
  const eye = batch(parent, new THREE.SphereGeometry(0.08, 7, 5), "#7A3CFF", count * 2, "#6941c3");
  const mote = batch(parent, new THREE.OctahedronGeometry(0.18), "#FFF6C2", game.motes.length, "#FFE58A");
  const particles = (size, color, number, opacity) => {
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(number * 3), 3);
    geometry.setAttribute("position", position);
    const object = new THREE.Points(geometry, new THREE.PointsMaterial({
      color, map: glow, size, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    object.frustumCulled = false;
    parent.add(object);
    return position;
  };
  const shadowGlow = particles(2.3, "#7A3CFF", count, 0.46);
  const moteGlow = particles(1.4, "#FFE58A", game.motes.length, 0.75);
  const dummy = new THREE.Object3D();
  return time => {
    for (let i = 0; i < count; i++) {
      const unit = game.shades[i];
      const [x, , z] = unit.pos;
      const y = 0.48 + Math.sin(time * 3.5 + i) * 0.13;
      const [dx, dz] = unit.heading ?? game.shadeWanderHeading(unit);
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.atan2(dx, dz), 0);
      dummy.scale.set(0.93, 1.14, 0.82);
      dummy.updateMatrix();
      shade.setMatrixAt(i, dummy.matrix);
      dummy.position.y -= 0.18;
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rim.setMatrixAt(i, dummy.matrix);
      for (const side of [-1, 1]) {
        dummy.position.set(x + dx * 0.43 + side * dz * 0.21, y + 0.07, z + dz * 0.43 - side * dx * 0.21);
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(1.25, 0.5, 1);
        dummy.updateMatrix();
        eye.setMatrixAt(i * 2 + Number(side === 1), dummy.matrix);
      }
      shadowGlow.setXYZ(i, x, y, z);
    }
    for (let i = 0; i < game.motes.length; i++) {
      const [x, , z] = game.motes[i].pos;
      const y = 0.31 + Math.sin(time * 3.5 + i) * 0.11;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, time * 1.8 + i, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mote.setMatrixAt(i, dummy.matrix);
      moteGlow.setXYZ(i, x, y, z);
    }
    for (const mesh of [shade, rim, eye, mote]) mesh.instanceMatrix.needsUpdate = true;
    shadowGlow.needsUpdate = moteGlow.needsUpdate = true;
  };
}

export async function runBenchmark({ seed, duration, renderer, scene, camera, prepare, glow }) {
  const game = createGame(seed, {
    random_motes: false, random_shades: false,
    motes: seededPositions(seed, 100, 1),
    shades: seededPositions(seed, 200, 0).map(pos => ({ pos, state: "wander" })),
    lanterns: [1, 2, 3].map(i => ({ id: `L${i}`, lit: true, fuel: 100 }))
  });
  const { group, atmosphere } = prepare(game);
  const update = makeBatches(group, game, glow);
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720, false);
  camera.aspect = 1280 / 720;
  camera.updateProjectionMatrix();
  const gl = renderer.getContext();
  const gpuInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const origin = new THREE.Vector3();
  return new Promise(resolve => {
    const samples = [];
    let start;
    let firstFrame;
    let previous;
    let previousShadow = -Infinity;
    let nextTick = 1;
    function draw(timestamp) {
      start ??= timestamp;
      const elapsed = (timestamp - start) / 1000;
      while (nextTick <= Math.floor(elapsed * 60)) {
        game.simTick = nextTick++;
        game.updateShades({ wanderOnly: true });
      }
      const angle = elapsed * Math.PI * 2 / 15;
      camera.position.set(Math.cos(angle) * 30, 15, Math.sin(angle) * 30);
      camera.lookAt(origin);
      atmosphere.sky.position.copy(camera.position);
      atmosphere.time.value = elapsed;
      update(elapsed);
      if (timestamp - previousShadow >= 1000 / 30) {
        renderer.shadowMap.needsUpdate = true;
        previousShadow = timestamp;
      }
      renderer.render(scene, camera);
      if (!firstFrame) {
        gl.finish();
        firstFrame = Date.now();
      }
      if (previous != null && previous >= 3 && elapsed <= 3 + duration) {
        samples.push((elapsed - previous) * 1000);
      }
      previous = elapsed;
      if (elapsed >= 3 + duration) resolve({ firstFrame, samples, gpu });
      else requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  });
}

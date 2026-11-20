import * as THREE from "/vendor/three.module.js";

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options });
const up = new THREE.Vector3(0, 1, 0);

function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function joint(parent, x, y, z) {
  const object = new THREE.Group();
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function ellipsoid(parent, sphere, surface, position, scale) {
  const object = mesh(parent, sphere, surface, ...position);
  object.scale.set(...scale);
  return object;
}

export function createMay(parent, glow) {
  const root = joint(parent, 0, 0, 0);
  const body = joint(root, 0, 0, 0);
  const head = joint(body, 0, 1.48, 0.035);
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const cloth = material("#E8E2D0");
  const red = material("#C8102E");
  const indigo = material("#383867", { side: THREE.DoubleSide });
  const trousers = material("#243849");
  const leather = material("#302530");
  const skin = material("#dbad8f", { roughness: 0.82 });
  const hair = material("#232033");
  const iris = material("#5f3842");
  const white = material("#fff1df");
  const brass = material("#c49451", { metalness: 0.55, roughness: 0.34 });

  ellipsoid(body, sphere, cloth, [0, 1.08, 0], [0.28, 0.33, 0.17]).castShadow = true;
  ellipsoid(body, sphere, trousers, [0, 0.79, 0], [0.25, 0.18, 0.16]);
  mesh(body, new THREE.CylinderGeometry(0.234, 0.249, 0.09, 20), red, 0, 0.87, 0).scale.z = 0.72;
  ellipsoid(body, sphere, leather, [0.14, 0.83, 0.13], [0.12, 0.09, 0.052]);
  ellipsoid(head, sphere, skin, [0, 0, 0.02], [0.236, 0.247, 0.21]);
  ellipsoid(head, sphere, hair, [0, 0.09, -0.046], [0.244, 0.196, 0.188]);
  ellipsoid(head, sphere, skin, [0, -0.035, 0.224], [0.042, 0.036, 0.035]);
  ellipsoid(head, sphere, material("#a66b60"), [0, -0.102, 0.204], [0.043, 0.009, 0.008]);
  const eyes = [];
  for (const side of [-1, 1]) {
    ellipsoid(head, sphere, skin, [side * 0.223, -0.035, 0.01], [0.038, 0.065, 0.04]);
    const eye = joint(head, side * 0.091, 0.009, 0.199);
    eye.rotation.y = side * 0.18;
    ellipsoid(eye, sphere, white, [0, 0, 0], [0.054, 0.034, 0.015]);
    ellipsoid(eye, sphere, iris, [0, 0, 0.014], [0.027, 0.031, 0.011]);
    ellipsoid(eye, sphere, white, [-0.008, 0.009, 0.023], [0.009, 0.008, 0.004]);
    const brow = ellipsoid(head, sphere, hair, [side * 0.096, 0.059, 0.204], [0.051, 0.011, 0.009]);
    brow.rotation.z = side * 0.12;
    eyes.push(eye);
  }

  const hat = joint(head, 0, 0.157, 0);
  const straw = material("#c69a60", { side: THREE.DoubleSide });
  const profile = [[0, 0.35], [0.11, 0.33], [0.29, 0.25], [0.53, 0.14], [0.67, 0.047], [0.69, 0.018], [0.668, 0]];
  mesh(hat, new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 56), straw).castShadow = true;
  const weave = [];
  for (let row = 0; row < profile.length - 1; row++) {
    const [r0, y0] = profile[row];
    const [r1, y1] = profile[row + 1];
    for (let band = 1; band <= 4; band++) {
      const r = THREE.MathUtils.lerp(r0, r1, band / 4);
      const y = THREE.MathUtils.lerp(y0, y1, band / 4);
      for (let i = 0; i < 56; i++) {
        for (const endpoint of [i, i + 1]) {
          const angle = endpoint * Math.PI * 2 / 56;
          weave.push(r * Math.cos(angle), y + 0.003, r * Math.sin(angle));
        }
      }
    }
  }
  const weaveGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(weave, 3));
  hat.add(new THREE.LineSegments(weaveGeometry, new THREE.LineBasicMaterial({ color: "#765337", transparent: true, opacity: 0.45 })));
  const rim = mesh(hat, new THREE.TorusGeometry(0.676, 0.022, 8, 56), brass, 0, 0.025);
  rim.rotation.x = Math.PI / 2;
  ellipsoid(hat, sphere, red, [0, 0.344, 0], [0.09, 0.028, 0.09]);

  const cape = mesh(body, new THREE.PlaneGeometry(1, 1, 16, 14), indigo);
  cape.frustumCulled = false;
  cape.castShadow = true;
  const capePositions = cape.geometry.attributes.position;
  const scarf = joint(body, 0, 1.34, 0);
  const collar = mesh(scarf, new THREE.TorusGeometry(0.185, 0.045, 10, 28), red);
  collar.rotation.x = Math.PI / 2;
  collar.scale.y = 0.94;
  ellipsoid(scarf, sphere, red, [-0.12, -0.018, 0.15], [0.07, 0.065, 0.042]);
  const ribbons = [-1, 1].map(side => {
    const tail = joint(scarf, side * 0.11, 0, -0.13);
    mesh(tail, new THREE.BoxGeometry(0.09, 0.42, 0.024), red, 0, -0.20);
    return tail;
  });
  const arms = [-1, 1].map(side => {
    const shoulder = joint(body, side * 0.265, 1.23, 0);
    ellipsoid(shoulder, sphere, cloth, [0, -0.12, 0], [0.09, 0.16, 0.084]);
    const elbow = joint(shoulder, 0, -0.24, 0);
    ellipsoid(elbow, sphere, indigo, [0, -0.10, 0], [0.063, 0.14, 0.058]);
    ellipsoid(elbow, sphere, skin, [0, -0.226, 0.008], [0.058, 0.075, 0.045]);
    return { shoulder, elbow, side };
  });
  const lamp = joint(arms[1].elbow, 0, -0.24, 0.066);
  const lampCore = material("#FFE9B0", { emissive: "#FFB347", emissiveIntensity: 2.2, roughness: 0.39 });
  mesh(lamp, new THREE.TorusGeometry(0.07, 0.014, 6, 14), brass, 0, -0.055);
  mesh(lamp, new THREE.CylinderGeometry(0.088, 0.116, 0.17, 6), lampCore, 0, -0.18);
  mesh(lamp, new THREE.ConeGeometry(0.142, 0.085, 6), brass, 0, -0.062);
  mesh(lamp, new THREE.CylinderGeometry(0.125, 0.097, 0.035, 6), brass, 0, -0.283);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    mesh(lamp, new THREE.CylinderGeometry(0.008, 0.012, 0.176, 6), brass,
      Math.sin(angle) * 0.102, -0.18, Math.cos(angle) * 0.102);
  }
  const halo = glow(lamp, "#FFB347", 1.4, -0.17);
  const lampLight = new THREE.PointLight("#ffbf73", 8, 7);
  lampLight.position.y = -0.2;
  lamp.add(lampLight);
  const legGeometry = new THREE.CapsuleGeometry(0.094, 0.21, 5, 10);
  const legs = [-1, 1].map(side => ({
    side,
    thigh: mesh(root, legGeometry, trousers),
    shin: mesh(root, legGeometry, trousers),
    knee: ellipsoid(root, sphere, trousers, [0, 0, 0], [0.092, 0.093, 0.092]),
    shoe: ellipsoid(root, sphere, leather, [0, 0, 0], [0.099, 0.077, 0.168])
  }));
  const upper = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const ankle = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const orient = (part, from, to) => {
    axis.subVectors(to, from);
    part.position.copy(from).addScaledVector(axis, 0.5);
    part.scale.y = axis.length() / 0.398;
    part.quaternion.setFromUnitVectors(up, axis.normalize());
  };

  let gait = 0;
  let movement = 0;
  let tempo = 0;
  let lastStep = 0;
  return {
    root,
    pose({ time, delta, speed, grounded, vertical, dashing, charmed, yaw }) {
      tempo += delta;
      movement = THREE.MathUtils.lerp(movement, grounded ? Math.min(1, speed / 5) : 0, 1 - Math.exp(-delta * 14));
      gait += delta * speed * 3.5;
      const step = Math.floor(gait / Math.PI);
      const foot = step !== lastStep && movement > 0.3 && grounded ? (step % 2 ? 1 : -1) : 0;
      lastStep = step;
      const bob = movement * (0.015 + Math.abs(Math.sin(gait)) * 0.048) + Math.sin(tempo * 2.6) * 0.011;
      body.position.y = bob;
      body.rotation.x = (dashing ? 0.29 : movement * 0.12) + (!grounded ? -vertical * 0.013 : 0);
      body.rotation.z = Math.cos(gait) * movement * 0.044;
      head.rotation.z = -body.rotation.z * 0.8;
      head.rotation.x = -body.rotation.x * 0.46 + Math.sin(tempo * 1.9) * 0.026;
      hat.rotation.z = Math.sin(gait + 0.55) * movement * 0.026;
      const blink = (tempo + 1.7) % 4.8;
      for (const eye of eyes) eye.scale.y = blink < 0.16 ? Math.max(0.10, Math.abs(blink - 0.08) / 0.08) : 1;
      for (const { shoulder, elbow, side } of arms) {
        shoulder.rotation.x = side * Math.sin(gait) * movement * 0.56 - (side === 1 ? 0.24 : 0.06);
        shoulder.rotation.z = side * (0.16 + (dashing ? 0.16 : 0));
        elbow.rotation.x = side === 1 ? -0.36 - Math.cos(gait) * movement * 0.12 : -0.20 - movement * 0.23;
      }
      lamp.rotation.x = -arms[1].elbow.rotation.x * 0.6 + Math.cos(gait - 0.52) * movement * 0.24;
      lamp.rotation.z = -arms[1].shoulder.rotation.z * 0.77 + Math.sin(tempo * 3 + gait) * 0.1;
      lampCore.emissiveIntensity = (charmed ? 3.35 : 1.85) + Math.sin(time * 11) * 0.15 + Math.sin(time * 17) * 0.1;
      halo.material.opacity = charmed ? 0.89 : 0.64;
      lampLight.intensity = (charmed ? 14 : 8) + Math.sin(time * 9) * 0.8;
      for (const [i, tail] of ribbons.entries()) {
        tail.rotation.x = 0.32 + movement * 0.7 + Math.sin(time * 6 + i) * 0.16;
        tail.rotation.z = (i ? 1 : -1) * (0.22 + Math.sin(time * 4 + i) * 0.14);
      }

      for (const leg of legs) {
        const phase = (gait / Math.PI + (leg.side === 1 ? 1 : 0)) % 2;
        const swing = phase < 1 ? 1 - 2 * phase : -Math.cos((phase - 1) * Math.PI);
        const lift = phase < 1 ? 0 : Math.sin((phase - 1) * Math.PI) * movement;
        const z = grounded ? swing * movement * 0.45 : leg.side * 0.17;
        const y = grounded ? 0.085 + 0.21 * lift : 0.18 + (leg.side === 1 ? 0.12 : 0);
        upper.set(leg.side * 0.135, 0.80 + bob, 0);
        ankle.set(leg.side * 0.148, y, z);
        knee.copy(upper).lerp(ankle, 0.51);
        knee.z += 0.045 + lift * 0.12 + (!grounded ? 0.15 : 0);
        orient(leg.thigh, upper, knee);
        orient(leg.shin, knee, ankle);
        leg.knee.position.copy(knee);
        leg.shoe.position.copy(ankle).z += 0.057;
        leg.shoe.rotation.x = grounded ? -0.46 * lift + swing * movement * 0.10 : 0.34;
      }

      for (let i = 0; i < capePositions.count; i++) {
        const u = (i % 17) / 16 * 2 - 1;
        const v = Math.floor(i / 17) / 14;
        const flare = movement * 0.23 + (dashing ? 0.27 : 0);
        capePositions.setXYZ(i, u * (0.245 + v * (0.24 + flare)) + Math.sin(time * 4 - v * 6) * v * 0.075,
          1.33 - v * (0.88 - flare * 0.55) + v ** 3 * (u * u * 0.14 + Math.cos(u * 11 + time * 5) * 0.065),
          -0.16 - v * (0.16 + flare) + Math.abs(u) * 0.115 + Math.sin(u * 10 + v * 6 - time * 5) * v * 0.061);
      }
      capePositions.needsUpdate = true;
      cape.geometry.computeVertexNormals();
      const angle = ((yaw - root.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      root.rotation.y += angle * (1 - Math.exp(-delta * 18));
      return foot;
    }
  };
}

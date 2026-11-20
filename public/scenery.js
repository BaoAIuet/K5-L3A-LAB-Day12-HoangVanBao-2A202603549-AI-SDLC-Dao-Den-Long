import * as THREE from "/vendor/three.module.js";

const palettes = [
  ["#0E1430", "#1B2350", "#12384A", "#2F5D50"],
  ["#0F1432", "#1D2455", "#133B50", "#31594D"],
  ["#0D152E", "#1A254C", "#11374D", "#305B52"]
];

const vertex = `
  varying vec3 worldPoint;
  void main() {
    vec4 point = modelMatrix * vec4(position, 1.0);
    worldPoint = point.xyz;
    gl_Position = projectionMatrix * viewMatrix * point;
  }
`;
const moon = "normalize(vec3(-0.48, 0.24, 0.84))";
const noise = `
  float hash21(vec2 v) {
    vec3 p = fract(vec3(v.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 w = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), w.x),
               mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), w.x), w.y);
  }
`;

export function createAtmosphere(scene, parent, night) {
  const [zenith, horizon, water, turf] = palettes[night - 1];
  scene.fog.color.set(horizon);
  const time = { value: 0 };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 40, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { time, zenith: { value: new THREE.Color(zenith) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: vertex,
    fragmentShader: `
      varying vec3 worldPoint;
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform float time;
      ${noise}
      void main() {
        vec3 ray = normalize(worldPoint - cameraPosition);
        float height = smoothstep(0.0, 0.58, ray.y);
        float glow = max(dot(ray, ${moon}), 0.0);
        vec3 color = mix(horizon, zenith, height);
        color += vec3(0.15, 0.23, 0.34) * pow(glow, 28.0);
        color += vec3(0.84, 0.91, 1.0) * smoothstep(0.9992, 0.9994, glow);
        vec2 grid = vec2(atan(ray.z, ray.x), asin(ray.y)) * vec2(94.0, 122.0);
        vec2 cell = floor(grid);
        float star = hash21(cell);
        vec2 center = 0.23 + 0.54 * vec2(hash21(cell + 18.3), hash21(cell + 48.9));
        float spark = 1.0 - smoothstep(0.02, mix(0.13, 0.25, star), length(fract(grid) - center));
        vec3 starColor = mix(vec3(0.52, 0.73, 1.0), vec3(1.0, 0.79, 0.58), hash21(cell + 3.0));
        float twinkle = 0.74 + 0.26 * sin(time * (1.8 + star) + star * 243.0);
        color += starColor * step(0.96, star) * spark * twinkle * smoothstep(0.04, 0.26, ray.y);
        if (ray.y > 0.005 && ray.y < 0.65) {
          vec2 clouds = ray.xz / max(0.085, ray.y + 0.17) * 2.1 + vec2(time * 0.014, -time * 0.008);
          float cloud = noise2(clouds) * 0.63 + noise2(clouds * 2.19) * 0.37;
          float cover = smoothstep(0.38, 0.78, cloud) * smoothstep(0.005, 0.19, ray.y)
            * (1.0 - smoothstep(0.22, 0.65, ray.y));
          color = mix(color, vec3(0.058, 0.089, 0.139) + vec3(0.2, 0.25, 0.31) * pow(glow, 12.0), cover * 0.74);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  }));
  sky.frustumCulled = false;
  sky.renderOrder = 10;
  parent.add(sky);

  const cliffGeometry = mountainGeometry();
  const cliffs = new THREE.InstancedMesh(cliffGeometry, new THREE.MeshStandardMaterial({
    color: "#55748c", vertexColors: true, roughness: 1
  }), 32);
  const cliff = new THREE.Object3D();
  for (let i = 0; i < cliffs.count; i++) {
    const angle = i * 2.39996 + night * 0.42;
    const distance = 100 + i % 4 * 8;
    cliff.position.set(25 + Math.cos(angle) * distance, -2.6, Math.sin(angle) * distance);
    cliff.scale.set(10 + i % 5 * 2.0, 6 + i % 7 * 2.4, 8 + i % 3 * 3);
    cliff.rotation.y = angle;
    cliff.updateMatrix();
    cliffs.setMatrixAt(i, cliff.matrix);
  }
  parent.add(cliffs);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShaderMaterial({
    uniforms: { time, night: { value: night }, water: { value: new THREE.Color(water) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: vertex,
    fragmentShader: `
      uniform float time;
      uniform float night;
      uniform vec3 water;
      uniform vec3 horizon;
      varying vec3 worldPoint;
      ${noise}
      void main() {
        vec2 p = worldPoint.xz;
        float phase = noise2(p * 0.095 + time * 0.04) * 5.0;
        float a = dot(p, vec2(0.71, 1.15)) + time * 1.45 + phase;
        float b = dot(p, vec2(-1.34, 1.87)) - time * 1.06 + phase;
        float micro = sin(dot(p, vec2(4.4, 3.26)) + time * 1.9 + phase);
        vec3 normal = normalize(vec3(0.19 * cos(a) - 0.12 * cos(b), 1.0, 0.22 * cos(a) + 0.18 * cos(b) + micro * 0.025));
        vec3 ray = normalize(worldPoint - cameraPosition);
        vec3 halfAngle = normalize(${moon} - ray);
        float reflection = pow(max(dot(normal, halfAngle), 0.0), 26.0);
        float fresnel = pow(1.0 - max(dot(-ray, normal), 0.0), 3.0);
        float mist = smoothstep(0.38, 0.80, noise2(p * 0.063 + vec2(time * 0.032, 0.0)));
        vec3 color = water * (0.80 + 0.13 * sin(a) + 0.08 * sin(b)) + vec3(0.18, 0.24, 0.34) * reflection * fresnel;
        float shore = night == 2.0 ? min(length(p), length(p - vec2(70, 0))) - 28.0 : length(p) - (night == 1.0 ? 40.0 : 45.0);
        float lace = smoothstep(0.27, 0.82, noise2(p * 1.7 + time * 0.16));
        float wash = 1.0 - smoothstep(0.10, 0.47, abs(shore - 0.54 - sin(time * 1.05 + phase) * 0.33));
        color += vec3(0.15, 0.23, 0.27) * wash * lace * 0.75;
        color = mix(color, horizon * 1.45 + vec3(0.006, 0.014, 0.023), mist * fresnel * 0.46);
        float distanceFade = smoothstep(18.0, 150.0, distance(worldPoint, cameraPosition));
        gl_FragColor = vec4(mix(color, horizon, distanceFade), 1.0);
        #include <colorspace_fragment>
      }
    `
  }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.05;
  parent.add(sea);
  return { sky, time, turf };
}

function mountainGeometry() {
  const geometry = new THREE.PlaneGeometry(2, 2, 26, 26);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const radius = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const folds = 1 + 0.12 * Math.cos(angle * 5) + 0.09 * Math.sin(angle * 9 + 1.4);
    const envelope = Math.max(0, 1 - radius / folds);
    const ridge = Math.sin(x * 15 + z * 6) * Math.cos(z * 18 - x * 4);
    const height = envelope ** 0.87 * (0.9 + ridge * 0.23) + envelope * 0.11 * Math.sin(z * 36);
    positions.setY(i, height);
    const tint = 0.62 + ridge * 0.16 + height * 0.28;
    colors.push(tint * 0.91, tint * 0.96, tint);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function rockGeometry(detail) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const rough = 0.92 + Math.sin(x * 12 + z * 5) * Math.cos(y * 9 - z * 6) * 0.17;
    positions.setXYZ(i, x * rough + y * 0.15, y * rough, z * rough);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function grassTuft() {
  const vertices = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996;
    const x = Math.sin(a);
    const z = Math.cos(a);
    const bend = 0.12 + i % 3 * 0.06;
    const base = 0.015 + i * 0.013;
    const width = 0.035 + i % 2 * 0.012;
    const height = 0.26 + i % 4 * 0.09;
    const left = [x * base - z * width, 0, z * base + x * width];
    const right = [x * base + z * width, 0, z * base - x * width];
    const middle = [x * (base + bend * 0.32), height * 0.62, z * (base + bend * 0.32)];
    const tip = [x * (base + bend), height, z * (base + bend)];
    const edge = [middle[0] + z * width * 0.48, middle[1], middle[2] - x * width * 0.48];
    vertices.push(...left, ...right, ...middle, ...middle, ...right, ...edge, ...middle, ...edge, ...tip);
  }
  const geometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function dressIsland(parent, cx, cz, radius, time, landscapeExtras = true) {
  const count = landscapeExtras ? 730 : 216;
  const grassSurface = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  grassSurface.onBeforeCompile = shader => {
    shader.uniforms.windTime = time;
    shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      vec2 p = instanceMatrix[3].xz;
      float sway = sin(windTime * 2.1 + p.x * 0.43 + p.y * 0.23);
      transformed.x += (0.21 + sway * 0.41) * position.y * position.y;
      transformed.z += cos(windTime * 1.6 + p.y * 0.35) * position.y * position.y * 0.28;
    `);
  };
  const grass = new THREE.InstancedMesh(grassTuft(), grassSurface, count);
  const rocks = new THREE.InstancedMesh(rockGeometry(1), new THREE.MeshStandardMaterial({
    color: "#797887", roughness: 1, flatShading: true
  }), 54);
  const transform = new THREE.Object3D();
  const grassColors = ["#386c61", "#567a63", "#71907b", "#284e52"].map(color => new THREE.Color(color));
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996 + cx * 0.13;
    const spread = 0.16 + Math.sqrt(i * 0.317 % 1) * 0.79;
    transform.position.set(cx + Math.cos(angle) * radius * spread, 0.012, cz + Math.sin(angle) * radius * spread);
    transform.rotation.set(0, angle, 0);
    transform.scale.setScalar(0.45 + (i * 0.413 % 1) * 0.88);
    transform.updateMatrix();
    grass.setMatrixAt(i, transform.matrix);
    grass.setColorAt(i, grassColors[i % grassColors.length]);
    if (i >= rocks.count) continue;
    const rim = 0.96 + (i % 5) * 0.025;
    transform.position.set(cx + Math.cos(angle) * radius * rim, -0.62, cz + Math.sin(angle) * radius * rim);
    transform.rotation.set(0.23 * Math.sin(i), angle, 0.4);
    transform.scale.set(0.86 + (i % 3) * 0.28, 0.48 + (i % 4) * 0.14, 0.89);
    transform.updateMatrix();
    rocks.setMatrixAt(i, transform.matrix);
  }
  grass.receiveShadow = true;
  rocks.receiveShadow = true;
  parent.add(grass, rocks);
  if (landscapeExtras) {
    addCoastalTrees(parent, cx, cz, radius, time);
    addVillage(parent, cx, cz, radius);
  }
}

function addVillage(parent, cx, cz, radius) {
  const sites = radius === 28
    ? [[cx === 0 ? 9 : -9, 19, 0.23], [-16, 6, -0.45]]
    : radius === 45
      ? [[22, 24, 0.42], [-15, 25, -0.32]]
      : [[17, 25, 0.51], [-19, 22, -0.50], [27, 15, 0.32]];
  const stone = new THREE.MeshStandardMaterial({ color: "#76777c", roughness: 0.98 });
  const boulders = new THREE.InstancedMesh(rockGeometry(2), stone, sites.length * 5);
  const rock = new THREE.Object3D();
  const plaster = new THREE.MeshStandardMaterial({ color: "#b59b78", roughness: 0.94 });
  const roof = new THREE.MeshStandardMaterial({ color: "#68463e", roughness: 0.91 });
  const timber = new THREE.MeshStandardMaterial({ color: "#573c30", roughness: 0.95 });
  const windows = new THREE.MeshStandardMaterial({
    color: "#ffca85", emissive: "#ff9b40", emissiveIntensity: 1.35, roughness: 0.68
  });
  for (const [index, [x, z, heading]] of sites.entries()) {
    const house = new THREE.Group();
    house.position.set(cx + x, 0, cz + z);
    house.rotation.y = heading;
    parent.add(house);
    const part = (surface, width, height, depth, px, py, pz) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), surface);
      box.position.set(px, py, pz);
      house.add(box);
      return box;
    };
    part(stone, 3.18, 0.24, 2.67, 0, 0.12, 0);
    part(plaster, 2.92, 1.81, 2.43, 0, 1.12, 0).castShadow = true;
    const pitch = Math.atan2(0.74, 1.17);
    for (const side of [-1, 1]) {
      const tiles = part(roof, 3.36, 0.15, 1.65, 0, 2.36, side * 0.66);
      tiles.rotation.x = side * pitch;
      part(timber, 3.31, 0.13, 0.12, 0, 1.99, side * 1.34);
      for (const px of [-1.32, 1.32]) part(timber, 0.12, 1.77, 0.10, px, 1.1, side * 1.23);
      for (const px of [-0.89, 0.85]) {
        part(timber, 0.60, 0.55, 0.075, px, 1.31, side * 1.237);
        part(windows, 0.42, 0.38, 0.048, px, 1.31, side * 1.282);
        part(timber, 0.047, 0.39, 0.049, px, 1.31, side * 1.312);
      }
    }
    const gable = new THREE.Shape();
    gable.moveTo(-1.22, 0);
    gable.lineTo(1.22, 0);
    gable.lineTo(0, 0.69);
    gable.closePath();
    const loft = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 2.92, bevelEnabled: false }), plaster);
    loft.rotation.y = Math.PI / 2;
    loft.position.set(-1.46, 2.02, 0);
    house.add(loft);
    part(timber, 3.43, 0.13, 0.16, 0, 2.83, 0);
    part(timber, 0.57, 1.29, 0.085, 0, 0.86, -1.26);
    part(stone, 0.97, 0.15, 0.37, 0, 0.075, -1.41);

    for (let i = 0; i < 5; i++) {
      const angle = Math.atan2(z, x) + (i - 2) * 0.24;
      const distance = 2.65 + i * 0.58;
      rock.position.set(cx + x + Math.cos(angle) * distance, -0.11, cz + z + Math.sin(angle) * distance);
      rock.rotation.set(i * 0.31, heading + i * 2.39996, i * 0.21);
      rock.scale.set(0.38 + (i % 3) * 0.32, 0.37 + (i % 4) * 0.17, 0.37 + (i % 2) * 0.25);
      rock.updateMatrix();
      boulders.setMatrixAt(index * 5 + i, rock.matrix);
    }
  }
  boulders.receiveShadow = true;
  parent.add(boulders);
}

function foliageGeometry() {
  const vertices = [];
  const colors = [];
  for (let i = 0; i < 104; i++) {
    const angle = i * 2.39996;
    const elevation = 1 - 2 * (i + 0.5) / 104;
    const radial = Math.sqrt(1 - elevation ** 2) * (0.46 + (i * 0.271 % 1) * 0.52);
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    const y = elevation * 0.69;
    const span = 0.16 + (i % 4) * 0.035;
    const acrossX = -Math.sin(angle) * span * 0.54;
    const acrossZ = Math.cos(angle) * span * 0.54;
    const left = [x + acrossX, y, z + acrossZ];
    const right = [x - acrossX, y, z - acrossZ];
    const stem = [x * 0.85, y - span * 0.26, z * 0.85];
    const mid = [x, y + span * 0.26, z];
    const tip = [x + span * Math.cos(angle), y + span * 0.12, z + span * Math.sin(angle)];
    vertices.push(...stem, ...left, ...mid, ...stem, ...mid, ...right, ...left, ...tip, ...mid, ...mid, ...tip, ...right);
    for (let j = 0; j < 12; j++) {
      const light = 0.68 + (i % 6) * 0.077 + (j % 3 === 2 ? 0.09 : 0);
      colors.push(light * 0.86, light, light * 0.85);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addCoastalTrees(parent, cx, cz, radius, time) {
  const trees = 11;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.24, 1, 8),
    new THREE.MeshStandardMaterial({ color: "#514239", roughness: 1 }), trees * 9);
  const foliage = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide, vertexColors: true, emissive: "#142c23", emissiveIntensity: 0.24
  });
  foliage.onBeforeCompile = shader => {
    shader.uniforms.leafTime = time;
    shader.vertexShader = "uniform float leafTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `
      #include <begin_vertex>
      float phase = leafTime * 2.6 + instanceMatrix[3].x * 0.45 + instanceMatrix[3].z * 0.32;
      transformed.x += sin(phase) * (position.y + 1.1) * 0.11;
      transformed.y += cos(phase + position.x * 9.0) * 0.045;
    `);
  };
  const leaves = new THREE.InstancedMesh(foliageGeometry(), foliage, trees * 7);
  const limb = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const colors = ["#3a5e49", "#38584a", "#54734a", "#405c48"].map(color => new THREE.Color(color));
  for (let i = 0; i < trees; i++) {
    const angle = 0.42 + i * Math.PI * 2 / trees;
    const distance = radius * (0.86 + (i % 3) * 0.038);
    const scale = 0.72 + (i % 5) * 0.095;
    const x = cx + Math.cos(angle) * distance;
    const z = cz + Math.sin(angle) * distance;
    for (let branch = 0; branch < 9; branch++) {
      const spread = branch === 0 ? 0.18 : branch < 4 ? 1.62 : 1.0;
      const pitch = angle + branch * 2.39996;
      const height = branch === 0 ? 2.9 : branch < 4 ? 1.43 : 0.9;
      const base = branch === 0 ? 0 : branch < 4 ? 1.35 + branch * 0.18 : 2 + branch % 3 * 0.20;
      const thickness = branch === 0 ? 1 : branch < 4 ? 0.65 : 0.33;
      direction.set(Math.cos(pitch) * spread, height, Math.sin(pitch) * spread);
      limb.position.set(x + direction.x * 0.5 * scale,
        (direction.y * 0.5 + base) * scale, z + direction.z * 0.5 * scale);
      limb.scale.set(scale * thickness, direction.length() * scale, scale * thickness);
      limb.quaternion.setFromUnitVectors(up, direction.normalize());
      limb.updateMatrix();
      trunks.setMatrixAt(i * 9 + branch, limb.matrix);
    }
    for (let crown = 0; crown < 7; crown++) {
      const a = angle + crown * 2.39996;
      const r = crown ? 0.95 + (crown % 3) * 0.19 : 0;
      limb.position.set(x + Math.cos(a) * r * scale, (3.03 + (1 - r) * 0.45 + crown % 3 * 0.13) * scale,
        z + Math.sin(a) * r * scale);
      limb.rotation.set(crown * 0.28, a, crown * 0.19);
      limb.scale.set(scale * (1 + crown % 3 * 0.16), scale * 0.81, scale * 1.08);
      limb.updateMatrix();
      leaves.setMatrixAt(i * 7 + crown, limb.matrix);
      leaves.setColorAt(i * 7 + crown, colors[(i + crown) % colors.length]);
    }
  }
  trunks.castShadow = true;
  leaves.receiveShadow = true;
  parent.add(trunks, leaves);
}

export function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.36)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function makeTurfTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#dce6e1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 720; i++) {
    const x = i * 179.391 % canvas.width;
    const y = i * i * 21.371 % canvas.height;
    const size = 3 + i * 0.173 % 30;
    const patch = ctx.createRadialGradient(x, y, 0, x, y, size);
    patch.addColorStop(0, i % 3 ? "#70898432" : "#f8e4bc8c");
    patch.addColorStop(1, "#8da19a00");
    ctx.fillStyle = patch;
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  }
  const detail = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let random = 7411;
  for (let i = 0; i < detail.data.length; i += 4) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const grain = (random >>> 27) - 18;
    for (let channel = 0; channel < 3; channel++) detail.data[i + channel] += grain;
  }
  ctx.putImageData(detail, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

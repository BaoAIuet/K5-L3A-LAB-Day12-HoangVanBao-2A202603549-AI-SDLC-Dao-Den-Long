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

export function createAtmosphere(scene, parent, night) {
  const [zenith, horizon, water, turf] = palettes[night - 1];
  scene.fog.color.set(horizon);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 40, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { zenith: { value: new THREE.Color(zenith) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: vertex,
    fragmentShader: `
      varying vec3 worldPoint;
      uniform vec3 zenith;
      uniform vec3 horizon;
      void main() {
        vec3 ray = normalize(worldPoint - cameraPosition);
        float height = smoothstep(0.0, 0.58, ray.y);
        float glow = max(dot(ray, ${moon}), 0.0);
        vec3 color = mix(horizon, zenith, height);
        color += vec3(0.15, 0.23, 0.34) * pow(glow, 28.0);
        color += vec3(0.84, 0.91, 1.0) * smoothstep(0.9992, 0.9994, glow);
        vec2 grid = ray.xz / max(0.12, ray.y + 0.42) * 150.0;
        float star = fract(sin(dot(floor(grid), vec2(127.1, 311.7))) * 43758.5453);
        color += vec3(0.56, 0.72, 0.88) * step(0.985, star)
          * (1.0 - smoothstep(0.02, 0.20, length(fract(grid) - 0.5)))
          * smoothstep(0.07, 0.28, ray.y);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  parent.add(sky);

  const cliffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1), new THREE.MeshStandardMaterial({
    color: "#203b50", flatShading: true, roughness: 1
  }), 22);
  const cliff = new THREE.Object3D();
  for (let i = 0; i < cliffs.count; i++) {
    const angle = i * 2.39996 + night * 0.42;
    const distance = 100 + i % 4 * 8;
    cliff.position.set(25 + Math.cos(angle) * distance, -9, Math.sin(angle) * distance);
    cliff.scale.set(11 + i % 3 * 4, 12 + i % 6 * 2.7, 8 + i % 3 * 3);
    cliff.rotation.y = angle;
    cliff.updateMatrix();
    cliffs.setMatrixAt(i, cliff.matrix);
  }
  parent.add(cliffs);

  const time = { value: 0 };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShaderMaterial({
    uniforms: { time, water: { value: new THREE.Color(water) }, horizon: { value: new THREE.Color(horizon) } },
    vertexShader: vertex,
    fragmentShader: `
      uniform float time;
      uniform vec3 water;
      uniform vec3 horizon;
      varying vec3 worldPoint;
      void main() {
        vec2 p = worldPoint.xz;
        float wave = sin(p.x * 0.67 + p.y * 1.22 + time * 1.3)
          + 0.35 * sin(p.x * 1.1 - p.y * 2.5 - time * 0.9);
        float ripples = smoothstep(0.83, 1.28, wave);
        vec3 ray = normalize(worldPoint - cameraPosition);
        float reflection = pow(max(dot(normalize(ray.xz), normalize((${moon}).xz)), 0.0), 14.0);
        vec3 color = water * (0.78 + 0.18 * wave)
          + vec3(0.07, 0.13, 0.18) * ripples * (0.22 + reflection);
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

export function dressIsland(parent, cx, cz, radius) {
  const count = 216;
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.19, 0.65, 3), new THREE.MeshStandardMaterial({
    color: "#ffffff", roughness: 1, flatShading: true
  }), count);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1), new THREE.MeshStandardMaterial({
    color: "#797887", roughness: 1, flatShading: true
  }), 24);
  const transform = new THREE.Object3D();
  const grassColors = ["#386c61", "#567a63", "#71907b", "#284e52"].map(color => new THREE.Color(color));
  for (let i = 0; i < count; i++) {
    const angle = i * 2.39996 + cx * 0.13;
    const spread = 0.16 + Math.sqrt(i * 0.317 % 1) * 0.79;
    transform.position.set(cx + Math.cos(angle) * radius * spread, 0.19, cz + Math.sin(angle) * radius * spread);
    transform.rotation.set(0.2 * Math.sin(i), angle, 0.24);
    transform.scale.setScalar(0.55 + (i * 0.41 % 1) * 0.75);
    transform.updateMatrix();
    grass.setMatrixAt(i, transform.matrix);
    grass.setColorAt(i, grassColors[i % grassColors.length]);
    if (i >= rocks.count) continue;
    transform.position.set(cx + Math.cos(angle) * radius * 0.992, -0.34, cz + Math.sin(angle) * radius * 0.992);
    transform.rotation.set(angle, angle * 2, 0.4);
    transform.scale.set(0.61 + (i % 3) * 0.17, 0.48, 0.78);
    transform.updateMatrix();
    rocks.setMatrixAt(i, transform.matrix);
  }
  grass.receiveShadow = true;
  rocks.receiveShadow = true;
  parent.add(grass, rocks);
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
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

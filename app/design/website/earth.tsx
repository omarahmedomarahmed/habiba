"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The planet, as it looks: NASA's Blue Marble by day and Black Marble by night,
 * blended across a real terminator, with drifting clouds, a sun glint on the
 * sea and a teal atmosphere at the rim. Where a therapist is free right now a
 * point pulses, and an arc travels from a patient to the person who will
 * answer. Dragging turns it; with reduced motion it holds still.
 *
 * Textures are public-domain NASA imagery, served from our own origin
 * (public/design/earth/SOURCE.txt), so the page depends on nobody else's CDN.
 */
const LIVE: Array<[number, number]> = [
  [30.04, 31.24], // Cairo
  [31.2, 29.92], // Alexandria
  [25.2, 55.27], // Dubai
  [24.71, 46.68], // Riyadh
  [51.5, -0.12], // London
  [33.89, 35.5], // Beirut
  [31.95, 35.93], // Amman
];
const PATIENTS: Array<[number, number]> = [
  [27.18, 31.18], // Asyut
  [48.85, 2.35], // Paris
  [29.37, 47.98], // Kuwait
  [36.8, 10.18], // Tunis
];

function toVec(lat: number, lng: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float cloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec3 n = normalize(vNormalW);
    float light = dot(n, normalize(sunDir));
    float dayMix = smoothstep(-0.18, 0.28, light);

    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    float cloud = texture2D(cloudMap, vUv + vec2(cloudShift, 0.0)).r;

    // Oceans: blue dominant in the Blue Marble, so they catch the sun.
    float water = smoothstep(0.02, 0.12, day.b - max(day.r, day.g) * 0.85);
    vec3 h = normalize(normalize(sunDir) + normalize(vViewDir));
    float glint = pow(max(dot(n, h), 0.0), 60.0) * water * 0.9;

    vec3 lit = day * (0.25 + 0.95 * max(light, 0.0)) + vec3(1.0, 0.95, 0.85) * glint;
    lit = mix(lit, vec3(1.0), smoothstep(0.25, 0.9, cloud) * 0.55 * max(light + 0.15, 0.0));

    // City lights, warm, only on the night side and dimmed under cloud.
    vec3 cities = pow(night, vec3(1.4)) * vec3(1.4, 1.1, 0.75) * 2.6 * (1.0 - smoothstep(0.3, 0.9, cloud) * 0.7);
    vec3 dark = vec3(0.012, 0.03, 0.06) + cities;

    vec3 color = mix(dark, lit, dayMix);

    // A thin teal rim where the air is thickest against the dark.
    float rim = pow(1.0 - max(dot(n, normalize(vViewDir)), 0.0), 3.0);
    color += vec3(0.18, 0.77, 0.71) * rim * (0.25 + 0.75 * dayMix) * 0.45;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float fres = pow(max(0.0, 0.62 - dot(normalize(vNormalW), normalize(vViewDir))), 4.0);
    float lit = 0.35 + 0.65 * smoothstep(-0.4, 0.6, dot(normalize(vNormalW), normalize(sunDir)));
    gl_FragColor = vec4(0.18, 0.77, 0.71, 1.0) * fres * lit * 2.2;
  }
`;

export default function Earth({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity 1.2s ease";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.35, 8.6);

    // Tilted like the real axis, turned so the Middle East faces us at dusk.
    const world = new THREE.Group();
    world.rotation.set(0.28, -2.65, 0.0);
    scene.add(world);

    const R = 2;
    const loader = new THREE.TextureLoader();
    let loaded = 0;
    const onLoad = () => {
      loaded += 1;
      if (loaded === 3) renderer.domElement.style.opacity = "1";
    };
    const tex = (src: string, srgb: boolean) => {
      const t = loader.load(src, onLoad);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    // The sun from the right, so the terminator runs across the Gulf at dusk and Cairo is lighting up.
    const sunDir = new THREE.Vector3(1.0, 0.35, 0.45).normalize();

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: tex("/design/earth/day.jpg", true) },
        nightMap: { value: tex("/design/earth/night.jpg", true) },
        cloudMap: { value: tex("/design/earth/clouds.jpg", false) },
        sunDir: { value: sunDir },
        cloudShift: { value: 0 },
      },
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
    });
    world.add(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 128), earthMat));

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.1, 96, 96),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { sunDir: { value: sunDir } },
        vertexShader: EARTH_VERT,
        fragmentShader: HALO_FRAG,
      }),
    );
    scene.add(halo);

    // Stars, sparse and faint, so the dark around the planet is space and not a panel.
    const starCount = 900;
    const stars = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
      stars.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb6cc, size: 0.06, transparent: true, opacity: 0.7 })));

    // Therapists free now.
    const pulses: Array<{ ring: THREE.Mesh; phase: number }> = [];
    for (const [lat, lng] of LIVE) {
      const at = toVec(lat, lng, R * 1.004);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), new THREE.MeshBasicMaterial({ color: 0x7ff0e0 }));
      dot.position.copy(at);
      world.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.038, 48),
        new THREE.MeshBasicMaterial({ color: 0x2ec4b6, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.position.copy(at);
      ring.lookAt(at.clone().multiplyScalar(2));
      world.add(ring);
      pulses.push({ ring, phase: Math.random() });
    }

    // Patient to therapist, drawn as travelled, with a bright head.
    const arcs: Array<{ line: THREE.Line; head: THREE.Mesh; points: THREE.Vector3[]; phase: number }> = [];
    PATIENTS.forEach(([lat, lng], index) => {
      const a = toVec(lat, lng, R);
      const [tl, tg] = LIVE[index % LIVE.length]!;
      const b = toVec(tl, tg, R);
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.08 + a.distanceTo(b) * 0.18));
      const points = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(90);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      geometry.setDrawRange(0, 0);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x9ae9de, transparent: true, opacity: 0.85 }));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      world.add(line, head);
      arcs.push({ line, head, points, phase: index * 0.4 });
    });

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let spinX = 0;
    let spinY = 0;
    const down = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      spinY = (event.clientX - lastX) * 0.005;
      spinX = (event.clientY - lastY) * 0.003;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const up = () => {
      dragging = false;
      el.style.cursor = "grab";
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    // Only draw while on screen: the hero is one section of a long page.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    io.observe(el);

    let frame = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      const t = clock.getElapsedTime();
      if (!reduce) {
        world.rotation.y += 0.0009;
        earthMat.uniforms.cloudShift!.value = t * 0.0018;
      }
      world.rotation.y += spinY;
      world.rotation.x = Math.max(-0.3, Math.min(0.8, world.rotation.x + spinX));
      spinX *= 0.9;
      spinY *= 0.92;

      for (const pulse of pulses) {
        const p = (t * 0.55 + pulse.phase) % 1;
        pulse.ring.scale.setScalar(1 + p * 3);
        (pulse.ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - p) * (1 - p);
      }
      for (const arc of arcs) {
        const p = reduce ? 1 : Math.min(1, ((t * 0.3 + arc.phase) % 1.7) / 1.2);
        const n = Math.max(1, Math.floor(p * arc.points.length));
        arc.line.geometry.setDrawRange(0, n);
        arc.head.position.copy(arc.points[Math.min(n, arc.points.length - 1)]!);
        arc.head.visible = p < 1;
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      io.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      for (const u of Object.values(earthMat.uniforms)) {
        if (u.value instanceof THREE.Texture) u.value.dispose();
      }
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={host}
      className={className}
      style={{ touchAction: "pan-y", cursor: "grab" }}
      aria-label="The Earth at dusk over Cairo, with therapists who are free right now pulsing on it"
      role="img"
    />
  );
}

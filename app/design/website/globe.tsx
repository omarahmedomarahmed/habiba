"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The radar, as a globe: a sphere of navy-and-teal points, with a pulse where a
 * therapist is free right now and an arc from a patient to the person who will
 * answer. It turns slowly and follows the pointer when dragged. With reduced
 * motion it holds still and only the pulses fade in and out.
 */
const LIVE: Array<[number, number]> = [
  [30.04, 31.24], // Cairo
  [31.2, 29.92], // Alexandria
  [25.2, 55.27], // Dubai
  [24.71, 46.68], // Riyadh
  [51.5, -0.12], // London
  [40.71, -74.0], // New York
];
const PATIENTS: Array<[number, number]> = [
  [29.98, 31.13],
  [26.82, 30.8],
  [48.85, 2.35],
];

function toVec(lat: number, lng: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

export default function Globe({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.3, 8.4);

    const world = new THREE.Group();
    world.rotation.set(0.35, -2.3, 0);
    scene.add(world);

    const R = 2;

    // The sphere itself: a dark core so the far side of the dots is hidden.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x07182e }),
    );
    world.add(core);

    // A fibonacci lattice of points reads as a globe without needing a map.
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const navy = new THREE.Color(0x4a5d72);
    const teal = new THREE.Color(0x2ec4b6);
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      positions.set([Math.cos(theta) * radius * R, y * R, Math.sin(theta) * radius * R], i * 3);
      const c = Math.random() < 0.08 ? teal : navy;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dots.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    world.add(new THREE.Points(dots, new THREE.PointsMaterial({ size: 0.028, vertexColors: true, transparent: true, opacity: 0.9 })));

    // An atmosphere: a back-facing shell that glows teal at the rim.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.18, 64, 64),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.18,0.77,0.71,1.0)*i; }",
      }),
    );
    scene.add(halo);

    // Live therapists: a bright point and a ring that pulses outward.
    const pulses: Array<{ ring: THREE.Mesh; phase: number }> = [];
    for (const [lat, lng] of LIVE) {
      const at = toVec(lat, lng, R * 1.005);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: 0x5fdccc }));
      dot.position.copy(at);
      world.add(dot);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.05, 0.062, 48),
        new THREE.MeshBasicMaterial({ color: 0x2ec4b6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      ring.position.copy(at);
      ring.lookAt(at.clone().multiplyScalar(2));
      world.add(ring);
      pulses.push({ ring, phase: Math.random() });
    }

    // Arcs from a patient to the therapist who will answer, drawn as they are travelled.
    const arcs: Array<{ line: THREE.Line; total: number; phase: number }> = [];
    PATIENTS.forEach(([lat, lng], index) => {
      const a = toVec(lat, lng, R);
      const b = toVec(LIVE[index]![0], LIVE[index]![1], R);
      const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * (1.25 + a.distanceTo(b) * 0.12));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const points = curve.getPoints(80);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x9ae9de, transparent: true, opacity: 0.9 }));
      geometry.setDrawRange(0, 0);
      world.add(line);
      arcs.push({ line, total: points.length, phase: index * 0.33 });
    });

    // Size to the host, and keep sizing to it.
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

    // Drag to turn it; it eases back to its own slow turn when let go.
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
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    let frame = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (!reduce) world.rotation.y += 0.0012;
      world.rotation.y += spinY;
      world.rotation.x = Math.max(-0.4, Math.min(0.9, world.rotation.x + spinX));
      spinX *= 0.9;
      spinY *= 0.92;

      for (const pulse of pulses) {
        const p = (t * 0.6 + pulse.phase) % 1;
        pulse.ring.scale.setScalar(1 + p * 2.2);
        (pulse.ring.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - p) * (1 - p);
      }
      for (const arc of arcs) {
        const p = reduce ? 1 : Math.min(1, ((t * 0.35 + arc.phase) % 1.6) / 1.1);
        arc.line.geometry.setDrawRange(0, Math.floor(p * arc.total));
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
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
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={host} className={className} style={{ touchAction: "pan-y", cursor: "grab" }} aria-label="A globe with therapists who are free right now" role="img" />;
}

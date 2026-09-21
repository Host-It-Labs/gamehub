'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Pin } from '@/lib/games/party/geography';
export type MapPin = Pin & { label: string; color: string; answer?: boolean };
const vector = (p: Pin, radius = 1) => {
  const lat = THREE.MathUtils.degToRad(p.lat),
    lng = THREE.MathUtils.degToRad(p.lng);
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lng),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lng),
  ).multiplyScalar(radius);
};
const location = (v: THREE.Vector3): Pin => ({
  lat: THREE.MathUtils.radToDeg(
    Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1)),
  ),
  lng: THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x)),
});
export function GeoPinMap({
  pins,
  onPin,
}: {
  pins: MapPin[];
  onPin?: (pin: Pin) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<{
    reset: () => void;
    pins: (p: MapPin[]) => void;
  } | null>(null);
  const pick = useRef(onPin);
  const [status, setStatus] = useState('Loading satellite imagery…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    pick.current = onPin;
  }, [onPin]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() =>
        setStatus(
          'The globe needs WebGL. Enable hardware acceleration or try another browser.',
        ),
      );
      return;
    }
    let disposed = false,
      loaded = false;
    const scene = new THREE.Scene();
    renderer.setClearColor(0x000000, 0);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.005, 20);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'Satellite globe. Drag to rotate; pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, Enter places a pin at the crosshair. Home resets the globe.',
    );
    container.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.minDistance = 1.15;
    controls.maxDistance = 8;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const geometry = new THREE.SphereGeometry(1, 128, 96);
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    const render = () => {
      if (!disposed) renderer.render(scene, camera);
    };
    const texture = new THREE.TextureLoader().load(
      '/maps/earth-satellite.jpg',
      () => {
        if (disposed) {
          texture.dispose();
          return;
        }
        loaded = true;
        setStatus('');
        render();
      },
      undefined,
      () => {
        if (!disposed)
          setStatus('Satellite imagery could not load. Retry the globe.');
      },
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material.map = texture;
    const markers = new THREE.Group();
    scene.add(markers);
    function clearPins() {
      while (markers.children.length) {
        const child = markers.children[0];
        const sprite = child as THREE.Sprite;
        sprite.material.map?.dispose();
        sprite.material.dispose();
        markers.remove(sprite);
      }
    }
    function updatePins(next: MapPin[]) {
      clearPins();
      for (const pin of next) {
        const label = document.createElement('canvas');
        label.width = label.height = 64;
        const ctx = label.getContext('2d');
        if (!ctx) continue;
        ctx.beginPath();
        ctx.arc(32, 32, 24, 0, Math.PI * 2);
        ctx.fillStyle = pin.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = pin.answer ? '#173f40' : '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pin.answer ? '★' : pin.label.slice(0, 1), 32, 33);
        const map = new THREE.CanvasTexture(label);
        map.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ map, sizeAttenuation: false }),
        );
        sprite.position.copy(vector(pin, 1.008));
        sprite.scale.set(0.045, 0.045, 1);
        markers.add(sprite);
      }
      render();
    }
    function reset() {
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      const fit =
        1.04 /
        Math.sin(Math.atan(Math.tan(halfFov) * Math.min(1, camera.aspect)));
      controls.maxDistance = Math.max(8, fit);
      camera.position.copy(vector({ lat: 18, lng: 8 }, fit));
      controls.update();
      render();
    }
    let previousFit = 0;
    function fitDistance() {
      const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
      return (
        1.04 /
        Math.sin(Math.atan(Math.tan(halfFov) * Math.min(1, camera.aspect)))
      );
    }
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const fit = fitDistance();
      if (!previousFit) reset();
      else {
        // Preserve rotation and relative zoom across orientation changes.
        controls.maxDistance = Math.max(8, fit);
        camera.position.setLength(
          THREE.MathUtils.clamp(
            (camera.position.length() * fit) / previousFit,
            controls.minDistance,
            controls.maxDistance,
          ),
        );
        controls.update();
      }
      previousFit = fit;
      render();
    });
    resize.observe(container);
    controls.addEventListener('change', render);
    const ray = new THREE.Raycaster();
    function place(x: number, y: number) {
      if (!loaded) return;
      ray.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = ray.intersectObject(earth)[0];
      if (hit) pick.current?.(location(hit.point));
    }
    const pointers = new Set<number>();
    let start: { x: number; y: number; moved: boolean } | null = null;
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size === 1 && e.button === 0)
        start = { x: e.clientX, y: e.clientY, moved: false };
      else if (start) start.moved = true;
    };
    const move = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5)
        start.moved = true;
    };
    const up = (e: PointerEvent) => {
      if (start && !start.moved && pointers.size === 1) {
        const box = canvas.getBoundingClientRect();
        place(
          ((e.clientX - box.left) / box.width) * 2 - 1,
          1 - ((e.clientY - box.top) / box.height) * 2,
        );
      }
      pointers.delete(e.pointerId);
      if (!pointers.size) start = null;
    };
    const cancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (start) start.moved = true;
    };
    const key = (e: KeyboardEvent) => {
      if (
        ![
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
          'Enter',
          ' ',
          'Home',
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      if (e.key === 'Home') {
        reset();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        place(0, 0);
        return;
      }
      const p = location(camera.position),
        radius = camera.position.length();
      const step = (e.shiftKey ? 0.2 : 3) * Math.min(1, radius - 1);
      if (e.key.startsWith('Arrow')) {
        p.lng +=
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        p.lat = THREE.MathUtils.clamp(
          p.lat +
            (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0),
          -89,
          89,
        );
        camera.position.copy(vector(p, radius));
      } else
        camera.position.setLength(
          THREE.MathUtils.clamp(
            radius * (e.key === '-' ? 1.2 : 1 / 1.2),
            controls.minDistance,
            controls.maxDistance,
          ),
        );
      controls.update();
      render();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('keydown', key);
    const lost = (e: Event) => {
      e.preventDefault();
      setStatus('The graphics connection was lost. Retry the globe.');
    };
    canvas.addEventListener('webglcontextlost', lost);
    actions.current = { reset, pins: updatePins };
    return () => {
      disposed = true;
      actions.current = null;
      resize.disconnect();
      controls.dispose();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', lost);
      clearPins();
      texture.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [attempt]);
  useEffect(() => {
    actions.current?.pins(pins);
  }, [pins, attempt]);
  return (
    <div className="atlas-map-shell">
      <div ref={host} className="atlas-pin-map">
        {onPin && (
          <span className="atlas-globe-crosshair" aria-hidden="true">
            +
          </span>
        )}
      </div>
      {status && (
        <output className="atlas-map-error">
          {status}
          {!status.startsWith('Loading') && (
            <button
              onClick={() => {
                setStatus('Loading satellite imagery…');
                setAttempt((a) => a + 1);
              }}
            >
              Retry globe
            </button>
          )}
        </output>
      )}
    </div>
  );
}

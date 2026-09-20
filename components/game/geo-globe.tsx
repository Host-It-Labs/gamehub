'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export type MapPin = {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
};
export function globeVector(pin: MapPin, radius = 1.015) {
  const phi = ((90 - pin.lat) * Math.PI) / 180,
    theta = ((pin.lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.cos(theta) * Math.sin(phi),
    radius * Math.cos(phi),
    radius * Math.sin(theta) * Math.sin(phi),
  );
}
export function GeoGlobe({ pins }: { pins: MapPin[] }) {
  const host = useRef<HTMLDivElement>(null),
    updatePins = useRef<((pins: MapPin[]) => void) | null>(null);
  const [fallback, setFallback] = useState(false),
    [polygons, setPolygons] = useState<number[][][][]>([]),
    [mapError, setMapError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/maps/world.json', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Map unavailable');
        return r.json();
      })
      .then(setPolygons)
      .catch(() => {
        if (!abort.signal.aborted) setMapError(true);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!host.current || !polygons.length) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() => setFallback(true));
      return;
    }
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.copy(globeVector({ lat: 18, lng: 8 }, 3.5));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      'aria-label',
      'World globe. Drag to rotate, scroll or pinch to zoom. Keyboard: arrow keys rotate; plus and minus zoom.',
    );
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 1.4;
    controls.maxDistance = 5;
    controls.enableDamping = false;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#133e5b';
    ctx.fillRect(0, 0, 2048, 1024);
    ctx.strokeStyle = '#316680';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 2048; x += 2048 / 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += 1024 / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(2048, y);
      ctx.stroke();
    }
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lng, lat], i) => {
          const x = ((lng + 180) / 360) * 2048,
            y = ((90 - lat) / 180) * 1024;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fillStyle = '#ddd5a9';
      ctx.fill('evenodd');
      ctx.strokeStyle = '#8b9776';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.SphereGeometry(1, 96, 64),
      material = new THREE.MeshBasicMaterial({ map: texture }),
      globe = new THREE.Mesh(geometry, material),
      markers = new THREE.Group();
    scene.add(globe, markers);
    const render = () => renderer.render(scene, camera);
    let frame = 0,
      signature = '';
    const cancel = () => cancelAnimationFrame(frame);
    function clearMarkers() {
      while (markers.children.length) {
        const child = markers.children[0] as THREE.Mesh;
        markers.remove(child);
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    updatePins.current = (values) => {
      const next = JSON.stringify(values);
      if (next === signature) return;
      signature = next;
      cancel();
      clearMarkers();
      values.forEach((pin, i) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.019, 12, 8),
          new THREE.MeshBasicMaterial({ color: pin.color ?? '#ff694f' }),
        );
        marker.position.copy(globeVector(pin));
        markers.add(marker);
        if (i > 0) {
          const a = globeVector(values[i - 1], 1),
            b = globeVector(pin, 1),
            points = Array.from({ length: 49 }, (_, j) =>
              a
                .clone()
                .lerp(b, j / 48)
                .normalize()
                .multiplyScalar(1.008),
            );
          markers.add(
            new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(points),
              new THREE.LineBasicMaterial({
                color: '#ffd36b',
                transparent: true,
                opacity: 0.75,
              }),
            ),
          );
        }
      });
      if (values.length) {
        const start = camera.position.clone().normalize(),
          end = globeVector(values[0], 1),
          rotation = new THREE.Quaternion().setFromUnitVectors(start, end);
        const beginning = performance.now(),
          duration = window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 0
            : 650;
        const animate = (now: number) => {
          const t = duration ? Math.min(1, (now - beginning) / duration) : 1,
            eased = 1 - (1 - t) ** 3;
          camera.position
            .copy(start)
            .applyQuaternion(new THREE.Quaternion().slerp(rotation, eased))
            .multiplyScalar(3.5);
          controls.update();
          render();
          if (t < 1) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      } else render();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        ![
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
        ].includes(event.key)
      )
        return;
      event.preventDefault();
      cancel();
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      if (event.key === 'ArrowLeft') spherical.theta -= 0.15;
      if (event.key === 'ArrowRight') spherical.theta += 0.15;
      if (event.key === 'ArrowUp') spherical.phi -= 0.15;
      if (event.key === 'ArrowDown') spherical.phi += 0.15;
      if (event.key === '+' || event.key === '=')
        spherical.radius = Math.max(1.4, spherical.radius - 0.2);
      if (event.key === '-')
        spherical.radius = Math.min(5, spherical.radius + 0.2);
      spherical.makeSafe();
      camera.position.setFromSpherical(spherical);
      controls.update();
      render();
    };
    renderer.domElement.addEventListener('keydown', keyboard);
    controls.addEventListener('change', render);
    controls.addEventListener('start', cancel);
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    });
    resize.observe(container);
    const contextLost = (event: Event) => {
      event.preventDefault();
      cancel();
      setFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    controls.update();
    render();
    return () => {
      cancel();
      updatePins.current = null;
      resize.disconnect();
      controls.dispose();
      clearMarkers();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('keydown', keyboard);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.remove();
    };
  }, [polygons]);
  useEffect(() => {
    updatePins.current?.(pins);
  }, [pins, polygons]);
  return (
    <div className="geo-map">
      {mapError ? (
        <p>
          The globe could not load. You can still arrange the cities and see all
          answer coordinates below.
        </p>
      ) : (
        <div ref={host} className="geo-globe" hidden={fallback} />
      )}
      {fallback && (
        <svg
          className="geo-flat-map"
          viewBox="0 0 720 360"
          aria-label="World map and revealed route"
        >
          <title>World map and revealed route</title>
          <rect width="720" height="360" fill="#133e5b" />
          {polygons.map((polygon, i) => (
            <path
              key={i}
              fill="#ddd5a9"
              stroke="#8b9776"
              strokeWidth=".4"
              fillRule="evenodd"
              d={polygon
                .map(
                  (ring) =>
                    ring
                      .map(
                        ([lng, lat], j) =>
                          `${j ? 'L' : 'M'}${(lng + 180) * 2},${(90 - lat) * 2}`,
                      )
                      .join(' ') + 'Z',
                )
                .join(' ')}
            />
          ))}
          {pins.map((pin, i) => (
            <g key={i}>
              <circle
                cx={(pin.lng + 180) * 2}
                cy={(90 - pin.lat) * 2}
                r="4"
                fill={pin.color ?? '#ff694f'}
              />
              <title>{pin.label}</title>
            </g>
          ))}
        </svg>
      )}
      <p>
        Drag to spin · pinch or scroll to zoom · arrow keys rotate, +/− zoom
      </p>
      <small>
        Map:{' '}
        <a
          href="https://www.naturalearthdata.com/about/terms-of-use/"
          target="_blank"
          rel="noreferrer"
        >
          Natural Earth · public domain
        </a>
      </small>
    </div>
  );
}

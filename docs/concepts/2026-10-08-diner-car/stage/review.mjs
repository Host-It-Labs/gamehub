import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = new URL('./review/', import.meta.url);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'diner-stage-review-'));
const port = 9400 + (process.pid % 400);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
], { stdio: 'ignore' });
const deadline = setTimeout(() => { chrome.kill('SIGKILL'); process.exit(2); }, 240000);
let ws;
try {
  let tabs;
  for (let i = 0; i < 100 && !tabs; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(100); }
  }
  if (!tabs) throw new Error('Review Chrome did not launch');
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, f) => { ws.addEventListener('open', r); ws.addEventListener('error', f); });
  let seq = 0; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((r, f) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); f(new Error(`Timeout: ${method}`)); }, 30000);
    pending.set(id, (m) => { clearTimeout(timer); m.error ? f(new Error(m.error.message)) : r(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (m.exceptionDetails) throw new Error(m.exceptionDetails.exception?.description ?? m.exceptionDetails.text);
    return m.result.value;
  };
  const capture = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(new URL(`${name}.png`, out), Buffer.from(r.data, 'base64'));
    console.log(name);
  };
  const navigate = async (query, width = 1280, height = 720) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://localhost:3017/diner/lab?scene=stage&${query}` });
    for (let i = 0; i < 160; i++) {
      if (await evaluate('!!window.dinerLab?.scene')) return;
      const error = await evaluate('document.querySelector("pre")?.textContent');
      if (error) throw new Error(error);
      await sleep(150);
    }
    throw new Error('Lab not ready');
  };
  const mode = process.argv[2] ?? 'all';
  if (mode === 'assets' || mode === 'all') {
    await navigate('place=truckstop&quality=high', 1000, 680);
    await evaluate(`(async () => {
      window.reviewThree = await import('/node_modules/three/build/three.module.js');
      window.reviewCars = await import('/components/game/diner/diner-car.ts');
      window.reviewKit = await import('/components/game/diner/kit.ts');
      const lab = window.dinerLab;
      lab.scene.traverse(o => { if (o.name === 'stage' || o.parent === lab.scene && o.type === 'Group') o.visible = false; });
      window.reviewMats = window.reviewKit.makeMaterials();
    })()`);
    for (const detail of ['stage', 'map']) for (const asset of ['car', 'truck']) {
      await evaluate(`(() => {
        const T = window.reviewThree, lab = window.dinerLab;
        if (window.reviewAsset) { lab.scene.remove(window.reviewAsset.group); window.reviewAsset.dispose(); }
        window.reviewAsset = window.reviewCars.${asset === 'car' ? 'buildDinerCar' : 'buildTruck'}(window.reviewMats, { detail: '${detail}' });
        lab.scene.add(window.reviewAsset.group);
        window.reviewOriginal = [];
        window.reviewAsset.group.traverse(o => { if (o.isMesh) window.reviewOriginal.push([o, o.material]); });
        window.reviewClay = new T.MeshStandardMaterial({color: '#b3b6b7', roughness: .86});
        window.reviewAsset.group.traverse(o => { if (o.isMesh) o.material = window.reviewClay; });
      })()`);
      for (const angle of ['front', 'side', 'rear', 'three-quarter', 'colour']) {
        await evaluate(`(() => {
          const T = window.reviewThree, lab = window.dinerLab, asset = window.reviewAsset;
          if ('${angle}' === 'colour') for (const [mesh, mat] of window.reviewOriginal) mesh.material = mat;
          const b = new T.Box3().setFromObject(asset.group), c = b.getCenter(new T.Vector3()), size = b.getSize(new T.Vector3());
          const a = '${angle}', v = a === 'front' ? [-24, 5, 0] : a === 'side' ? [0, 5, 24] : a === 'rear' ? [24, 5, 0] : [-17, 10, 20];
          lab.camera.position.copy(c).add(new T.Vector3(...v)); lab.camera.lookAt(c);
          const scale = Math.max(size.x * .82, size.y * 1.5, 3.4);
          lab.camera.left = -scale; lab.camera.right = scale; lab.camera.top = scale * .68; lab.camera.bottom = -scale * .68;
          lab.camera.updateProjectionMatrix();
        })()`);
        await sleep(180); await capture(`${asset}-${detail}-${angle}`);
      }
    }
  }
  if (mode === 'stages' || mode === 'all') {
    const budgets = [];
    for (const place of ['truckstop', 'drivein', 'fairground', 'harbour', 'oldtown', 'moonmile']) {
      for (const quality of ['high', 'low']) {
        for (const [width, height] of quality === 'high' ? [[1280, 720], [390, 844]] : [[1280, 720]]) {
          await navigate(`place=${place}&quality=${quality}`, width, height);
          await sleep(500);
          const m = await evaluate(`(() => {
            const lab = window.dinerLab; const full = lab.info();
            lab.renderer.info.reset(); lab.renderer.render(lab.scene, lab.camera);
            return { full, direct: lab.info() };
          })()`);
          budgets.push({ place, quality, width, height, ...m });
          await capture(`${place}-${quality}-${width}x${height}`);
        }
      }
    }
    writeFileSync(new URL('renderer-budgets.json', out), JSON.stringify(budgets, null, 2));
    await navigate('place=fairground&quality=high');
    for (let i = 0; i < 6; i++) { await sleep(700); await capture(`motion-fairground-${i}`); }
    await navigate('place=harbour&quality=high');
    for (let i = 0; i < 4; i++) { await sleep(850); await capture(`motion-harbour-${i}`); }
    await navigate('place=moonmile&power=off&quality=low', 390, 844); await sleep(400); await capture('moonmile-brownout-phone');
    console.log(JSON.stringify(budgets));
  }
} finally {
  clearTimeout(deadline); ws?.close(); chrome.kill('SIGKILL');
  await sleep(250); rmSync(profile, { recursive: true, force: true });
}

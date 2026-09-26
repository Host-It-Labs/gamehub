import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameMotionController } from '../components/game/game-motion-controller.ts';

class Element {
  constructor(kind, key) {
    this.dataset = kind ? { gameMotion: kind, gameMotionKey: key } : {};
    this.children = [];
    this.animations = [];
    this.opacity = '1';
  }
  matches() { return this.dataset.gameMotion !== undefined; }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  setAttribute() {}
  removeAttribute() {}
  animate(frames, options) {
    const animation = { frames, options, cancelled: false, finished: new Promise(() => {}), cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
}

function environment(t, reduced = false) {
  const names = ['window', 'document', 'HTMLElement', 'MutationObserver', 'getComputedStyle'];
  const originals = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
  const preference = {
    matches: reduced,
    listeners: new Set(),
    addEventListener(_event, listener) { this.listeners.add(listener); },
    removeEventListener(_event, listener) { this.listeners.delete(listener); },
    change(matches) { this.matches = matches; for (const listener of this.listeners) listener(); },
  };
  let observer;
  const values = [
    { matchMedia: () => preference },
    { hidden: false },
    Element,
    class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
    (element) => ({ opacity: element.opacity, translate: 'none' }),
  ];
  names.forEach((name, i) => Object.defineProperty(globalThis, name, { value: values[i], configurable: true, writable: true }));
  t.after(() => names.forEach((name, i) => originals[i] ? Object.defineProperty(globalThis, name, originals[i]) : delete globalThis[name]));
  return { preference, mutation: (records) => observer.callback(records), get observer() { return observer; } };
}

await test('stage transitions retain elements and animate in place; only changed values replay', (t) => {
  environment(t);
  const root = new Element(), stage = new Element('stage'), score = new Element('change', '10');
  root.children = [stage, score];
  const motion = createGameMotionController(root);
  motion.update('choose');
  motion.update('choose');
  assert.equal(stage.animations.length, 1);
  assert.equal(score.animations.length, 1);
  score.dataset.gameMotionKey = '12';
  motion.update('reveal');
  assert.deepEqual(root.children, [stage, score]);
  assert.equal(stage.animations.length, 2);
  assert.equal(score.animations.length, 2);
  assert.ok(stage.animations.every((animation) => animation.frames.every((frame) => Object.keys(frame).every((key) => key === 'opacity'))));
  assert.equal(stage.animations[0].cancelled, true);
  motion.dispose();
});

await test('child-only updates animate new pieces, cancel removed pieces, and leave unrelated nodes alone', (t) => {
  const env = environment(t);
  const root = new Element(), existing = new Element('piece');
  root.children = [existing];
  const motion = createGameMotionController(root);
  motion.update('play');
  const added = new Element('piece'), unrelated = new Element();
  root.children.push(added, unrelated);
  env.mutation([{ type: 'childList', addedNodes: [added, unrelated] }]);
  assert.equal(existing.animations.length, 1);
  assert.equal(added.animations.length, 1);
  assert.equal(unrelated.animations.length, 0);
  assert.ok(added.animations[0].frames.every((frame) => !('transform' in frame)));
  root.children = [existing, unrelated];
  env.mutation([{ type: 'childList', addedNodes: [] }]);
  assert.equal(added.animations[0].cancelled, true);
  motion.dispose();
});

await test('reduced motion skips entrances and cancels in-flight motion immediately when enabled', (t) => {
  const env = environment(t, true);
  const root = new Element(), stage = new Element('stage');
  root.children = [stage];
  const motion = createGameMotionController(root);
  motion.update('choose');
  assert.equal(stage.animations.length, 0);
  env.preference.change(false);
  motion.update('reveal');
  assert.equal(stage.animations.length, 1);
  env.preference.change(true);
  assert.equal(stage.animations[0].cancelled, true);
  motion.update('next');
  assert.equal(stage.animations.length, 1);
  motion.dispose();
  assert.equal(env.preference.listeners.size, 0);
  assert.equal(env.observer.disconnected, true);
});

await test('large deals finish quickly, hidden values stay hidden, and unsupported animation is harmless', (t) => {
  environment(t);
  const root = new Element();
  root.children = Array.from({ length: 30 }, () => new Element('piece'));
  root.children[0].opacity = '0';
  root.children[1].animate = undefined;
  const motion = createGameMotionController(root);
  assert.doesNotThrow(() => motion.update('deal'));
  assert.equal(root.children[0].animations[0].frames.at(-1).opacity, 0);
  assert.equal(root.children[1].animations.length, 0);
  assert.ok(root.children.flatMap((child) => child.animations).every(({ options }) => options.delay + options.duration < 500));
  motion.dispose();
});

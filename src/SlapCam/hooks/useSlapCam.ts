import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from 'react';
import type { CharDef, CharId, ImpactFx, Screen, Sprite } from '../types';
import { duckBgm, playBlip, playBounce, playEnd, playSlap, preloadBgm, resumeAudio, startBgm, stopBgm } from '../utils/sounds';

import algramNormal from '../img/heads/algram_normal.png';
import algramSlapped from '../img/heads/algram_slapped.png';
import jennyNormal from '../img/heads/jenny_normal.png';
import jennySlapped from '../img/heads/jenny_slapped.png';
import jmfNormal from '../img/heads/jmf_normal.png';
import jmfSlapped from '../img/heads/jmf_slapped.png';
import ghostpixelNormal from '../img/heads/ghostpixel_normal.png';
import ghostpixelSlapped from '../img/heads/ghostpixel_slapped.png';
import isayaNormal from '../img/heads/isaya_normal.png';
import isayaSlapped from '../img/heads/isaya_slapped.png';
import isabelNormal from '../img/heads/isabel_normal.png';
import isabelSlapped from '../img/heads/isabel_slapped.png';

export const CHAR_DEFS: CharDef[] = [
  { id: 'algram',     username: 'Algram',     imgNormal: algramNormal,     imgSlapped: algramSlapped,     size: 170 },
  { id: 'jenny',      username: 'Jenny',      imgNormal: jennyNormal,      imgSlapped: jennySlapped,      size: 170 },
  { id: 'jmf',        username: 'JM·F',       imgNormal: jmfNormal,        imgSlapped: jmfSlapped,        size: 170 },
  { id: 'ghostpixel', username: 'ghostpixel', imgNormal: ghostpixelNormal, imgSlapped: ghostpixelSlapped, size: 170 },
  { id: 'isaya',      username: 'Isaya',      imgNormal: isayaNormal,      imgSlapped: isayaSlapped,      size: 170 },
  { id: 'isabel',     username: 'Isabel',     imgNormal: isabelNormal,     imgSlapped: isabelSlapped,     size: 170 },
];

/** Duration sprite shows the slapped expression after a hit, in ms */
export const SLAPPED_EXPR_MS = 700;

const GAME_DURATION_SEC = 30;
const BASE_SCORE = 10;
const COMBO_WINDOW_MS = 1500;
const MIN_SLAP_SPEED = 380;     // px/s — slower swipes don't count
const HIT_RADIUS_RATIO = 0.42;  // fraction of sprite size
const MAX_SPRITES = 6;
const INITIAL_SPRITES = 3;
const SPAWN_INTERVAL_MS = 4500;
const IMPACT_KINDS: ImpactFx['kind'][] = ['POW', 'SLAP', 'BAM', 'WHAM', 'BONK', 'OOF'];
const BEST_KEY = 'slap_cam_best';

function loadBest(): number {
  const raw = localStorage.getItem(BEST_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function rand(min: number, max: number) { return min + Math.random() * (max - min); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

export function useSlapCam(containerRef: RefObject<HTMLDivElement>) {
  const [screen, setScreen] = useState<Screen>('splash');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SEC);
  const [best, setBest] = useState<number>(loadBest());
  const [impacts, setImpacts] = useState<ImpactFx[]>([]);
  const [stats, setStats] = useState({ totalSlaps: 0, maxCombo: 0, finalScore: 0, isNewBest: false });
  // Bumped whenever sprites are added/removed — triggers React re-render of the list.
  // (Physics mutations during rAF do NOT bump this, so we don't re-render at 60fps.)
  const [, bumpSpriteList] = useReducer((x: number) => x + 1, 0);

  // ---- refs (high-frequency, mutated by rAF) ----
  const spritesRef = useRef<Sprite[]>([]);
  const spriteNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const pointerRef = useRef({
    x: 0, y: 0,
    vx: 0, vy: 0,
    down: false,
    lastMoveAt: 0,
    hasPos: false,
  });
  const comboRef = useRef({ count: 0, lastAt: 0, max: 0, total: 0 });
  const scoreRef = useRef(0);
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const gameStartRef = useRef(0);
  const lastSpawnAtRef = useRef(0);
  const uidRef = useRef(1);
  const containerSizeRef = useRef({ w: 0, h: 0 });
  const screenRef = useRef<Screen>('start');
  const lastWholeSecondRef = useRef(GAME_DURATION_SEC);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  // Resize tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      containerSizeRef.current = { w: r.width, h: r.height };
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  // ---- helpers ----
  const registerSpriteNode = useCallback((uid: number, el: HTMLDivElement | null) => {
    if (el) spriteNodesRef.current.set(uid, el);
    else spriteNodesRef.current.delete(uid);
  }, []);

  const spawnSprite = useCallback((charId?: CharId) => {
    const { w, h } = containerSizeRef.current;
    if (w === 0) return;
    const def = charId
      ? CHAR_DEFS.find(c => c.id === charId)!
      : CHAR_DEFS[spritesRef.current.length % CHAR_DEFS.length]!;
    const size = def.size;
    // spawn from a random edge so they "enter" the frame
    const edge = Math.floor(Math.random() * 4);
    let x = w / 2, y = h / 2, vx = 0, vy = 0;
    const speed = rand(120, 260);
    if (edge === 0) { x = rand(size, w - size); y = -size * 0.4; vy = speed; vx = rand(-120, 120); }
    else if (edge === 1) { x = w + size * 0.4; y = rand(size, h - size); vx = -speed; vy = rand(-120, 120); }
    else if (edge === 2) { x = rand(size, w - size); y = h + size * 0.4; vy = -speed; vx = rand(-120, 120); }
    else { x = -size * 0.4; y = rand(size, h - size); vx = speed; vy = rand(-120, 120); }

    spritesRef.current.push({
      uid: uidRef.current++,
      charId: def.id,
      x, y, vx, vy,
      rot: rand(-0.3, 0.3),
      angVel: rand(-2, 2),
      size,
      slapAge: 9999,
      pointerHoldMs: 0,
      pointerInside: false,
      bobPhase: rand(0, Math.PI * 2),
      stunMs: 0,
    });
    bumpSpriteList();
  }, []);

  const addImpact = useCallback((kind: ImpactFx['kind'], x: number, y: number, gain: number, comboLevel: number) => {
    const fx: ImpactFx = {
      uid: uidRef.current++,
      kind, x, y,
      rot: rand(-0.35, 0.35),
      bornAt: performance.now(),
      score: gain,
      combo: comboLevel,
    };
    setImpacts(prev => [...prev, fx]);
    // remove after animation
    setTimeout(() => {
      setImpacts(prev => prev.filter(p => p.uid !== fx.uid));
    }, 900);
  }, []);

  // ---- slap registration ----
  const tryRegisterSlap = useCallback((sprite: Sprite, now: number) => {
    const ptr = pointerRef.current;
    if (!ptr.down || !ptr.hasPos) return;
    const dx = ptr.x - sprite.x;
    const dy = ptr.y - sprite.y;
    const dist = Math.hypot(dx, dy);
    const radius = sprite.size * HIT_RADIUS_RATIO;
    const inside = dist < radius;
    if (inside && !sprite.pointerInside) {
      // Fresh entry — check swipe speed
      const speed = Math.hypot(ptr.vx, ptr.vy);
      if (speed >= MIN_SLAP_SPEED) {
        // Direction = pointer velocity, magnitude scaled by speed
        const impulseMag = Math.min(speed, 2200) * 0.85;
        const len = speed || 1;
        const dirX = ptr.vx / len;
        const dirY = ptr.vy / len;
        sprite.vx += dirX * impulseMag;
        sprite.vy += dirY * impulseMag;
        sprite.angVel += rand(-18, 18);
        sprite.slapAge = 0;
        sprite.stunMs = 220;

        // Score & combo
        const dtCombo = now - comboRef.current.lastAt;
        if (dtCombo <= COMBO_WINDOW_MS) {
          comboRef.current.count += 1;
        } else {
          comboRef.current.count = 1;
        }
        comboRef.current.lastAt = now;
        comboRef.current.total += 1;
        if (comboRef.current.count > comboRef.current.max) {
          comboRef.current.max = comboRef.current.count;
        }
        const c = comboRef.current.count;
        const mult = 1 + Math.floor((c - 1) / 2); // x1, x1, x2, x2, x3, x3 ...
        const gain = BASE_SCORE * mult;
        scoreRef.current += gain;
        setScore(scoreRef.current);
        setCombo(c);

        // Impact text near sprite center
        addImpact(pick(IMPACT_KINDS), sprite.x, sprite.y - sprite.size * 0.35, gain, c);
        playSlap(c);
        duckBgm();
      }
    }
    sprite.pointerInside = inside;
  }, [addImpact]);

  // ---- main loop ----
  useEffect(() => {
    const tick = (tMs: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const last = lastFrameRef.current || tMs;
      const dt = Math.min((tMs - last) / 1000, 0.05); // cap dt at 50ms
      lastFrameRef.current = tMs;

      const { w, h } = containerSizeRef.current;
      if (w === 0 || h === 0) return;

      const playing = screenRef.current === 'playing';

      // Combo decay (visual only — record stays)
      if (playing && comboRef.current.count > 0 && tMs - comboRef.current.lastAt > COMBO_WINDOW_MS) {
        comboRef.current.count = 0;
        setCombo(0);
      }

      // Spawn logic
      if (playing && spritesRef.current.length < MAX_SPRITES && tMs - lastSpawnAtRef.current > SPAWN_INTERVAL_MS) {
        spawnSprite();
        lastSpawnAtRef.current = tMs;
      }

      // Countdown
      if (playing) {
        const elapsed = (tMs - gameStartRef.current) / 1000;
        const remaining = Math.max(0, GAME_DURATION_SEC - elapsed);
        const whole = Math.ceil(remaining);
        if (whole !== lastWholeSecondRef.current) {
          lastWholeSecondRef.current = whole;
          setTimeLeft(whole);
          if (whole > 0 && whole <= 3) playBlip(whole === 1);
        }
        if (remaining <= 0) {
          screenRef.current = 'end';
          setScreen('end');
          const final = scoreRef.current;
          const prevBest = loadBest();
          const newBest = final > prevBest;
          setStats({
            totalSlaps: comboRef.current.total,
            maxCombo: comboRef.current.max,
            finalScore: final,
            isNewBest: newBest && final > 0,
          });
          if (newBest) {
            setBest(final);
            localStorage.setItem(BEST_KEY, String(final));
          }
          playEnd();
          stopBgm();
        }
      }

      // Sprite physics + slap detection
      const sprites = spritesRef.current;
      for (let i = sprites.length - 1; i >= 0; i--) {
        const s = sprites[i]!;
        s.slapAge += dt * 1000;
        if (s.stunMs > 0) s.stunMs = Math.max(0, s.stunMs - dt * 1000);

        // Idle bob when nearly still
        const vMag = Math.hypot(s.vx, s.vy);
        if (vMag < 50) {
          s.bobPhase += dt * 1.4;
          s.y += Math.sin(s.bobPhase) * 0.35;
        }

        // Integrate
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.rot += s.angVel * dt;

        // Friction
        const friction = 0.985;
        s.vx *= friction;
        s.vy *= friction;
        s.angVel *= 0.97;

        // Edge bounce
        const half = s.size * 0.42;
        let bounced = false;
        if (s.x < half && s.vx < 0) { s.x = half; s.vx = -s.vx * 0.7; bounced = vMag > 200; }
        else if (s.x > w - half && s.vx > 0) { s.x = w - half; s.vx = -s.vx * 0.7; bounced = vMag > 200; }
        if (s.y < half && s.vy < 0) { s.y = half; s.vy = -s.vy * 0.7; bounced = bounced || vMag > 200; }
        else if (s.y > h - half && s.vy > 0) { s.y = h - half; s.vy = -s.vy * 0.7; bounced = bounced || vMag > 200; }
        if (bounced) playBounce();

        if (playing) tryRegisterSlap(s, tMs);
      }

      // Sprite-sprite collision (chain reactions)
      for (let i = 0; i < sprites.length; i++) {
        const a = sprites[i]!;
        for (let j = i + 1; j < sprites.length; j++) {
          const b = sprites[j]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const minD = (a.size + b.size) * 0.38;
          if (d > 0 && d < minD) {
            // Resolve overlap
            const overlap = (minD - d) * 0.5;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
            // Exchange impulse along normal
            const vRelN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vRelN < 0) {
              const impulse = -vRelN * 0.9;
              a.vx -= nx * impulse;
              a.vy -= ny * impulse;
              b.vx += nx * impulse;
              b.vy += ny * impulse;
              a.angVel += rand(-6, 6);
              b.angVel += rand(-6, 6);
              if (Math.abs(vRelN) > 250) playBounce();
            }
          }
        }
      }

      // Apply transforms to DOM (no React re-render for sprite positions)
      for (const s of sprites) {
        const node = spriteNodesRef.current.get(s.uid);
        if (!node) continue;
        const stunScale = s.stunMs > 0 ? 1 + (s.stunMs / 220) * 0.25 : 1;
        node.style.transform =
          `translate3d(${s.x - s.size / 2}px, ${s.y - s.size / 2}px, 0) ` +
          `rotate(${s.rot}rad) scale(${stunScale})`;
        // flash overlay opacity based on slap age
        const flash = s.slapAge < 180 ? 1 - s.slapAge / 180 : 0;
        node.style.setProperty('--sc-flash', flash.toFixed(3));
        // slapped-expression crossfade: hold full for first 60%, fade back in last 40%
        const slappedT = s.slapAge < SLAPPED_EXPR_MS
          ? (s.slapAge < SLAPPED_EXPR_MS * 0.6 ? 1 : 1 - (s.slapAge - SLAPPED_EXPR_MS * 0.6) / (SLAPPED_EXPR_MS * 0.4))
          : 0;
        node.style.setProperty('--sc-slapped', slappedT.toFixed(3));
      }

      // Decay pointer velocity if no recent movement (so a stationary held pointer doesn't keep registering)
      if (pointerRef.current.down && tMs - pointerRef.current.lastMoveAt > 40) {
        pointerRef.current.vx *= 0.5;
        pointerRef.current.vy *= 0.5;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spawnSprite, tryRegisterSlap]);

  // ---- public actions ----
  const start = useCallback(() => {
    resumeAudio();
    // Reset
    spritesRef.current = [];
    spriteNodesRef.current.clear();
    scoreRef.current = 0;
    comboRef.current = { count: 0, lastAt: 0, max: 0, total: 0 };
    setScore(0);
    setCombo(0);
    setTimeLeft(GAME_DURATION_SEC);
    lastWholeSecondRef.current = GAME_DURATION_SEC;
    setImpacts([]);
    gameStartRef.current = performance.now();
    lastSpawnAtRef.current = performance.now();
    // Initial sprites (spawnSprite calls bumpSpriteList internally)
    for (let i = 0; i < INITIAL_SPRITES; i++) spawnSprite(CHAR_DEFS[i]!.id);
    screenRef.current = 'playing';
    setScreen('playing');
    startBgm();
  }, [spawnSprite]);

  const home = useCallback(() => {
    spritesRef.current = [];
    spriteNodesRef.current.clear();
    bumpSpriteList();
    setImpacts([]);
    setScore(0);
    setCombo(0);
    screenRef.current = 'start';
    setScreen('start');
    stopBgm();
  }, []);

  const splashDone = useCallback(() => {
    screenRef.current = 'start';
    setScreen('start');
  }, []);

  // ---- pointer handlers ----
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    resumeAudio();
    preloadBgm();
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const ptr = pointerRef.current;
    ptr.down = true;
    ptr.x = x;
    ptr.y = y;
    ptr.vx = 0;
    ptr.vy = 0;
    ptr.lastMoveAt = performance.now();
    ptr.hasPos = true;
    // Mark current sprites containing pointer so they don't auto-trigger on first move
    for (const s of spritesRef.current) {
      const dist = Math.hypot(x - s.x, y - s.y);
      s.pointerInside = dist < s.size * HIT_RADIUS_RATIO;
    }
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
  }, [containerRef]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const now = performance.now();
    const ptr = pointerRef.current;
    if (!ptr.hasPos) {
      ptr.x = x; ptr.y = y; ptr.lastMoveAt = now; ptr.hasPos = true;
      return;
    }
    const dt = Math.max(0.001, (now - ptr.lastMoveAt) / 1000);
    const ivx = (x - ptr.x) / dt;
    const ivy = (y - ptr.y) / dt;
    // Smooth velocity
    ptr.vx = ptr.vx * 0.4 + ivx * 0.6;
    ptr.vy = ptr.vy * 0.4 + ivy * 0.6;
    ptr.x = x;
    ptr.y = y;
    ptr.lastMoveAt = now;
  }, [containerRef]);

  const onPointerUp = useCallback(() => {
    pointerRef.current.down = false;
    pointerRef.current.vx = 0;
    pointerRef.current.vy = 0;
    for (const s of spritesRef.current) s.pointerInside = false;
  }, []);

  return {
    screen, score, combo, timeLeft, best, impacts, stats,
    spritesRef,
    registerSpriteNode,
    onPointerDown, onPointerMove, onPointerUp,
    start, home, splashDone,
  };
}

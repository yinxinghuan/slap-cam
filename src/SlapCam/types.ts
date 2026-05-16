export type CharId = 'algram' | 'jenny' | 'jmf' | 'ghostpixel' | 'isaya' | 'isabel';

export interface CharDef {
  id: CharId;
  username: string;
  imgNormal: string;
  imgSlapped: string;
  /** display size in px (longest side) */
  size: number;
}

export interface Sprite {
  uid: number;
  charId: CharId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  angVel: number;
  size: number;
  /** time since last slap, ms — used for visual flash */
  slapAge: number;
  /** ms since pointer last entered this sprite (or Infinity if not in) — to prevent re-trigger while held */
  pointerHoldMs: number;
  /** true while pointer is currently inside */
  pointerInside: boolean;
  /** bob phase offset for idle float */
  bobPhase: number;
  /** ms remaining of "stunned" big-flash window after slap */
  stunMs: number;
}

export interface ImpactFx {
  uid: number;
  kind: 'POW' | 'SLAP' | 'BAM' | 'WHAM' | 'BONK' | 'OOF';
  x: number;
  y: number;
  rot: number;
  bornAt: number;
  /** displayed score gain */
  score: number;
  /** combo level at hit time (drives color) */
  combo: number;
}

export type Screen = 'splash' | 'start' | 'playing' | 'end';

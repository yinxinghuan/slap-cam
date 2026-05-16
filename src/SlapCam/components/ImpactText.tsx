import type { ImpactFx } from '../types';

function comboClass(c: number): string {
  if (c >= 10) return 'sc-impact--rainbow';
  if (c >= 6) return 'sc-impact--red';
  if (c >= 3) return 'sc-impact--yellow';
  return '';
}

export function ImpactText({ fx }: { fx: ImpactFx }) {
  return (
    <div
      className={`sc-impact ${comboClass(fx.combo)}`}
      style={{
        left: fx.x,
        top: fx.y,
        transform: `translate(-50%, -50%) rotate(${fx.rot}rad)`,
      }}
    >
      <div className="sc-impact__word">{fx.kind}</div>
      <div className="sc-impact__score">+{fx.score}</div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { Sprite as SpriteData, CharId } from '../types';
import { CHAR_DEFS } from '../hooks/useSlapCam';

const DEF_BY_ID: Record<CharId, { normal: string; slapped: string }> =
  Object.fromEntries(
    CHAR_DEFS.map(c => [c.id, { normal: c.imgNormal, slapped: c.imgSlapped }])
  ) as Record<CharId, { normal: string; slapped: string }>;

interface Props {
  sprite: SpriteData;
  registerNode: (uid: number, el: HTMLDivElement | null) => void;
}

export function Sprite({ sprite, registerNode }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    registerNode(sprite.uid, ref.current);
    return () => registerNode(sprite.uid, null);
  }, [sprite.uid, registerNode]);

  const imgs = DEF_BY_ID[sprite.charId];

  return (
    <div
      ref={ref}
      className="sc-sprite"
      style={{
        width: sprite.size,
        height: sprite.size,
        transform: `translate3d(${sprite.x - sprite.size / 2}px, ${sprite.y - sprite.size / 2}px, 0)`,
      }}
    >
      <img
        className="sc-sprite__img sc-sprite__img--normal"
        src={imgs.normal}
        alt=""
        draggable={false}
      />
      <img
        className="sc-sprite__img sc-sprite__img--slapped"
        src={imgs.slapped}
        alt=""
        draggable={false}
      />
      <div className="sc-sprite__flash" />
    </div>
  );
}

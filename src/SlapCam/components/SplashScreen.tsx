import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAR_DEFS } from '../hooks/useSlapCam';
import { t } from '../i18n';

const MIN_MS = 1500;
const MAX_ASSET_MS = 8000;

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [assetsDone, setAssetsDone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const urls = CHAR_DEFS.flatMap(c => [c.imgNormal, c.imgSlapped]);
    const total = urls.length;
    if (total === 0) {
      setAssetsDone(true);
      return;
    }
    let loaded = 0;
    const fallback = setTimeout(() => setAssetsDone(true), MAX_ASSET_MS);
    urls.forEach(src => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        setProgress(Math.round((loaded / total) * 100));
        if (loaded === total) {
          clearTimeout(fallback);
          setAssetsDone(true);
        }
      };
      img.src = src;
    });
    return () => clearTimeout(fallback);
  }, []);

  const triggerFade = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(onDone, 450);
  }, [onDone]);

  useEffect(() => {
    if (minDone && assetsDone) triggerFade();
  }, [minDone, assetsDone, triggerFade]);

  return (
    <div className={`sc-splash${fading ? ' sc-splash--fading' : ''}`}>
      <div className="sc-splash__title">{t('title')}</div>
      <div className="sc-splash__subtitle">{t('subtitle')}</div>

      <div className="sc-splash__cast">
        {CHAR_DEFS.map((c, i) => (
          <img
            key={c.id}
            className="sc-splash__cast-head"
            src={c.imgNormal}
            alt=""
            draggable={false}
            style={{ animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </div>

      <div className="sc-splash__bar-track">
        <div className="sc-splash__bar-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

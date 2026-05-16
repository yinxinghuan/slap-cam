import { t } from '../i18n';
import { CHAR_DEFS } from '../hooks/useSlapCam';

interface Props {
  best: number;
  onStart: () => void;
  onOpenLeaderboard: () => void;
}

export function StartScreen({ best, onStart, onOpenLeaderboard }: Props) {
  return (
    <div className="sc-screen sc-start">
      {/* Bobbing cast row — same animation continuity from splash */}
      <div className="sc-start__cast">
        {CHAR_DEFS.map((c, i) => (
          <img
            key={c.id}
            className="sc-start__cast-head"
            src={c.imgNormal}
            alt=""
            draggable={false}
            style={{ animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </div>

      <div className="sc-start__title">{t('title')}</div>
      <div className="sc-start__subtitle">{t('subtitle')}</div>

      <button className="sc-btn sc-btn--big" onPointerDown={onStart}>
        {t('start')}
      </button>

      <div className="sc-start__bottom-row">
        {best > 0 ? (
          <div className="sc-start__best">{t('best')} · {best}</div>
        ) : <div />}
        <button className="sc-btn sc-btn--ghost sc-start__lb-btn" onPointerDown={onOpenLeaderboard}>
          {t('leaderboard')}
        </button>
      </div>

      <div className="sc-start__howto">{t('howto')}</div>
    </div>
  );
}

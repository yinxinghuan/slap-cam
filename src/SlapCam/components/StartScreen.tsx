import { t } from '../i18n';

interface Props {
  best: number;
  onStart: () => void;
}

export function StartScreen({ best, onStart }: Props) {
  return (
    <div className="sc-screen sc-start">
      <div className="sc-start__title-row">
        <div className="sc-start__title">{t('title')}</div>
        <div className="sc-start__title-shadow">{t('title')}</div>
      </div>
      <div className="sc-start__subtitle">{t('subtitle')}</div>

      <button className="sc-btn sc-btn--big" onPointerDown={onStart}>
        {t('start')}
      </button>

      <div className="sc-start__howto">{t('howto')}</div>

      {best > 0 && (
        <div className="sc-start__best">{t('best')} · {best}</div>
      )}
    </div>
  );
}

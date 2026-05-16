import { t } from '../i18n';

interface Props {
  finalScore: number;
  best: number;
  totalSlaps: number;
  maxCombo: number;
  isNewBest: boolean;
  onAgain: () => void;
  onHome: () => void;
  onOpenLeaderboard: () => void;
}

export function EndScreen({ finalScore, best, totalSlaps, maxCombo, isNewBest, onAgain, onHome, onOpenLeaderboard }: Props) {
  return (
    <div className="sc-screen sc-end">
      <div className="sc-end__title">{t('gameover')}</div>

      <div className="sc-end__score-label">{t('yourScore')}</div>
      <div className="sc-end__score">{finalScore}</div>

      {isNewBest ? (
        <div className="sc-end__newbest">{t('newBest')}</div>
      ) : (
        <div className="sc-end__best">{t('best')} · {best}</div>
      )}

      <div className="sc-end__stats">
        <div>{t('totalSlaps', { n: totalSlaps })}</div>
        <div>{t('maxCombo', { n: maxCombo })}</div>
      </div>

      <div className="sc-end__buttons">
        <button className="sc-btn sc-btn--big" onPointerDown={onAgain}>{t('again')}</button>
        <button className="sc-btn sc-btn--ghost" onPointerDown={onOpenLeaderboard}>{t('leaderboard')}</button>
        <button className="sc-btn sc-btn--ghost" onPointerDown={onHome}>{t('home')}</button>
      </div>
    </div>
  );
}

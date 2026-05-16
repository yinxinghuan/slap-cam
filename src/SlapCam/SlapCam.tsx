import { useEffect, useRef, useState } from 'react';
import { useSlapCam } from './hooks/useSlapCam';
import { Sprite } from './components/Sprite';
import { ImpactText } from './components/ImpactText';
import { SplashScreen } from './components/SplashScreen';
import { StartScreen } from './components/StartScreen';
import { EndScreen } from './components/EndScreen';
import { t } from './i18n';
import { useGameScore, Leaderboard } from '@shared/leaderboard';
import aiUrl from './img/aigram.svg';
import './SlapCam.less';

export default function SlapCam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    screen, score, combo, timeLeft, best, impacts, stats,
    spritesRef, registerSpriteNode,
    onPointerDown, onPointerMove, onPointerUp,
    start, home, splashDone,
  } = useSlapCam(containerRef);

  const { isInAigram, submitScore, fetchGlobalLeaderboard, fetchFriendsLeaderboard } =
    useGameScore('slap-cam');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Submit score when game ends
  useEffect(() => {
    if (screen === 'end' && stats.finalScore > 0) {
      submitScore(stats.finalScore);
    }
  }, [screen, stats.finalScore, submitScore]);

  return (
    <div
      ref={containerRef}
      className="sc-root"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="sc-bg" aria-hidden />

      {/* Sprites layer (always rendered so refs persist across screen changes) */}
      <div className="sc-stage">
        {spritesRef.current.map(s => (
          <Sprite key={s.uid} sprite={s} registerNode={registerSpriteNode} />
        ))}
      </div>

      {/* Impact text overlay */}
      <div className="sc-fx-layer" aria-hidden>
        {impacts.map(fx => <ImpactText key={fx.uid} fx={fx} />)}
      </div>

      {/* HUD (visible during play) */}
      {screen === 'playing' && (
        <>
          <div className="sc-hud sc-hud--top">
            <div className="sc-hud__cell">
              <div className="sc-hud__label">{t('time')}</div>
              <div className={`sc-hud__value ${timeLeft <= 5 ? 'sc-hud__value--urgent' : ''}`}>
                {timeLeft}
              </div>
            </div>
            <div className="sc-hud__cell sc-hud__cell--right">
              <div className="sc-hud__label">{t('score')}</div>
              <div className="sc-hud__value">{score}</div>
            </div>
          </div>
          {combo >= 2 && (
            <div className={`sc-combo sc-combo--${Math.min(combo, 12)}`}>
              {t('combo', { n: combo })}
            </div>
          )}
        </>
      )}

      {screen === 'splash' && <SplashScreen onDone={splashDone} />}
      {screen === 'start' && (
        <StartScreen
          best={best}
          onStart={start}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}
      {screen === 'end' && (
        <EndScreen
          finalScore={stats.finalScore}
          best={best}
          totalSlaps={stats.totalSlaps}
          maxCombo={stats.maxCombo}
          isNewBest={stats.isNewBest}
          onAgain={start}
          onHome={home}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {showLeaderboard && (
        <Leaderboard
          gameName="SLAP CAM"
          isInAigram={isInAigram}
          onClose={() => setShowLeaderboard(false)}
          fetchGlobal={fetchGlobalLeaderboard}
          fetchFriends={fetchFriendsLeaderboard}
        />
      )}

      <img className="sc-watermark" src={aiUrl} alt="" />
    </div>
  );
}

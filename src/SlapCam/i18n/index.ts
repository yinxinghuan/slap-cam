type Locale = 'zh' | 'en';

function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const dict: Record<Locale, Record<string, string>> = {
  zh: {
    title: 'SLAP CAM',
    subtitle: '滑动手指 抽飞他们',
    start: '开始',
    howto: '在他们脸上划过去',
    time: '时间',
    score: '得分',
    combo: 'x{n} 连击',
    gameover: '收工',
    yourScore: '你的得分',
    best: '最高',
    newBest: '新纪录！',
    again: '再来一次',
    home: '返回',
    totalSlaps: '总耳光 {n}',
    maxCombo: '最高连击 x{n}',
  },
  en: {
    title: 'SLAP CAM',
    subtitle: 'Swipe to slap them silly',
    start: 'START',
    howto: 'Drag your finger across their faces',
    time: 'TIME',
    score: 'SCORE',
    combo: 'x{n} COMBO',
    gameover: 'CUT!',
    yourScore: 'YOUR SCORE',
    best: 'BEST',
    newBest: 'NEW BEST!',
    again: 'AGAIN',
    home: 'HOME',
    totalSlaps: '{n} slaps',
    maxCombo: 'max combo x{n}',
  },
};

let current: Locale = detectLocale();

export function t(key: string, vars?: { n?: number | string }): string {
  let s = dict[current][key] ?? key;
  if (vars && vars.n !== undefined) s = s.replace('{n}', String(vars.n));
  return s;
}

export function getLocale(): Locale {
  return current;
}

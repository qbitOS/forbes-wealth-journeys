/**
 * Read --fwj-* design tokens from CSS custom properties.
 * Load after fwj-tokens.css (via industry-stream.css @import).
 */
(function (global) {
  'use strict';

  function colorRoot() {
    if (typeof document === 'undefined') return null;
    if (document.body?.classList.contains('stream-embedded')) {
      return document.querySelector('.industry-stream-section') || document.documentElement;
    }
    return document.documentElement;
  }

  function token(name, fallback) {
    if (typeof document === 'undefined') return fallback;
    const root = colorRoot();
    const value = getComputedStyle(root).getPropertyValue(name).trim();
    return value || fallback;
  }

  const TIMEFRAME_KEYS = {
    quarter: '--fwj-tf-quarter',
    month: '--fwj-tf-month',
    week: '--fwj-tf-week',
    day: '--fwj-tf-day',
    '5h': '--fwj-tf-5h',
    '1h': '--fwj-tf-1h',
    macd: '--fwj-flip-macd-bull',
    histogram: '--fwj-tf-day',
    bollinger: '--fwj-tf-quarter',
    squeeze: '--fwj-flip-squeeze-on',
  };

  const BRANCH_KEYS = {
    colossus: '--fwj-branch-colossus',
    terrafab: '--fwj-branch-terrafab',
    grok: '--fwj-branch-grok',
    'spacex-ipo': '--fwj-branch-spacex',
    spacex: '--fwj-branch-spacex',
    tesla: '--fwj-branch-tesla',
    'spacex-ops': '--fwj-branch-spacex-ops',
    'x-corp': '--fwj-branch-x-corp',
    neuralink: '--fwj-branch-neuralink',
    boring: '--fwj-branch-boring',
    openai: '--fwj-branch-openai',
  };

  const FLIP_TYPE_KEYS = {
    macd_bullish: '--fwj-flip-macd-bull',
    macd_bearish: '--fwj-flip-macd-bear',
    histogram_bullish: '--fwj-flip-hist-bull',
    histogram_bearish: '--fwj-flip-hist-bear',
    bb_upper_breakout: '--fwj-flip-bb-upper',
    bb_upper_reentry: '--fwj-flip-bb-reentry',
    bb_lower_breakdown: '--fwj-flip-bb-lower',
    bb_lower_reentry: '--fwj-flip-bb-reentry',
    bb_middle_bullish: '--fwj-flip-sma',
    bb_middle_bearish: '--fwj-flip-sma',
    squeeze_on: '--fwj-flip-squeeze-on',
    squeeze_release: '--fwj-flip-squeeze-release',
  };

  const KIND_KEYS = {
    flip: '--fwj-kind-flip',
    grok_branch: '--fwj-kind-grok',
    milestone: '--fwj-kind-milestone',
    world: '--fwj-kind-world',
  };

  const CHART_FALLBACKS = [
    '#78a9ff', '#42d392', '#c6a0f6', '#e6c068', '#ff8389',
    '#42beaa', '#ffb366', '#82cfff', '#be95ff', '#3ddbd9',
    '#ff7eb6', '#08bdba', '#f9e2af', '#d4bbff',
  ];

  global.FWJColor = {
    colorRoot,
    token,
    timeframe(id) {
      return token(TIMEFRAME_KEYS[id] || '--fwj-accent', '#78a9ff');
    },
    branch(id) {
      return token(BRANCH_KEYS[id] || '--fwj-accent', '#78a9ff');
    },
    flipType(id) {
      return token(FLIP_TYPE_KEYS[id] || '--fwj-text-muted', '#9aa0a6');
    },
    kind(id) {
      return token(KIND_KEYS[id] || '--fwj-accent', '#78a9ff');
    },
    interval(id) {
      return this.timeframe(id);
    },
    chartSeries(index) {
      const i = (index % 14) + 1;
      return token(`--fwj-chart-${i}`, CHART_FALLBACKS[i - 1]);
    },
    chartPalette() {
      return CHART_FALLBACKS.map((fb, i) => token(`--fwj-chart-${i + 1}`, fb));
    },
    heatmapScale(color) {
      const empty = token('--fwj-heatmap-empty', '#1a1f28');
      return [empty, `${color}33`, `${color}88`, color];
    },
    chartTheme() {
      return {
        background: token('--fwj-bg-elevated', '#12151a'),
        border: token('--fwj-border', '#2a3038'),
        text: token('--fwj-text', '#e8eaed'),
        textMuted: token('--fwj-text-muted', '#9aa0a6'),
        textDim: token('--fwj-neutral', '#8b939e'),
        grid: token('--fwj-surface-raised', '#1e2229'),
        heatmapTrack: token('--fwj-heatmap-track', '#12151a'),
        heatmapGrid: token('--fwj-heatmap-grid', '#2a3140'),
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

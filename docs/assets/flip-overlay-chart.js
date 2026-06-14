/**
 * Forbes multi-symbol overlay + flip vertical walls (Q/M/W/D).
 * Data: data/flip-overlay.json (built by scripts/build_industry_stream.py)
 */
(function () {
  "use strict";

  const DATA_URL = "data/flip-overlay.json";
  const HISTORICAL_INDEX_URL = "data/forbes-historical-index.json";
  const GROK_EVENTS_URL = "data/grok-branch-events.json";
  const WORLD_CONTEXT_URL = "data/world-context-events.json";
  const DATA_CACHE_BUST = "20260613z";

  const ALLTIME_START_YEAR = 1792;
  const ALLTIME_END_YEAR = 2026;

  const SYMBOL_FILTER_MODES = [
    { id: "all", label: "All" },
    { id: "top10", label: "Top 10" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "quarter", label: "Quarter winning" },
    { id: "move", label: "Move" },
  ];

  const VISIBLE_LINE_CAP = 12;
  const HEAVY_SYMBOL_THRESHOLD = 20;

  const INTERVAL_COLORS = {
    quarter: () => FWJColor.interval("quarter"),
    month: () => FWJColor.interval("month"),
    week: () => FWJColor.interval("week"),
    day: () => FWJColor.interval("day"),
  };

  const FLIP_TYPE_COLORS = {
    macd_bullish: () => FWJColor.flipType("macd_bullish"),
    macd_bearish: () => FWJColor.flipType("macd_bearish"),
    histogram_bullish: () => FWJColor.flipType("histogram_bullish"),
    histogram_bearish: () => FWJColor.flipType("histogram_bearish"),
    bb_upper_breakout: () => FWJColor.flipType("bb_upper_breakout"),
    bb_upper_reentry: () => FWJColor.flipType("bb_upper_reentry"),
    bb_lower_breakdown: () => FWJColor.flipType("bb_lower_breakdown"),
    bb_lower_reentry: () => FWJColor.flipType("bb_lower_reentry"),
    bb_middle_bullish: () => FWJColor.flipType("bb_middle_bullish"),
    bb_middle_bearish: () => FWJColor.flipType("bb_middle_bearish"),
    squeeze_on: () => FWJColor.flipType("squeeze_on"),
    squeeze_release: () => FWJColor.flipType("squeeze_release"),
  };

  function flipColor(map, key, fallbackKey) {
    const resolver = map[key];
    return resolver ? resolver() : FWJColor.token("--fwj-text-muted", "#9aa0a6");
  }

  const DATE_PRESETS = [
    { id: "all", label: "All" },
    { id: "1y", label: "1Y" },
    { id: "6m", label: "6M" },
    { id: "3m", label: "3M" },
    { id: "ytd", label: "YTD" },
  ];

  const VIEW_MODES = [
    { id: "alltime", label: "All Time" },
    { id: "year", label: "Year" },
    { id: "quarter", label: "Quarter" },
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
  ];

  /** Wall timeframe aligned to each chart view (year view uses quarter walls). */
  const VIEW_TO_WALL_TF = {
    alltime: "quarter",
    year: "quarter",
    quarter: "quarter",
    month: "month",
    week: "week",
  };

  const MILESTONE_ERA_COLORS = {
    markets: () => FWJColor.token("--fwj-kind-flip", "#2563eb"),
    internet: () => FWJColor.token("--fwj-accent", "#7c3aed"),
    forbes: () => FWJColor.token("--fwj-accent", "#78a9ff"),
    tech: () => FWJColor.token("--fwj-kind-grok", "#0891b2"),
    history: () => FWJColor.token("--fwj-text-muted", "#9aa0a6"),
    wealth: () => FWJColor.token("--fwj-kind-milestone", "#d4a017"),
    science: () => FWJColor.token("--fwj-kind-grok", "#06b6d4"),
    space: () => FWJColor.token("--fwj-kind-grok", "#6366f1"),
    grok: () => FWJColor.token("--fwj-kind-grok", "#a855f7"),
  };

  const SCRUB_SORT_MODES = [
    { id: "move", label: "Move" },
    { id: "rank", label: "Rank" },
    { id: "squeeze", label: "Squeeze" },
    { id: "value", label: "Value" },
  ];

  const state = {
    data: null,
    historicalIndex: null,
    grokEvents: null,
    worldContext: null,
    allTimeMilestones: [],
    listYearHighlight: null,
    focusYear: null,
    listYearSyncBound: false,
    chart: null,
    mode: "norm",
    chartView: "month",
    intervals: new Set(["quarter", "month", "week", "day"]),
    showWalls: true,
    highlightTicker: null,
    datePreset: "all",
    customStart: null,
    customEnd: null,
    dateOrder: "asc",
    dates: [],
    bucketLastDate: new Map(),
    wallIndex: { byDate: new Map(), sortedDates: [] },
    scrubSeries: [],
    scrubSortMode: "move",
    symbolFilterMode: "top10",
    displayMode: "compact",
    focusTicker: null,
    preFocusMode: "compact",
    scrubBucket: null,
    scrubBound: false,
    clickBound: false,
    isUpdatingChart: false,
    crosshairLabelVisible: false,
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function isAllTimeView(view = state.chartView) {
    return view === "alltime";
  }

  function allTimeSpan() {
    const anchorStart = state.historicalIndex?.timelineAnchors?.[0]?.year;
    return {
      start: anchorStart && anchorStart < ALLTIME_START_YEAR ? anchorStart : ALLTIME_START_YEAR,
      end: state.historicalIndex?.dataCoverage?.sliderMaxYear || ALLTIME_END_YEAR,
    };
  }

  function allTimeYearKeys() {
    const { start, end } = allTimeSpan();
    const keys = [];
    for (let y = start; y <= end; y++) keys.push(String(y));
    return keys;
  }

  function parseHexColor(hex) {
    const h = (hex || "").trim();
    const m = h.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return { r: 120, g: 169, b: 255 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function lerpColor(a, b, t) {
    const clamp = Math.max(0, Math.min(1, t));
    const ca = parseHexColor(a);
    const cb = parseHexColor(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * clamp);
    const g = Math.round(ca.g + (cb.g - ca.g) * clamp);
    const bl = Math.round(ca.b + (cb.b - ca.b) * clamp);
    return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }

  function withAlpha(hex, alpha) {
    const { r, g, b } = parseHexColor(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** Progressive era tint: older = cooler, newer = warmer (Option B within decade bands). */
  function eraBandColor(year, minYear, maxYear) {
    const cool = FWJColor.token("--fwj-branch-openai", "#3ddbd9");
    const warm = FWJColor.token("--fwj-gold", "#e6c068");
    const span = Math.max(1, maxYear - minYear);
    const t = (year - minYear) / span;
    return withAlpha(lerpColor(cool, warm, t), 0.07);
  }

  function yearFromBucketKey(key, view = state.chartView) {
    if (view === "alltime") return Number(key);
    const match = String(key).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function bucketKeysForYearSpan(startYear, endYear, keys, view = state.chartView) {
    if (view === "alltime") {
      return keys.filter((k) => {
        const y = Number(k);
        return y >= startYear && y <= endYear;
      });
    }
    return keys.filter((k) => {
      const y = yearFromBucketKey(k, view);
      return y != null && y >= startYear && y <= endYear;
    });
  }

  function yearNavActive(view = state.chartView) {
    return view === "year" || view === "alltime";
  }

  function yearNavBounds(view = state.chartView) {
    if (view === "alltime") return allTimeSpan();
    const { start, end } = getWindowBounds();
    return {
      start: start ? Number(start.slice(0, 4)) : 2023,
      end: end ? Number(end.slice(0, 4)) : ALLTIME_END_YEAR,
    };
  }

  function defaultFocusYear(view = state.chartView) {
    const { end } = yearNavBounds(view);
    const slider = $("#forbes-list-year") || $("#through-line-list-year");
    if (slider) {
      const v = Number(slider.value);
      if (!Number.isNaN(v)) return v;
    }
    if (state.listYearHighlight != null) return state.listYearHighlight;
    if (state.focusYear != null) return state.focusYear;
    return end;
  }

  function getFocusYear() {
    if (!yearNavActive()) return null;
    if (isAllTimeView()) return state.listYearHighlight ?? defaultFocusYear();
    return state.focusYear ?? defaultFocusYear();
  }

  function syncFocusYearExternal(year) {
    const forbesSlider = $("#forbes-list-year");
    if (forbesSlider) {
      const min = Number(forbesSlider.min) || year;
      const max = Number(forbesSlider.max) || year;
      if (year >= min && year <= max && Number(forbesSlider.value) !== year) {
        forbesSlider.value = String(year);
        forbesSlider.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    const tlSlider = $("#through-line-list-year");
    if (tlSlider) {
      const min = Number(tlSlider.min) || year;
      const max = Number(tlSlider.max) || year;
      if (year >= min && year <= max && Number(tlSlider.value) !== year) {
        if (window.IndustryStream?.setListYear) window.IndustryStream.setListYear(year);
        else {
          tlSlider.value = String(year);
          const output = $("#through-line-list-year-value");
          if (output) output.textContent = String(year);
          window.dispatchEvent(new CustomEvent("forbes:listYear", { detail: { year } }));
        }
      }
      return;
    }
    window.dispatchEvent(new CustomEvent("forbes:listYear", { detail: { year } }));
  }

  function refreshScrubForFocusYear() {
    if (!yearNavActive()) return;
    const year = getFocusYear();
    if (year == null) return;
    let bucket = null;
    if (isAllTimeView()) {
      bucket = state.dates.includes(String(year)) ? String(year) : state.dates[state.dates.length - 1] ?? null;
    } else {
      bucket =
        state.dates.find((k) => yearFromBucketKey(k, state.chartView) === year) ??
        state.dates[state.dates.length - 1] ??
        null;
    }
    if (bucket) renderScrubPanel(bucket);
    else clearScrubPanel();
  }

  function setFocusYear(year) {
    if (!yearNavActive()) return;
    const { start, end } = yearNavBounds();
    const clamped = Math.max(start, Math.min(end, year));
    if (getFocusYear() === clamped) return;
    if (isAllTimeView()) state.listYearHighlight = clamped;
    else state.focusYear = clamped;
    syncFocusYearExternal(clamped);
    renderViewToggles();
    renderMeta();
    updateChart({ resetInteraction: true, hardRefresh: state.chartView === "year" });
    refreshScrubForFocusYear();
  }

  function stepFocusYear(delta) {
    const current = getFocusYear();
    if (current == null) return;
    if (delta === -1 && state.chartView === "year") {
      const { start } = yearNavBounds("year");
      if (current <= start) {
        setChartView("alltime", { focusYear: current });
        return;
      }
    }
    setFocusYear(current + delta);
  }

  function applyYearWindowFilter(keys, valueRows, view = state.chartView) {
    if (view !== "year" || state.focusYear == null) return { keys, valueRows };
    const indices = [];
    keys.forEach((k, i) => {
      if (yearFromBucketKey(k, view) === state.focusYear) indices.push(i);
    });
    if (!indices.length) return { keys, valueRows };
    return {
      keys: indices.map((i) => keys[i]),
      valueRows: valueRows.map((row) => indices.map((i) => row[i])),
    };
  }

  function eraMarkAreas(keys, view = state.chartView) {
    if (!keys.length) return [];
    const years = keys.map((k) => yearFromBucketKey(k, view)).filter((y) => y != null);
    if (!years.length) return [];
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const areas = [];
    const decadeStart = Math.floor(minYear / 10) * 10;
    for (let d = decadeStart; d <= maxYear; d += 10) {
      const endDecade = Math.min(d + 9, maxYear);
      const inDecade = bucketKeysForYearSpan(d, endDecade, keys, view);
      if (!inDecade.length) continue;
      const midYear = d + 5;
      areas.push([
        { xAxis: inDecade[0], yAxis: "min" },
        {
          xAxis: inDecade[inDecade.length - 1],
          yAxis: "max",
          itemStyle: { color: eraBandColor(midYear, minYear, maxYear) },
          label: {
            show: inDecade.length >= 3 && (view === "alltime" ? d % 20 === 0 : d % 10 === 0),
            formatter: `${d}s`,
            color: FWJColor.token("--fwj-text-dim", "#888"),
            fontSize: 9,
            opacity: 0.65,
            position: "insideTopLeft",
          },
        },
      ]);
    }
    return areas;
  }

  function formationVisibleRange() {
    if (isAllTimeView()) {
      const span = allTimeSpan();
      return { start: `${span.start}-01-01`, end: `${span.end}-12-31` };
    }
    return activeDateRange();
  }

  function formationInRange(sym) {
    const iso = sym.formationDate || sym.ipoDate || sym.foundedDate;
    if (!iso) return null;
    const { start, end } = formationVisibleRange();
    if (iso < start || iso > end) return null;
    return iso;
  }

  function formationBucket(iso) {
    if (!iso) return null;
    const bucket = bucketKey(iso);
    if (state.dates.includes(bucket)) return bucket;
    if (isAllTimeView()) {
      const year = iso.slice(0, 4);
      return state.dates.includes(year) ? year : null;
    }
    return null;
  }

  function formationMarkLines(symbols) {
    const lines = [];
    const seen = new Set();
    for (const sym of symbols) {
      const iso = formationInRange(sym);
      if (!iso) continue;
      const bucket = formationBucket(iso);
      if (!bucket) continue;
      const key = `${sym.ticker}::${bucket}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const highlighted = state.highlightTicker === sym.ticker;
      const dimmed = state.highlightTicker && !highlighted;
      const type = sym.formationType || (sym.ipoDate ? "ipo" : "founding");
      const color = type === "ipo" ? FWJColor.token("--fwj-gold", "#e6c068") : FWJColor.token("--fwj-kind-milestone", "#42d392");
      const shortLabel = sym.formationLabel
        ? sym.formationLabel.length > 22
          ? `${sym.formationLabel.slice(0, 20)}…`
          : sym.formationLabel
        : type === "ipo"
          ? `${sym.ticker} IPO`
          : `Founded ${sym.ticker}`;
      lines.push({
        xAxis: bucket,
        lineStyle: {
          color,
          width: highlighted ? 2.2 : 1,
          type: type === "ipo" ? "solid" : "dotted",
          opacity: dimmed ? 0.2 : highlighted ? 0.9 : 0.45,
        },
        label: {
          show: highlighted || isFocusMode() || symbols.length <= 8,
          formatter: highlighted ? `${sym.ticker}\n${shortLabel}` : sym.ticker,
          color,
          fontSize: highlighted ? 9 : 8,
          fontWeight: highlighted ? 600 : 400,
          rotate: 90,
          position: "insideEndTop",
          distance: 4,
          overflow: "truncate",
          width: 64,
        },
      });
    }
    return lines;
  }

  function formationMetaForTicker(ticker) {
    const sym = (state.data?.symbols || []).find((s) => s.ticker === ticker);
    if (!sym) return null;
    const iso = sym.formationDate || sym.ipoDate || sym.foundedDate;
    if (!iso) return null;
    const type = sym.formationType || (sym.ipoDate ? "ipo" : "founding");
    const label = sym.formationLabel || (type === "ipo" ? "IPO" : "Founded");
    return { iso, type, label, sym };
  }

  function eraLegendSwatches() {
    const { start, end } = isAllTimeView() ? allTimeSpan() : activeDateRange();
    const minYear = Number(String(start).slice(0, 4));
    const maxYear = Number(String(end).slice(0, 4));
    const samples = [];
    for (let y = Math.floor(minYear / 10) * 10; y <= maxYear; y += 20) {
      if (y + 9 >= minYear) samples.push(y);
    }
    if (!samples.length) samples.push(minYear);
    return samples.slice(0, 5).map((y) => {
      const solid = lerpColor(
        FWJColor.token("--fwj-branch-openai", "#3ddbd9"),
        FWJColor.token("--fwj-gold", "#e6c068"),
        maxYear > minYear ? (y - minYear) / (maxYear - minYear) : 0,
      );
      return `<span class="flip-era-swatch" style="background:${solid}" title="${y}s"></span><span class="flip-era-label">${y}s</span>`;
    }).join("");
  }

  function milestoneColor(eraOrCategory) {
    const key = eraOrCategory || "history";
    const resolver = MILESTONE_ERA_COLORS[key];
    return resolver ? resolver() : FWJColor.token("--fwj-text-muted", "#9aa0a6");
  }

  function parseYearFromSort(sort) {
    if (!sort) return null;
    const match = String(sort).match(/^(\d{4})/);
    return match ? Number(match[1]) : null;
  }

  function buildAllTimeMilestones() {
    const seen = new Set();
    const out = [];

    function add(m) {
      if (!m?.year || m.year < ALLTIME_START_YEAR || m.year > ALLTIME_END_YEAR) return;
      const key = `${m.year}::${m.label}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(m);
    }

    for (const a of state.historicalIndex?.timelineAnchors || []) {
      add({
        year: a.year,
        label: a.label,
        era: a.era,
        category: a.category,
        major: a.category === "exchange" || a.category === "list" || a.category === "crisis",
        source: "anchor",
      });
    }

    for (const ev of state.worldContext?.events || []) {
      add({
        year: ev.year,
        label: ev.label,
        era: ev.category || "history",
        category: ev.category,
        major: ev.category === "wealth" || ev.category === "history",
        source: "world",
      });
    }

    const grokLists = ["clusterEvents", "portfolioEvents"];
    for (const listKey of grokLists) {
      for (const ev of state.grokEvents?.[listKey] || []) {
        const year = parseYearFromSort(ev.sort);
        if (!year) continue;
        add({
          year,
          label: ev.title || ev.id,
          era: "grok",
          category: ev.branch || "grok",
          major: year >= 2023,
          source: "grok",
        });
      }
    }

    return out.sort((a, b) => a.year - b.year || a.label.localeCompare(b.label));
  }

  function priceDataStartYear() {
    const { start } = getWindowBounds();
    return start ? Number(start.slice(0, 4)) : 2023;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function unionDates(symbols) {
    const set = new Set();
    for (const sym of symbols) {
      for (const p of sym.series || []) {
        if (p.date) set.add(p.date);
      }
    }
    return [...set].sort();
  }

  function parseIsoDate(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function formatShortDate(iso) {
    const dt = parseIsoDate(iso);
    if (!dt) return iso || "";
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  /** YYYY-MM-DD for crosshair label (bucket → last daily date in bucket). */
  function pointerDateIso(bucket) {
    if (!bucket) return "";
    return state.bucketLastDate.get(bucket) || bucket;
  }

  function crosshairDateLabel() {
    return { show: false };
  }

  function hideCrosshairDateLabel() {
    if (!state.chart || state.isUpdatingChart || !state.crosshairLabelVisible) return;
    state.crosshairLabelVisible = false;
    state.chart.setOption({ graphic: [{ id: "crosshair-date-label", $action: "remove" }] });
  }

  function updateCrosshairDateLabel(axisInfo) {
    if (!state.chart || state.isUpdatingChart || !axisInfo) return;
    const bucket = dateFromAxisInfo(axisInfo);
    const iso = pointerDateIso(bucket);
    if (!iso) {
      hideCrosshairDateLabel();
      return;
    }
    const x = state.chart.convertToPixel({ xAxisIndex: 0 }, bucket);
    if (x == null || Number.isNaN(x)) return;
    const chartW = state.chart.getWidth();
    const edgePad = 44;
    const clampedX = Math.max(edgePad, Math.min(chartW - edgePad, x));
    const theme = FWJColor.chartTheme();
    state.crosshairLabelVisible = true;
    state.chart.setOption({
      graphic: [
        {
          id: "crosshair-date-label",
          type: "text",
          silent: true,
          z: 100,
          x: clampedX,
          y: 8,
          style: {
            text: iso,
            fill: FWJColor.token("--fwj-accent", "#78a9ff"),
            font: "600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            textAlign: "center",
            textVerticalAlign: "top",
            backgroundColor: theme.background,
            padding: [3, 7],
            borderRadius: 4,
            borderColor: theme.border,
            borderWidth: 1,
          },
        },
      ],
    });
  }

  function isoWeekParts(iso) {
    const dt = parseIsoDate(iso);
    if (!dt) return null;
    const d = new Date(dt);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const year = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return { year, week };
  }

  /** Year view uses monthly buckets over the full span; alltime uses yearly keys; other views match their label. */
  function bucketView(view = state.chartView) {
    if (view === "alltime") return "year";
    return view === "year" ? "month" : view;
  }

  function bucketKey(iso, view = state.chartView) {
    const dt = parseIsoDate(iso);
    if (!dt) return iso || "";
    if (view === "alltime") return String(dt.getUTCFullYear());
    const bv = bucketView(view);
    if (bv === "quarter") return `${dt.getUTCFullYear()}-Q${Math.floor(dt.getUTCMonth() / 3) + 1}`;
    if (bv === "month") return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const wp = isoWeekParts(iso);
    return wp ? `${wp.year}-W${String(wp.week).padStart(2, "0")}` : iso;
  }

  function compareBucketKeys(a, b, view = state.chartView) {
    if (view === "alltime") return Number(a) - Number(b);
    const bv = bucketView(view);
    if (bv === "month") return a.localeCompare(b);
    if (view === "quarter") {
      const [ay, aq] = a.split("-Q").map(Number);
      const [by, bq] = b.split("-Q").map(Number);
      return ay !== by ? ay - by : aq - bq;
    }
    if (view === "week") {
      const [ay, aw] = a.split("-W").map(Number);
      const [by, bw] = b.split("-W").map(Number);
      return ay !== by ? ay - by : aw - bw;
    }
    return a.localeCompare(b);
  }

  function formatBucketLabel(key, index = -1, view = state.chartView) {
    if (view === "alltime") {
      const year = Number(key);
      if (index === 0 || index === state.dates.length - 1) return key;
      if (year % 50 === 0) return key;
      if (state.allTimeMilestones.some((m) => m.major && m.year === year)) return key;
      return "";
    }
    if (view === "year") {
      const year = key.split("-")[0];
      const prevYear = index > 0 ? state.dates[index - 1]?.split("-")[0] : null;
      return year !== prevYear ? year : "";
    }
    if (view === "week" && index >= 0 && index % 8 !== 0) return "";
    return key;
  }

  function xAxisLabelInterval(index) {
    if (state.chartView === "alltime") {
      const year = Number(state.dates[index]);
      if (index === 0 || index === state.dates.length - 1) return true;
      if (year % 50 === 0) return true;
      return state.allTimeMilestones.some((m) => m.major && m.year === year);
    }
    if (state.chartView === "year") {
      const year = state.dates[index]?.split("-")[0];
      const prevYear = index > 0 ? state.dates[index - 1]?.split("-")[0] : null;
      return year !== prevYear;
    }
    if (state.chartView === "week") return index % 8 === 0;
    if (state.chartView === "month") return index % 2 === 0;
    return true;
  }

  function resampleBuckets(dailyDates, view = state.chartView) {
    if (view === "alltime") {
      const keys = allTimeYearKeys();
      const bucketLastDate = new Map();
      for (const y of keys) {
        const prefix = `${y}-`;
        const inYear = dailyDates.filter((d) => d.startsWith(prefix));
        bucketLastDate.set(y, inYear.length ? inYear[inYear.length - 1] : `${y}-12-31`);
      }
      return { keys, bucketLastDate };
    }
    const bucketLastDate = new Map();
    for (const d of dailyDates) {
      const key = bucketKey(d, view);
      bucketLastDate.set(key, d);
    }
    const keys = [...bucketLastDate.keys()].sort((a, b) => compareBucketKeys(a, b, view));
    return { keys, bucketLastDate };
  }

  /** Latest trading date per bucket for one symbol (avoids union-calendar mismatches). */
  function symbolBucketLastDates(sym, view = state.chartView) {
    const byBucket = new Map();
    for (const p of sym.series || []) {
      if (!p.date) continue;
      const key = bucketKey(p.date, view);
      const prev = byBucket.get(key);
      if (!prev || p.date > prev) byBucket.set(key, p.date);
    }
    return byBucket;
  }

  /** Crosshair/scrub pointer dates from displayed symbols, not the global union calendar. */
  function bucketLastDateFromSymbols(symbols, keys, view = state.chartView) {
    const result = new Map();
    for (const key of keys) {
      let maxDate = null;
      for (const sym of symbols) {
        const d = symbolBucketLastDates(sym, view).get(key);
        if (d && (!maxDate || d > maxDate)) maxDate = d;
      }
      if (maxDate) result.set(key, maxDate);
    }
    return result;
  }

  function resampleSymbolSeries(sym, dailyDates, view = state.chartView, mode = state.mode) {
    const byDate = new Map((sym.series || []).map((p) => [p.date, p]));
    const symBuckets = symbolBucketLastDates(sym, view);
    const { keys, bucketLastDate } = resampleBuckets(dailyDates, view);
    if (!keys.length) return { keys: [], values: [], bucketLastDate };

    const valueKey = mode === "bbWidth" ? "bbWidth" : "close";

    let base = null;
    if (view === "alltime") {
      for (const key of keys) {
        const lastDate = symBuckets.get(key);
        if (!lastDate) continue;
        const p = byDate.get(lastDate);
        const raw = p?.[valueKey];
        if (raw != null) {
          base = mode === "bbWidth" ? raw : raw;
          break;
        }
      }
    } else {
      const firstDate = symBuckets.get(keys[0]);
      const basePoint = firstDate ? byDate.get(firstDate) : null;
      base = basePoint?.[valueKey];
    }

    const values = keys.map((key) => {
      const lastDate = symBuckets.get(key);
      if (!lastDate) return null;
      const p = byDate.get(lastDate);
      if (!p) return null;
      const raw = p[valueKey];
      if (raw == null) return null;
      if (mode === "bbWidth") return raw;
      if (!base) return null;
      return (100 * raw) / base;
    });

    return { keys, values, bucketLastDate };
  }

  function getWindowBounds() {
    const w = state.data?.window || {};
    const end = w.end || state.data?.asOf || "";
    const start = w.start || end;
    return { start, end };
  }

  function presetStartDate(preset, endIso) {
    const end = parseIsoDate(endIso);
    if (!end || preset === "all") return getWindowBounds().start;
    if (preset === "ytd") return `${end.getUTCFullYear()}-01-01`;
    const days = preset === "1y" ? 365 : preset === "6m" ? 183 : preset === "3m" ? 92 : 0;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days);
    return start.toISOString().slice(0, 10);
  }

  function activeDateRange() {
    const { start: windowStart, end: windowEnd } = getWindowBounds();
    if (state.datePreset === "custom" && state.customStart && state.customEnd) {
      const start = state.customStart < windowStart ? windowStart : state.customStart;
      const end = state.customEnd > windowEnd ? windowEnd : state.customEnd;
      if (start <= end) return { start, end };
      return { start: end, end: start };
    }
    const start = presetStartDate(state.datePreset, windowEnd);
    const boundedStart = start < windowStart ? windowStart : start;
    return { start: boundedStart, end: windowEnd };
  }

  function datesInActiveRange(allDates) {
    const { start, end } = activeDateRange();
    return allDates.filter((d) => d >= start && d <= end);
  }

  function applyDateOrder(keys, valueRows) {
    if (isAllTimeView()) return { keys, valueRows };
    if (state.dateOrder !== "desc") return { keys, valueRows };
    return {
      keys: [...keys].reverse(),
      valueRows: valueRows.map((row) => [...row].reverse()),
    };
  }

  function presetButtonLabel(preset) {
    if (preset.id === "all") {
      const { start } = getWindowBounds();
      const year = start?.slice(0, 4) || "2023";
      return `All (${year}→now)`;
    }
    return preset.label;
  }

  function wallsInActiveRange(walls) {
    const { start, end } = activeDateRange();
    return walls.filter((w) => w.date >= start && w.date <= end);
  }

  function wallsForScrubDate(date, walls) {
    const exact = walls.filter((w) => w.date === date);
    if (exact.length) return { exact, near: [] };
    const target = parseIsoDate(date)?.getTime();
    if (target == null) return { exact: [], near: [] };
    const near = walls
      .map((w) => ({ wall: w, delta: Math.abs((parseIsoDate(w.date)?.getTime() || target) - target) }))
      .filter((row) => row.delta > 0 && row.delta <= 7 * 86400000)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 6)
      .map((row) => row.wall);
    return { exact, near };
  }

  function filteredWalls() {
    if (!state.data?.walls) return [];
    const viewTf = VIEW_TO_WALL_TF[state.chartView];
    return state.data.walls.filter(
      (w) => state.intervals.has(w.timeframe) && (!viewTf || w.timeframe === viewTf),
    );
  }

  function rebuildWallIndex(walls = filteredWalls()) {
    const scoped = wallsInActiveRange(walls);
    const byBucket = new Map();
    for (const w of scoped) {
      const bucket = bucketKey(w.date);
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push(w);
    }
    state.wallIndex = {
      byDate: byBucket,
      sortedDates: [...byBucket.keys()].sort((a, b) => compareBucketKeys(a, b)),
    };
  }

  function dateFromAxisInfo(info) {
    if (!info) return null;
    if (typeof info.value === "number") return state.dates[info.value] ?? null;
    return info.value ?? null;
  }

  function formatScrubValue(v) {
    if (v == null) return "—";
    return state.mode === "bbWidth" ? Number(v).toFixed(4) : Number(v).toFixed(1);
  }

  function formatVolume(n) {
    if (n == null || Number.isNaN(n)) return "—";
    const v = Math.abs(Number(n));
    if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    return String(Math.round(v));
  }

  function formatVolRatio(vol, avg) {
    if (vol == null || avg == null || avg <= 0) return null;
    const ratio = Number(vol) / Number(avg);
    if (ratio < 1.05) return null;
    return `${ratio.toFixed(1)}× avg`;
  }

  function volElevated(vol, avg, threshold = 1.5) {
    if (vol == null || avg == null || avg <= 0) return false;
    return Number(vol) / Number(avg) >= threshold;
  }

  function resampleSymbolVolumeSeries(sym, dailyDates, view = state.chartView) {
    const byDate = new Map((sym.series || []).map((p) => [p.date, p]));
    const symBuckets = symbolBucketLastDates(sym, view);
    const { keys } = resampleBuckets(dailyDates, view);
    if (!keys.length) return { volumes: [], volAvgs: [] };
    const volumes = keys.map((key) => {
      const lastDate = symBuckets.get(key);
      if (!lastDate) return null;
      const p = byDate.get(lastDate);
      if (!p || p.volume == null) return null;
      const vol = Number(p.volume);
      return Number.isNaN(vol) ? null : vol;
    });
    const volAvgs = keys.map((key) => {
      const lastDate = symBuckets.get(key);
      if (!lastDate) return null;
      const p = byDate.get(lastDate);
      if (!p || p.volAvg20 == null) return null;
      const avg = Number(p.volAvg20);
      return Number.isNaN(avg) ? null : avg;
    });
    return { volumes, volAvgs };
  }

  function volumeAtDate(ticker, isoDate) {
    const sym = (state.data?.symbols || []).find((s) => s.ticker === ticker);
    if (!sym || !isoDate) return null;
    const pt = (sym.series || []).find((p) => p.date === isoDate);
    if (!pt || pt.volume == null) return null;
    return {
      volume: Number(pt.volume),
      volAvg20: pt.volAvg20 != null ? Number(pt.volAvg20) : null,
    };
  }

  function renderVolumeCell(vol, volAvg, maxVol) {
    if (vol == null) {
      return `<span class="flip-overlay-scrub-symbol-vol muted">—</span>`;
    }
    const ratio = formatVolRatio(vol, volAvg);
    const elevated = volElevated(vol, volAvg);
    const barPct = maxVol > 0 ? Math.min(100, Math.round((vol / maxVol) * 100)) : 0;
    const ratioHtml = ratio
      ? `<span class="flip-overlay-scrub-vol-ratio${elevated ? " elevated" : ""}">${ratio}</span>`
      : "";
    return `<span class="flip-overlay-scrub-symbol-vol${elevated ? " flip-overlay-scrub-vol-elevated" : ""}" title="${elevated ? "Elevated volume vs 20-day average" : "Daily share volume"}">
      <span class="flip-overlay-scrub-vol-bar-wrap" aria-hidden="true"><span class="flip-overlay-scrub-vol-bar" style="--vol-pct: ${barPct}"></span></span>
      <span class="flip-overlay-scrub-vol-text">${formatVolume(vol)}${ratioHtml}</span>
    </span>`;
  }

  function renderWallVolumeBadge(ticker, isoDate) {
    const meta = volumeAtDate(ticker, isoDate);
    if (!meta?.volume) return "";
    const ratio = formatVolRatio(meta.volume, meta.volAvg20);
    const elevated = volElevated(meta.volume, meta.volAvg20);
    const ratioNote = ratio ? ` · ${ratio}` : "";
    return `<span class="flip-overlay-scrub-wall-vol${elevated ? " elevated" : ""}" title="Volume on flip date${ratioNote}">${formatVolume(meta.volume)}${ratioNote}</span>`;
  }

  function quarterKey(iso) {
    const dt = parseIsoDate(iso);
    if (!dt) return null;
    return `${dt.getUTCFullYear()}-Q${Math.floor(dt.getUTCMonth() / 3) + 1}`;
  }

  function symbolsInDateRange(symbols, start, end) {
    return symbols.filter((sym) => (sym.series || []).some((p) => p.date >= start && p.date <= end));
  }

  function computeRangeMove(sym, start, end) {
    const pts = (sym.series || []).filter((p) => p.date >= start && p.date <= end);
    if (pts.length < 2) return null;
    const firstClose = pts[0].close;
    const lastClose = pts[pts.length - 1].close;
    if (firstClose == null || lastClose == null || firstClose === 0) return null;
    return ((lastClose - firstClose) / firstClose) * 100;
  }

  function computeQuarterGain(sym, start, end) {
    const pts = (sym.series || []).filter((p) => p.date >= start && p.date <= end);
    if (pts.length < 2) return null;
    const latestQ = quarterKey(pts[pts.length - 1].date);
    const qPts = pts.filter((p) => quarterKey(p.date) === latestQ);
    if (qPts.length < 2) return null;
    const firstClose = qPts[0].close;
    const lastClose = qPts[qPts.length - 1].close;
    if (firstClose == null || lastClose == null || firstClose === 0) return null;
    return ((lastClose - firstClose) / firstClose) * 100;
  }

  function computeIndexedPerformance(sym, start, end) {
    const pts = (sym.series || []).filter((p) => p.date >= start && p.date <= end);
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    return last.norm != null ? last.norm - 100 : computeRangeMove(sym, start, end);
  }

  function sortSymbolPool(pool, start, end) {
    const mode = state.symbolFilterMode;
    const sorted = [...pool];
    if (mode === "leaderboard") {
      sorted.sort((a, b) => {
        const ar = a.forbesRank ?? 9999;
        const br = b.forbesRank ?? 9999;
        if (ar !== br) return ar - br;
        return a.ticker.localeCompare(b.ticker);
      });
    } else if (mode === "quarter") {
      sorted.sort((a, b) => {
        const ag = computeQuarterGain(a, start, end) ?? -Infinity;
        const bg = computeQuarterGain(b, start, end) ?? -Infinity;
        if (bg !== ag) return bg - ag;
        return a.ticker.localeCompare(b.ticker);
      });
    } else if (mode === "move" || mode === "top10") {
      sorted.sort((a, b) => {
        const am = computeRangeMove(a, start, end);
        const bm = computeRangeMove(b, start, end);
        const av = am == null ? -Infinity : Math.abs(am);
        const bv = bm == null ? -Infinity : Math.abs(bm);
        if (bv !== av) return bv - av;
        return a.ticker.localeCompare(b.ticker);
      });
    } else {
      sorted.sort((a, b) => {
        const ar = a.forbesRank ?? 9999;
        const br = b.forbesRank ?? 9999;
        if (ar !== br) return ar - br;
        return a.ticker.localeCompare(b.ticker);
      });
    }
    return sorted;
  }

  function isFocusMode() {
    return state.displayMode === "focus" && !!state.focusTicker;
  }

  function isFullMode() {
    return state.displayMode === "full";
  }

  function enterFocus(ticker) {
    if (!ticker || ticker === "_walls") return;
    const pool = getFilteredSymbolPool();
    const sym =
      pool.find((s) => s.ticker === ticker) ||
      (state.data?.symbols || []).find((s) => s.ticker === ticker);
    if (!sym) return;
    if (!isFocusMode()) state.preFocusMode = state.displayMode;
    state.displayMode = "focus";
    state.focusTicker = ticker;
    state.highlightTicker = ticker;
    applyDisplayModeChrome();
    renderSymbolSortBar();
    renderLegendChips();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function exitFocus() {
    if (!isFocusMode()) return;
    state.displayMode = state.preFocusMode || "compact";
    state.focusTicker = null;
    state.highlightTicker = null;
    applyDisplayModeChrome();
    renderSymbolSortBar();
    renderLegendChips();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function toggleExpandMode() {
    if (isFocusMode()) return;
    state.displayMode = isFullMode() ? "compact" : "full";
    applyDisplayModeChrome();
    renderSymbolSortBar();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function applyDisplayModeChrome() {
    const section = $("#flip-wall-chart");
    if (section) {
      section.classList.toggle("flip-overlay-focus-mode", isFocusMode());
      section.classList.toggle("flip-overlay-full-mode", isFullMode());
    }
    const chartWrap = $(".flip-overlay-chart-wrap");
    if (chartWrap) chartWrap.classList.toggle("flip-overlay-chart-wrap--focus", isFocusMode());

    const backBtn = $("#flip-overlay-focus-back");
    if (backBtn) backBtn.hidden = !isFocusMode();

    const sortBar = $("#flip-overlay-symbol-sort");
    if (sortBar) sortBar.hidden = isFocusMode();

    const pool = getFilteredSymbolPool();
    const expandBtn = $("#flip-overlay-expand");
    if (expandBtn) {
      const canExpand = !isFocusMode() && pool.length > visibleSymbolLimit(pool.length, "compact");
      expandBtn.hidden = !canExpand && !isFullMode();
      expandBtn.textContent = isFullMode() ? "Compact" : `Expand all (${pool.length})`;
      expandBtn.classList.toggle("active", isFullMode());
      expandBtn.setAttribute("aria-pressed", isFullMode() ? "true" : "false");
    }

    const perfWarn = $("#flip-overlay-perf-warn");
    if (perfWarn) {
      perfWarn.hidden = !(isFullMode() && pool.length > HEAVY_SYMBOL_THRESHOLD);
    }
  }

  function visibleSymbolLimit(filteredCount, mode = state.displayMode) {
    if (mode === "full") return filteredCount;
    if (mode === "focus") return 1;
    if (state.symbolFilterMode === "top10" || state.symbolFilterMode === "leaderboard") {
      return Math.min(10, filteredCount);
    }
    if (state.symbolFilterMode === "all") return filteredCount;
    if (filteredCount > HEAVY_SYMBOL_THRESHOLD) return VISIBLE_LINE_CAP;
    return filteredCount;
  }

  function getDisplaySymbols() {
    const pool = getFilteredSymbolPool();
    if (isFocusMode()) {
      const sym =
        pool.find((s) => s.ticker === state.focusTicker) ||
        (state.data?.symbols || []).find((s) => s.ticker === state.focusTicker);
      return sym ? [sym] : pool.slice(0, 1);
    }
    const limit = visibleSymbolLimit(pool.length);
    return pool.slice(0, limit);
  }

  function getFilteredSymbolPool() {
    const { start, end } = activeDateRange();
    const pool = symbolsInDateRange(state.data?.symbols || [], start, end);
    return sortSymbolPool(pool, start, end);
  }

  function symbolFilterLabel() {
    const mode = SYMBOL_FILTER_MODES.find((m) => m.id === state.symbolFilterMode)?.label || state.symbolFilterMode;
    if (isFocusMode()) {
      const sym = (state.data?.symbols || []).find((s) => s.ticker === state.focusTicker);
      const entity = sym?.entity ? ` · ${sym.entity}` : "";
      return `Focus · ${state.focusTicker}${entity}`;
    }
    const pool = getFilteredSymbolPool();
    const shown = getDisplaySymbols().length;
    if (isFullMode()) return `${mode} · all ${shown}`;
    if (shown < pool.length) return `${mode} · top ${shown}`;
    return mode;
  }

  function renderSymbolSortBar() {
    const root = $("#flip-overlay-symbol-sort");
    if (!root) return;
    root.innerHTML = SYMBOL_FILTER_MODES.map(
      (m) =>
        `<button type="button" class="flip-overlay-symbol-sort-chip${state.symbolFilterMode === m.id ? " active" : ""}" data-symbol-filter="${m.id}" aria-pressed="${state.symbolFilterMode === m.id}">${m.label}</button>`,
    ).join("");
    applyDisplayModeChrome();
  }

  function bindSymbolSortEvents() {
    const root = $("#flip-overlay-symbol-sort");
    if (root && !root.dataset.bound) {
      root.dataset.bound = "1";
      root.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".flip-overlay-symbol-sort-chip");
        if (!btn || !root.contains(btn)) return;
        const mode = btn.dataset.symbolFilter;
        if (!mode || mode === state.symbolFilterMode) return;
        if (isFocusMode()) exitFocus();
        state.symbolFilterMode = mode;
        if (mode === "all") state.displayMode = "full";
        else if (state.displayMode === "full" && mode !== "all") state.displayMode = "compact";
        applyDisplayModeChrome();
        renderSymbolSortBar();
        renderMeta();
        updateChart({ hardRefresh: true });
      });
    }

    const expandBtn = $("#flip-overlay-expand");
    if (expandBtn && !expandBtn.dataset.bound) {
      expandBtn.dataset.bound = "1";
      expandBtn.addEventListener("click", () => toggleExpandMode());
    }

    const backBtn = $("#flip-overlay-focus-back");
    if (backBtn && !backBtn.dataset.bound) {
      backBtn.dataset.bound = "1";
      backBtn.addEventListener("click", () => exitFocus());
    }
  }

  function bindScrubSymbolClicks() {
    const symbolsEl = $("#flip-overlay-scrub-symbols");
    if (!symbolsEl || symbolsEl.dataset.bound) return;
    symbolsEl.dataset.bound = "1";
    symbolsEl.addEventListener("click", (ev) => {
      const row = ev.target.closest(".flip-overlay-scrub-symbol");
      if (!row || !symbolsEl.contains(row)) return;
      const ticker = row.dataset.ticker;
      if (ticker) enterFocus(ticker);
    });
    symbolsEl.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      const row = ev.target.closest(".flip-overlay-scrub-symbol");
      if (!row || !symbolsEl.contains(row)) return;
      ev.preventDefault();
      const ticker = row.dataset.ticker;
      if (ticker) enterFocus(ticker);
    });
  }

  function setSymbolFilterMode(mode) {
    if (!SYMBOL_FILTER_MODES.some((m) => m.id === mode) || state.symbolFilterMode === mode) return;
    if (isFocusMode()) exitFocus();
    state.symbolFilterMode = mode;
    if (mode === "all") state.displayMode = "full";
    else if (state.displayMode === "full") state.displayMode = "compact";
    applyDisplayModeChrome();
    renderSymbolSortBar();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function formatMovePct(pct) {
    if (pct == null || Number.isNaN(pct)) return "—";
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  }

  function movePctAtIndex(values, idx) {
    const current = values[idx];
    if (current == null) return null;
    const prior = idx > 0 ? values[idx - 1] : null;
    const base = prior ?? values[0];
    if (base == null || base === 0) return null;
    return ((current - base) / base) * 100;
  }

  function sortScrubRows(rows) {
    const mode = state.scrubSortMode;
    const sorted = [...rows];
    if (mode === "move") {
      sorted.sort((a, b) => {
        const am = a.movePct == null ? -Infinity : Math.abs(a.movePct);
        const bm = b.movePct == null ? -Infinity : Math.abs(b.movePct);
        if (bm !== am) return bm - am;
        return a.ticker.localeCompare(b.ticker);
      });
    } else if (mode === "rank") {
      sorted.sort((a, b) => {
        const ar = a.forbesRank ?? 9999;
        const br = b.forbesRank ?? 9999;
        if (ar !== br) return ar - br;
        return a.ticker.localeCompare(b.ticker);
      });
    } else if (mode === "squeeze") {
      sorted.sort((a, b) => {
        const as = a.squeezeScore ?? -1;
        const bs = b.squeezeScore ?? -1;
        if (bs !== as) return bs - as;
        return a.ticker.localeCompare(b.ticker);
      });
    } else {
      sorted.sort((a, b) => {
        const av = a.value ?? -Infinity;
        const bv = b.value ?? -Infinity;
        if (bv !== av) return bv - av;
        return a.ticker.localeCompare(b.ticker);
      });
    }
    return sorted;
  }

  function renderScrubSortChips() {
    const root = $("#flip-overlay-scrub-sort");
    if (!root) return;
    root.innerHTML = SCRUB_SORT_MODES.map(
      (m) =>
        `<button type="button" class="flip-overlay-scrub-sort-chip${state.scrubSortMode === m.id ? " active" : ""}" data-scrub-sort="${m.id}" aria-pressed="${state.scrubSortMode === m.id}">${m.label}</button>`,
    ).join("");
  }

  function bindScrubSortEvents() {
    const root = $("#flip-overlay-scrub-sort");
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".flip-overlay-scrub-sort-chip");
      if (!btn || !root.contains(btn)) return;
      const mode = btn.dataset.scrubSort;
      if (!mode || mode === state.scrubSortMode) return;
      state.scrubSortMode = mode;
      renderScrubSortChips();
      if (state.scrubBucket) renderScrubPanel(state.scrubBucket);
    });
  }

  function setScrubSortMode(mode) {
    if (!SCRUB_SORT_MODES.some((m) => m.id === mode) || state.scrubSortMode === mode) return;
    state.scrubSortMode = mode;
    renderScrubSortChips();
    if (state.scrubBucket) renderScrubPanel(state.scrubBucket);
  }

  function lastSeriesValue(values) {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] != null) return values[i];
    }
    return null;
  }

  function highlightEndLabelText(ticker, values) {
    const last = lastSeriesValue(values);
    if (last == null) return ticker;
    return `${ticker} · ${formatScrubValue(last)}`;
  }

  function highlightEndLabel(ticker, values, color) {
    return {
      show: true,
      formatter: () => highlightEndLabelText(ticker, values),
      color,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      distance: 4,
      offset: [6, 0],
      valueAnimation: false,
    };
  }

  function wallsAtOrNear(bucket, limit = 12) {
    const cap = isFocusMode() ? 48 : limit;
    const { byDate, sortedDates } = state.wallIndex;
    const exact = byDate.get(bucket) || [];
    if (exact.length) return { walls: exact.slice(0, cap), nearestDate: null };

    if (!sortedDates.length) return { walls: [], nearestDate: null };

    let lo = 0;
    let hi = sortedDates.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (compareBucketKeys(sortedDates[mid], bucket) < 0) lo = mid + 1;
      else hi = mid;
    }

    const candidates = [];
    if (lo > 0) candidates.push(sortedDates[lo - 1]);
    if (lo < sortedDates.length) candidates.push(sortedDates[lo]);
    if (!candidates.length) return { walls: [], nearestDate: null };

    let nearestDate = candidates[0];
    let minDist = Infinity;
    for (const d of candidates) {
      const dist = Math.abs(sortedDates.indexOf(d) - lo);
      if (dist < minDist) {
        minDist = dist;
        nearestDate = d;
      }
    }
    return { walls: (byDate.get(nearestDate) || []).slice(0, cap), nearestDate };
  }

  function scrubSymbolRows(bucket) {
    const idx = state.dates.indexOf(bucket);
    if (idx < 0) return [];
    const rows = [];
    state.scrubSeries.forEach((row) => {
      const v = row.values[idx];
      if (v == null) return;
      const movePct = movePctAtIndex(row.values, idx);
      const formation = formationMetaForTicker(row.ticker);
      rows.push({
        ticker: row.ticker,
        value: v,
        movePct,
        volume: row.volumes?.[idx] ?? null,
        volAvg: row.volAvgs?.[idx] ?? null,
        forbesRank: row.forbesRank,
        squeezeScore: row.squeezeScore,
        color: row.color,
        dimmed: state.highlightTicker
          ? state.highlightTicker !== row.ticker
          : row.onChart === false,
        formation: formation
          ? {
              type: formation.type,
              label: formation.label,
              short: `${formation.type === "ipo" ? "IPO" : "Founded"} ${formation.iso.slice(0, 4)}`,
            }
          : null,
      });
    });
    return sortScrubRows(rows);
  }

  function renderScrubSymbolRow(r, maxVol = 0) {
    const moveClass =
      r.movePct == null ? "" : r.movePct > 0 ? " up" : r.movePct < 0 ? " down" : "";
    const rankBadge =
      r.forbesRank != null
        ? `<span class="flip-overlay-scrub-symbol-rank" title="Forbes #${r.forbesRank}">#${r.forbesRank}</span>`
        : "";
    const formationBadge = r.formation
      ? `<span class="flip-overlay-scrub-formation flip-overlay-formation-${escapeHtml(r.formation.type)}" title="${escapeHtml(r.formation.label)}">${escapeHtml(r.formation.short)}</span>`
      : "";
    const squeezeBadge =
      state.scrubSortMode === "squeeze" && r.squeezeScore != null
        ? `<span class="flip-overlay-scrub-symbol-squeeze" title="BB compression squeeze score">${r.squeezeScore}</span>`
        : "";
    const metaBadges = [rankBadge, formationBadge, squeezeBadge].filter(Boolean).join("");
    const volCell = renderVolumeCell(r.volume, r.volAvg, maxVol);
    return `<div class="flip-overlay-scrub-symbol${r.dimmed ? " dimmed" : ""}" data-ticker="${escapeHtml(r.ticker)}" role="button" tabindex="0" title="Focus ${escapeHtml(r.ticker)}">
      <span class="flip-overlay-scrub-symbol-dot" style="background:${r.color}"></span>
      <span class="flip-overlay-scrub-symbol-ticker">${escapeHtml(r.ticker)}</span>
      <span class="flip-overlay-scrub-symbol-meta">${metaBadges}</span>
      <span class="flip-overlay-scrub-symbol-move${moveClass}">${formatMovePct(r.movePct)}</span>
      ${volCell}
      <span class="flip-overlay-scrub-symbol-val">${formatScrubValue(r.value)}</span>
    </div>`;
  }

  function clearScrubPanel(hideCrosshair = true) {
    const scrub = $("#flip-overlay-scrub");
    const hint = $(".flip-overlay-scrub-hint");
    const content = $("#flip-overlay-scrub-content");
    state.scrubBucket = null;
    if (scrub) scrub.classList.remove("is-populated");
    if (hint) hint.hidden = false;
    if (content) content.hidden = true;
    if (hideCrosshair) hideCrosshairDateLabel();
  }

  function renderScrubPanel(bucket) {
    state.scrubBucket = bucket;
    if (isAllTimeView()) syncListYearFromScrub(bucket);
    const scrub = $("#flip-overlay-scrub");
    const hint = $(".flip-overlay-scrub-hint");
    const content = $("#flip-overlay-scrub-content");
    const dateEl = $("#flip-overlay-scrub-date");
    const symbolsEl = $("#flip-overlay-scrub-symbols");
    const wallsEl = $("#flip-overlay-scrub-walls");
    if (!content || !dateEl || !symbolsEl || !wallsEl) return;

    if (scrub) scrub.classList.add("is-populated");
    if (hint) hint.hidden = true;
    content.hidden = false;
    renderScrubSortChips();

    const yLabel = state.mode === "bbWidth" ? "BB width" : "Indexed";
    const sortLabel = SCRUB_SORT_MODES.find((m) => m.id === state.scrubSortMode)?.label || state.scrubSortMode;
    const poolCount = state.scrubSeries.length;
    const chartCount = getDisplaySymbols().length;
    const poolNote = poolCount > chartCount ? ` · ${poolCount} symbols` : "";
    const heading = `${yLabel} · ${sortLabel}${poolNote}`;
    const lastDate = state.bucketLastDate.get(bucket);
    const label = bucket;
    const highlightFormation = state.highlightTicker ? formationMetaForTicker(state.highlightTicker) : null;
    const formationNote = highlightFormation
      ? ` · ${highlightFormation.label} (${highlightFormation.iso.slice(0, 4)})`
      : "";
    dateEl.textContent = lastDate
      ? `${label} · ${formatShortDate(lastDate)}${formationNote}`
      : isAllTimeView()
        ? `${label} · timeline${formationNote}`
        : `${label}${formationNote}`;

    const rows = scrubSymbolRows(bucket);
    const maxVol = rows.reduce((max, r) => (r.volume != null && r.volume > max ? r.volume : max), 0);
    const rowHtml = rows.map((r) => renderScrubSymbolRow(r, maxVol)).join("");
    if (isAllTimeView()) {
      const milestones = state.allTimeMilestones.filter((m) => m.year === Number(bucket));
      const msHtml = milestones.length
        ? `<div class="flip-overlay-scrub-milestones"><h3 class="flip-overlay-scrub-heading">Milestones</h3>${milestones
            .map(
              (m) =>
                `<div class="flip-overlay-scrub-milestone flip-overlay-milestone-${escapeHtml(m.era || m.category || "other")}"><span class="flip-overlay-milestone-year">${m.year}</span> ${escapeHtml(m.label)}</div>`,
            )
            .join("")}</div>`
        : "";
      if (!rows.length) {
        symbolsEl.innerHTML = `<p class="flip-overlay-scrub-empty">No price data at this year — timeline context only.</p>${msHtml}`;
      } else {
        symbolsEl.innerHTML = `<h3 class="flip-overlay-scrub-heading">${heading}</h3>${rowHtml}${msHtml}`;
      }
    } else if (!rows.length) {
      symbolsEl.innerHTML = `<p class="flip-overlay-scrub-empty">No values at this bucket.</p>`;
    } else {
      symbolsEl.innerHTML = `<h3 class="flip-overlay-scrub-heading">${heading}</h3>${rowHtml}`;
    }

    const { walls, nearestDate } = wallsAtOrNear(bucket);
    if (!walls.length) {
      wallsEl.innerHTML = `<p class="flip-overlay-scrub-empty">No flip walls in range.</p>`;
    } else {
      const nearNote =
        nearestDate && nearestDate !== bucket
          ? `<p class="flip-overlay-scrub-near">Nearest flips · ${escapeHtml(formatBucketLabel(nearestDate))}</p>`
          : "";
      wallsEl.innerHTML = `
        <h3 class="flip-overlay-scrub-heading">Flip walls</h3>
        ${nearNote}
        ${walls
          .map((w) => {
            const tfColor = flipColor(INTERVAL_COLORS, w.timeframe);
            const volMeta = volumeAtDate(w.ticker, w.date);
            const volBadge = renderWallVolumeBadge(w.ticker, w.date);
            const elevatedClass =
              volMeta && volElevated(volMeta.volume, volMeta.volAvg20) ? " flip-overlay-scrub-wall--elevated" : "";
            return `<div class="flip-overlay-scrub-wall${elevatedClass}">
              <span class="flip-overlay-scrub-wall-tf" style="color:${tfColor}">${escapeHtml((w.timeframe || "?")[0].toUpperCase())}</span>
              <span class="flip-overlay-scrub-wall-ticker">${escapeHtml(w.ticker)}</span>
              <span class="flip-overlay-scrub-wall-label">${escapeHtml(w.label || w.type?.replace(/_/g, " ") || "")}</span>
              ${volBadge}
            </div>`;
          })
          .join("")}`;
    }
  }

  function onAxisPointerUpdate(ev) {
    const axisInfo = ev.axesInfo?.[0];
    const bucket = dateFromAxisInfo(axisInfo);
    if (!bucket) return;
    renderScrubPanel(bucket);
    updateCrosshairDateLabel(axisInfo);
  }

  function bindScrubEvents() {
    if (!state.chart || state.scrubBound) return;
    state.chart.on("updateAxisPointer", onAxisPointerUpdate);
    state.chart.getZr().on("globalout", clearScrubPanel);
    state.scrubBound = true;
  }

  function unbindScrubEvents() {
    if (!state.chart) return;
    state.chart.off("updateAxisPointer", onAxisPointerUpdate);
    state.chart.getZr()?.off("globalout", clearScrubPanel);
    state.scrubBound = false;
  }

  function wallMarkLines(walls) {
    if (!state.showWalls || !walls.length) return [];
    const seen = new Set();
    const lines = [];
    for (const w of walls) {
      const bucket = bucketKey(w.date);
      const key = `${bucket}::${w.timeframe}::${w.type}::${w.ticker}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tfColor = flipColor(INTERVAL_COLORS, w.timeframe);
      const typeColor = flipColor(FLIP_TYPE_COLORS, w.type) || tfColor;
      lines.push({
        xAxis: bucket,
        lineStyle: {
          color: typeColor,
          width: w.timeframe === "quarter" ? 2.5 : w.timeframe === "month" ? 2 : w.timeframe === "week" ? 1.5 : 1,
          type: w.type?.startsWith("bb_") ? "solid" : "dashed",
          opacity: w.timeframe === "day" ? 0.35 : 0.55,
        },
        label: { show: false },
      });
    }
    return lines;
  }

  function milestoneMarkLines() {
    if (!isAllTimeView() || !state.allTimeMilestones.length) return [];
    return state.allTimeMilestones.map((m) => {
      const color = milestoneColor(m.era || m.category);
      const shortLabel = m.label.length > 28 ? `${m.label.slice(0, 26)}…` : m.label;
      return {
        xAxis: String(m.year),
        lineStyle: {
          color,
          width: m.major ? 1.75 : 1,
          type: m.source === "anchor" ? "solid" : "dotted",
          opacity: m.major ? 0.65 : 0.35,
        },
        label: {
          show: m.major,
          formatter: `{year|${m.year}}\n{lbl|${shortLabel}}`,
          rich: {
            year: { fontSize: 9, fontWeight: 600, color, lineHeight: 12 },
            lbl: { fontSize: 8, color: FWJColor.token("--fwj-text-dim", "#888"), lineHeight: 11 },
          },
          rotate: 90,
          position: "insideEndTop",
          distance: 4,
          overflow: "truncate",
          width: 72,
        },
      };
    });
  }

  function listYearHighlightMarkLine() {
    if (!isAllTimeView() || state.listYearHighlight == null) return null;
    const year = String(state.listYearHighlight);
    if (!state.dates.includes(year)) return null;
    const accent = FWJColor.token("--fwj-accent", "#78a9ff");
    return {
      xAxis: year,
      lineStyle: { color: accent, width: 2.5, type: "solid", opacity: 0.95 },
      label: {
        show: true,
        formatter: `Forbes ${year}`,
        color: accent,
        fontSize: 10,
        fontWeight: 600,
        position: "insideEndBottom",
      },
    };
  }

  function allTimePrePriceMarkArea() {
    if (!isAllTimeView()) return null;
    const priceStart = priceDataStartYear();
    const preEnd = String(priceStart - 1);
    const { start } = allTimeSpan();
    if (Number(preEnd) < start) return null;
    const theme = FWJColor.chartTheme();
    return {
      silent: true,
      itemStyle: {
        color: FWJColor.token("--fwj-accent-subtle", "rgba(120, 169, 255, 0.06)"),
        borderColor: theme.border,
        borderWidth: 0,
      },
      label: {
        show: true,
        position: "insideTopLeft",
        formatter: `Timeline rail · ${start}–${preEnd}\n(price data from ${priceStart})`,
        color: theme.textDim,
        fontSize: 9,
        lineHeight: 14,
      },
      data: [[{ xAxis: String(start), yAxis: "min" }, { xAxis: preEnd, yAxis: "max" }]],
    };
  }

  function syncListYearFromScrub(bucket) {
    if (!isAllTimeView()) return;
    const year = Number(bucket);
    if (!year || Number.isNaN(year)) return;
    if (state.listYearHighlight === year) return;
    state.listYearHighlight = year;
    syncFocusYearExternal(year);
    updateChart({ resetInteraction: false });
  }

  function bindListYearSync() {
    if (state.listYearSyncBound) return;
    state.listYearSyncBound = true;
    window.addEventListener("forbes:listYear", (e) => {
      const year = e.detail?.year;
      if (year == null || !yearNavActive()) return;
      if (isAllTimeView()) {
        if (state.listYearHighlight === year) return;
        state.listYearHighlight = year;
      } else if (state.chartView === "year") {
        if (state.focusYear === year) return;
        state.focusYear = year;
      }
      renderViewToggles();
      renderMeta();
      updateChart({ resetInteraction: false, hardRefresh: state.chartView === "year" });
      refreshScrubForFocusYear();
    });
  }

  function resetChartInteraction({ hideCrosshair = true } = {}) {
    if (!state.chart) return;
    state.chart.dispatchAction({ type: "hideTip" });
    state.chart.dispatchAction({ type: "downplay", seriesIndex: "all" });
    state.chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
    clearScrubPanel(hideCrosshair);
  }

  function applyChartOption() {
    if (!state.chart) return;
    state.chart.setOption(buildOption(), {
      notMerge: true,
      lazyUpdate: false,
      replaceMerge: ["series", "xAxis", "yAxis", "legend"],
    });
  }

  function updateChart({ resetInteraction = true, hardRefresh = false } = {}) {
    const host = $("#flip-overlay-chart");
    if (!host || !state.data || typeof echarts === "undefined") return;
    if (!state.chart) {
      renderChart();
      return;
    }
    state.isUpdatingChart = true;
    try {
      if (resetInteraction) resetChartInteraction({ hideCrosshair: !hardRefresh });
      if (hardRefresh) state.chart.clear();
      applyChartOption();
    } finally {
      state.isUpdatingChart = false;
    }
    requestAnimationFrame(() => state.chart?.resize());
  }

  function buildOption() {
    const displaySymbols = getDisplaySymbols();
    const scrubPool = isFocusMode() ? displaySymbols : getFilteredSymbolPool();
    const chartSymbols = [...new Map([...displaySymbols, ...scrubPool].map((s) => [s.ticker, s])).values()];
    const allDates = unionDates(chartSymbols.length ? chartSymbols : state.data?.symbols || []);
    const dailyDates = datesInActiveRange(allDates);
    const { keys } = resampleBuckets(dailyDates, state.chartView);
    const displayValueRows = displaySymbols.map((sym) =>
      resampleSymbolSeries(sym, dailyDates, state.chartView, state.mode).values,
    );
    const ordered = applyDateOrder(keys, displayValueRows);
    const focused = applyYearWindowFilter(ordered.keys, ordered.valueRows, state.chartView);
    const scrubValueRows = scrubPool.map((sym) =>
      resampleSymbolSeries(sym, dailyDates, state.chartView, state.mode).values,
    );
    const scrubVolumeData = scrubPool.map((sym) =>
      resampleSymbolVolumeSeries(sym, dailyDates, state.chartView),
    );
    const scrubVolumeRows = scrubVolumeData.map((row) => row.volumes);
    const scrubVolAvgRows = scrubVolumeData.map((row) => row.volAvgs);
    const scrubOrdered = applyDateOrder(keys, scrubValueRows);
    const scrubVolOrdered = applyDateOrder(keys, scrubVolumeRows);
    const scrubVolAvgOrdered = applyDateOrder(keys, scrubVolAvgRows);
    const scrubFocused = applyYearWindowFilter(scrubOrdered.keys, scrubOrdered.valueRows, state.chartView);
    const scrubVolFocused = applyYearWindowFilter(scrubVolOrdered.keys, scrubVolOrdered.valueRows, state.chartView);
    const scrubVolAvgFocused = applyYearWindowFilter(
      scrubVolAvgOrdered.keys,
      scrubVolAvgOrdered.valueRows,
      state.chartView,
    );
    state.dates = focused.keys;
    state.bucketLastDate = bucketLastDateFromSymbols(displaySymbols, focused.keys, state.chartView);
    let walls = wallsInActiveRange(filteredWalls());
    if (isFocusMode()) {
      walls = walls.filter((w) => w.ticker === state.focusTicker);
    }
    rebuildWallIndex(walls);
    const viewLabel = VIEW_MODES.find((v) => v.id === state.chartView)?.label || state.chartView;
    const yName =
      state.mode === "bbWidth"
        ? `BB width (U−L)/M · ${viewLabel}`
        : isAllTimeView()
          ? `Indexed close (100 = range start) · ${viewLabel} · price from ${priceDataStartYear()}`
          : `Indexed close (100 = range start) · ${viewLabel}`;
    const theme = FWJColor.chartTheme();

    const displayColorByTicker = new Map(
      displaySymbols.map((sym, i) => [
        sym.ticker,
        isFocusMode() ? FWJColor.token("--fwj-accent", "#78a9ff") : FWJColor.chartSeries(i),
      ]),
    );

    state.scrubSeries = scrubPool.map((sym, i) => ({
      ticker: sym.ticker,
      values: scrubFocused.valueRows[i] || [],
      volumes: scrubVolFocused.valueRows[i] || [],
      volAvgs: scrubVolAvgFocused.valueRows[i] || [],
      color: displayColorByTicker.get(sym.ticker) ?? FWJColor.token("--fwj-text-dim", "#888"),
      forbesRank: sym.forbesRank ?? null,
      squeezeScore: sym.squeezeScore ?? null,
      onChart: displayColorByTicker.has(sym.ticker),
    }));

    const lineSeries = displaySymbols.map((sym, i) => {
      const color = isFocusMode() ? FWJColor.token("--fwj-accent", "#78a9ff") : FWJColor.chartSeries(i);
      const highlighted = isFocusMode() || state.highlightTicker === sym.ticker;
      const dim =
        !isFocusMode() && state.highlightTicker && !highlighted ? 0.18 : isFocusMode() ? 1 : state.highlightTicker ? 1 : 0.72;
      const values = focused.valueRows[i] || [];
      const series = {
        name: sym.ticker,
        type: "line",
        data: values,
        showSymbol: isFocusMode() || focused.keys.length <= 48,
        symbolSize: isFocusMode() ? 6 : 4,
        smooth: isFocusMode() ? 0.2 : 0.15,
        connectNulls: false,
        lineStyle: { width: isFocusMode() ? 2.8 : highlighted ? 2.4 : 1.2, color, opacity: dim },
        emphasis: { focus: "series", lineStyle: { width: isFocusMode() ? 3.2 : 2.5 } },
        _meta: sym,
      };
      if ((isFocusMode() || highlighted) && lastSeriesValue(values) != null) {
        series.endLabel = highlightEndLabel(sym.ticker, values, color);
      }
      return series;
    });

    if (lineSeries.length && (state.showWalls || isAllTimeView() || isFocusMode())) {
      const markLineData = [];
      if (state.showWalls) markLineData.push(...wallMarkLines(walls));
      markLineData.push(...formationMarkLines(displaySymbols));
      if (isAllTimeView() && !isFocusMode()) {
        markLineData.push(...milestoneMarkLines());
        const highlight = listYearHighlightMarkLine();
        if (highlight) markLineData.push(highlight);
      }
      const markAreaData = [];
      if (!isFocusMode()) {
        const eraAreas = eraMarkAreas(focused.keys, state.chartView);
        if (eraAreas.length) {
          markAreaData.push(...eraAreas);
        }
        const prePriceArea = allTimePrePriceMarkArea();
        if (prePriceArea) markAreaData.push(...(prePriceArea.data || []));
      }
      if (markLineData.length || markAreaData.length) {
        lineSeries.push({
          name: "_walls",
          type: "line",
          data: [],
          ...(markLineData.length
            ? {
                markLine: {
                  symbol: ["none", "none"],
                  silent: true,
                  animation: false,
                  data: markLineData,
                },
              }
            : {}),
          ...(markAreaData.length
            ? {
                markArea: {
                  silent: true,
                  animation: false,
                  data: markAreaData,
                },
              }
            : {}),
        });
      }
    } else if (focused.keys.length) {
      const markAreaData = eraMarkAreas(focused.keys, state.chartView);
      const markLineData = formationMarkLines(displaySymbols);
      if (markAreaData.length || markLineData.length) {
        lineSeries.push({
          name: "_walls",
          type: "line",
          data: [],
          ...(markLineData.length
            ? {
                markLine: {
                  symbol: ["none", "none"],
                  silent: true,
                  animation: false,
                  data: markLineData,
                },
              }
            : {}),
          ...(markAreaData.length
            ? {
                markArea: {
                  silent: true,
                  animation: false,
                  data: markAreaData,
                },
              }
            : {}),
        });
      }
    }

    return {
      backgroundColor: theme.background,
      animation: false,
      grid: {
        left: 52,
        right: isFocusMode() ? 88 : state.highlightTicker ? 72 : isAllTimeView() ? 88 : 16,
        top: isFocusMode() ? 36 : isAllTimeView() ? 52 : 44,
        bottom: isFocusMode() ? 56 : 48,
      },
      tooltip: {
        trigger: "axis",
        showContent: false,
        confine: true,
        axisPointer: {
          type: "line",
          snap: true,
          label: crosshairDateLabel(),
          lineStyle: { color: theme.textMuted, width: 1, type: "dashed", opacity: 0.7 },
        },
        position(point, _params, _dom, _rect, size) {
          const [x, y] = point;
          const [viewW, viewH] = size.viewSize;
          const [boxW, boxH] = size.contentSize;
          let left = x + 12;
          let top = y - boxH - 12;
          if (left + boxW > viewW - 8) left = Math.max(8, x - boxW - 12);
          if (top < 8) top = y + 12;
          if (top + boxH > viewH - 8) top = Math.max(8, viewH - boxH - 8);
          return [left, top];
        },
      },
      axisPointer: {
        type: "line",
        snap: true,
        link: [{ xAxisIndex: "all" }],
        lineStyle: { color: theme.textMuted, width: 1, type: "dashed", opacity: 0.7 },
      },
      legend: isFocusMode()
        ? { show: false }
        : {
            type: "scroll",
            bottom: 0,
            textStyle: { color: theme.textMuted, fontSize: 10 },
            pageTextStyle: { color: theme.textMuted },
            data: displaySymbols.map((s) => s.ticker),
            selectedMode: false,
          },
      xAxis: {
        type: "category",
        data: focused.keys,
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: {
          color: theme.textMuted,
          fontSize: 10,
          hideOverlap: true,
          interval: (index) => xAxisLabelInterval(index),
          formatter: (value, index) => formatBucketLabel(value, index),
        },
        splitLine: { show: false },
        axisPointer: {
          show: true,
          snap: true,
          label: crosshairDateLabel(),
        },
      },
      yAxis: {
        type: "value",
        name: yName,
        nameTextStyle: { color: theme.textDim, fontSize: 10 },
        axisLine: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.grid } },
        scale: true,
        axisPointer: { label: { show: false } },
      },
      series: lineSeries,
    };
  }

  function onChartClick(params) {
    if (params.componentType === "legend") {
      if (params.name && params.name !== "_walls") enterFocus(params.name);
      return;
    }
    if (!params.seriesName || params.seriesName === "_walls") return;
    enterFocus(params.seriesName);
  }

  function bindChartClick() {
    if (!state.chart || state.clickBound) return;
    state.chart.on("click", onChartClick);
    state.clickBound = true;
  }

  function unbindChartClick() {
    if (!state.chart) return;
    state.chart.off("click", onChartClick);
    state.clickBound = false;
  }

  function renderChart() {
    const host = $("#flip-overlay-chart");
    if (!host || !state.data || typeof echarts === "undefined") return;

    if (state.chart) {
      unbindScrubEvents();
      unbindChartClick();
      state.chart.dispose();
      state.chart = null;
    }
    state.chart = echarts.init(host, null, { renderer: "canvas" });
    applyChartOption();
    bindScrubEvents();
    bindChartClick();
    clearScrubPanel();
    state.chart.resize();
  }

  function symbolsInActiveRange() {
    const { start, end } = activeDateRange();
    return (state.data?.symbols || []).filter((sym) =>
      (sym.series || []).some((p) => p.date >= start && p.date <= end),
    ).length;
  }

  function renderMeta() {
    const el = $("#flip-overlay-meta");
    if (!el || !state.data) return;
    const { start, end } = activeDateRange();
    const walls = wallsInActiveRange(filteredWalls());
    const pool = getFilteredSymbolPool();
    const shown = getDisplaySymbols().length;
    const total = pool.length;
    const symbolLabel =
      shown < total ? `${shown}/${total} symbols` : `${total} symbols`;
    const orderLabel = state.dateOrder === "desc" ? "date ↓" : "date ↑";
    const sortLabel = symbolFilterLabel();
    const span = isAllTimeView() ? allTimeSpan() : null;
    const spanNote = span ? ` · timeline ${span.start}→${span.end}` : "";
    const milestoneNote = isAllTimeView() ? ` · ${state.allTimeMilestones.length} milestones` : "";
    const focusYear = getFocusYear();
    const yearNote = yearNavActive() && focusYear != null ? ` · year ${focusYear}` : "";
    const formationCount = (state.data?.symbols || []).filter((s) => formationInRange(s)).length;
    const formationNote = formationCount ? ` · ${formationCount} formation dates` : "";
    el.textContent = `${symbolLabel} · ${sortLabel} · ${walls.length} flip walls · ${start} → ${end} · ${orderLabel}${yearNote}${spanNote}${milestoneNote}${formationNote} · as of ${state.data.asOf || "—"}`;
  }

  function setChartView(view, opts = {}) {
    if (!VIEW_MODES.some((v) => v.id === view) || state.chartView === view) return;
    state.chartView = view;
    if (isAllTimeView()) {
      state.listYearHighlight = opts.focusYear ?? defaultFocusYear("alltime");
      state.focusYear = null;
    } else if (view === "year") {
      state.focusYear = opts.focusYear ?? defaultFocusYear("year");
    } else {
      state.listYearHighlight = null;
    }
    renderViewToggles();
    renderSymbolSortBar();
    renderMeta();
    updateChart({ hardRefresh: true });
    if (yearNavActive()) {
      const fy = getFocusYear();
      if (fy != null) syncFocusYearExternal(fy);
      refreshScrubForFocusYear();
    }
  }

  function setDatePreset(preset) {
    if (!DATE_PRESETS.some((p) => p.id === preset) || state.datePreset === preset) return;
    state.datePreset = preset;
    renderDateRange();
    renderDateInputs();
    renderSymbolSortBar();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function setCustomDateRange(start, end) {
    const { start: windowStart, end: windowEnd } = getWindowBounds();
    if (!start || !end) return;
    state.customStart = start < windowStart ? windowStart : start;
    state.customEnd = end > windowEnd ? windowEnd : end;
    state.datePreset = "custom";
    renderDateRange();
    renderDateInputs();
    renderSymbolSortBar();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function toggleDateOrder() {
    state.dateOrder = state.dateOrder === "asc" ? "desc" : "asc";
    renderDateOrder();
    renderMeta();
    updateChart({ hardRefresh: true });
  }

  function bindToolbarEvents() {
    const orderBtn = $("#flip-overlay-date-order");
    if (orderBtn && !orderBtn.dataset.bound) {
      orderBtn.dataset.bound = "1";
      orderBtn.addEventListener("click", toggleDateOrder);
    }

    const startInput = $("#flip-overlay-start");
    const endInput = $("#flip-overlay-end");
    if (startInput && endInput && !startInput.dataset.bound) {
      startInput.dataset.bound = "1";
      const onCustomChange = () => {
        if (!startInput.value || !endInput.value) return;
        setCustomDateRange(startInput.value, endInput.value);
      };
      startInput.addEventListener("change", onCustomChange);
      endInput.addEventListener("change", onCustomChange);
    }

    const rangeRoot = $("#flip-overlay-range");
    if (rangeRoot && !rangeRoot.dataset.bound) {
      rangeRoot.dataset.bound = "1";
      rangeRoot.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".flip-overlay-range-chip");
        if (!btn || !rangeRoot.contains(btn)) return;
        setDatePreset(btn.dataset.preset);
      });
    }

    const viewRoot = $("#flip-overlay-views");
    if (viewRoot && !viewRoot.dataset.bound) {
      viewRoot.dataset.bound = "1";
      viewRoot.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".flip-overlay-view");
        if (btn && viewRoot.contains(btn)) {
          setChartView(btn.dataset.view);
          return;
        }
        const prevBtn = ev.target.closest("#flip-overlay-year-prev");
        const nextBtn = ev.target.closest("#flip-overlay-year-next");
        if (prevBtn && !prevBtn.disabled) stepFocusYear(-1);
        else if (nextBtn && !nextBtn.disabled) stepFocusYear(1);
      });
    }

    const intervalRoot = $("#flip-overlay-intervals");
    if (intervalRoot && !intervalRoot.dataset.bound) {
      intervalRoot.dataset.bound = "1";
      intervalRoot.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".flip-overlay-chip");
        if (!btn || !intervalRoot.contains(btn)) return;
        const tf = btn.dataset.tf;
        if (!tf) return;
        if (state.intervals.has(tf)) state.intervals.delete(tf);
        else state.intervals.add(tf);
        if (!state.intervals.size) state.intervals.add(tf);
        renderIntervalToggles();
        renderSymbolSortBar();
        renderMeta();
        updateChart();
      });
    }

    const modeRoot = $("#flip-overlay-modes");
    if (modeRoot && !modeRoot.dataset.bound) {
      modeRoot.dataset.bound = "1";
      modeRoot.addEventListener("click", (ev) => {
        const btn = ev.target.closest(".flip-overlay-mode");
        if (!btn || !modeRoot.contains(btn)) return;
        const mode = btn.dataset.mode;
        if (!mode || state.mode === mode) return;
        state.mode = mode;
        renderModeToggles();
        updateChart({ hardRefresh: true });
      });
    }
  }

  function renderDateRange() {
    const root = $("#flip-overlay-range");
    if (!root) return;
    root.innerHTML = DATE_PRESETS.map(
      (preset) =>
        `<button type="button" class="flip-overlay-range-chip${state.datePreset === preset.id ? " active" : ""}" data-preset="${preset.id}" aria-pressed="${state.datePreset === preset.id}">${presetButtonLabel(preset)}</button>`,
    ).join("");
  }

  function renderDateInputs() {
    const startInput = $("#flip-overlay-start");
    const endInput = $("#flip-overlay-end");
    if (!startInput || !endInput) return;
    const { start: windowStart, end: windowEnd } = getWindowBounds();
    startInput.min = windowStart;
    startInput.max = windowEnd;
    endInput.min = windowStart;
    endInput.max = windowEnd;
    const { start, end } = activeDateRange();
    startInput.value = start;
    endInput.value = end;
  }

  function renderDateOrder() {
    const btn = $("#flip-overlay-date-order");
    if (!btn) return;
    const isDesc = state.dateOrder === "desc";
    btn.textContent = isDesc ? "Date ↓" : "Date ↑";
    btn.setAttribute("aria-pressed", isDesc ? "true" : "false");
    btn.title = isDesc ? "Chart dates: newest first (click for oldest first)" : "Chart dates: oldest first (click for newest first)";
  }

  function renderYearNavHtml() {
    if (!yearNavActive()) return "";
    const year = getFocusYear();
    const { start, end } = yearNavBounds();
    const atMinYear = year != null && year <= start;
    const prevToAllTime = state.chartView === "year" && atMinYear;
    const prevDisabled = year == null || (isAllTimeView() && atMinYear);
    const nextDisabled = year == null || year >= end;
    const prevLabel = prevToAllTime ? "All Time" : "Previous year";
    const prevTitle = prevToAllTime ? "Back to All Time view" : "Previous year";
    return `<span class="flip-overlay-year-nav-sep" aria-hidden="true"></span>
      <button type="button" class="flip-overlay-year-nav${prevToAllTime ? " flip-overlay-year-nav-alltime" : ""}" id="flip-overlay-year-prev"${prevDisabled ? " disabled" : ""} aria-label="${prevLabel}" title="${prevTitle}">‹</button>
      <span class="flip-overlay-year-nav-label" aria-live="polite">${year ?? "—"}</span>
      <button type="button" class="flip-overlay-year-nav" id="flip-overlay-year-next"${nextDisabled ? " disabled" : ""} aria-label="Next year" title="Next year">›</button>`;
  }

  function renderViewToggles() {
    const root = $("#flip-overlay-views");
    if (!root) return;
    const yearNav = renderYearNavHtml();
    root.innerHTML = VIEW_MODES.map((view) => {
      const btn = `<button type="button" class="flip-overlay-view${view.id === "alltime" ? " flip-overlay-view-alltime" : ""}${state.chartView === view.id ? " active" : ""}" data-view="${view.id}" aria-pressed="${state.chartView === view.id}">${view.label}</button>`;
      let html = view.id === "alltime" ? `${btn}<span class="flip-overlay-view-sep" aria-hidden="true">|</span>` : btn;
      if (view.id === "year") html += yearNav;
      return html;
    }).join("");
  }

  function renderIntervalToggles() {
    const root = $("#flip-overlay-intervals");
    if (!root) return;
    const labels = { quarter: "Q", month: "M", week: "W", day: "D" };
    root.innerHTML = Object.keys(labels)
      .map((tf) => {
        const active = state.intervals.has(tf) ? " active" : "";
        const count = state.data?.summary?.timeframes?.[tf] ?? 0;
        return `<button type="button" class="flip-overlay-chip${active}" data-tf="${tf}" style="--chip-accent:${flipColor(INTERVAL_COLORS, tf)}">${labels[tf]} <span class="muted">${count}</span></button>`;
      })
      .join("");

  }

  function renderModeToggles() {
    const root = $("#flip-overlay-modes");
    if (!root) return;
    root.innerHTML = [
      { id: "norm", label: "Indexed price" },
      { id: "bbWidth", label: "BB bandwidth" },
    ]
      .map(
        (m) =>
          `<button type="button" class="flip-overlay-mode${state.mode === m.id ? " active" : ""}" data-mode="${m.id}">${m.label}</button>`,
      )
      .join("");

  }

  function renderLegendChips() {
    const root = $("#flip-overlay-legend");
    if (!root || !state.data) return;
    const typeCounts = state.data.summary?.flipTypes || {};
    const types = Object.keys(typeCounts).slice(0, 12);
    root.innerHTML = `
      <div class="flip-overlay-legend-row">
        <span class="flip-overlay-legend-label">Era bands</span>
        ${eraLegendSwatches()}
        <span class="flip-era-note muted">cooler → older · warmer → newer</span>
      </div>
      <div class="flip-overlay-legend-row">
        <span class="flip-overlay-legend-label">Formation</span>
        <span class="flip-legend-formation founding" title="Founded">Founded</span>
        <span class="flip-legend-formation ipo" title="IPO">IPO</span>
      </div>
      <div class="flip-overlay-legend-row">
        <span class="flip-overlay-legend-label">Intervals</span>
        ${Object.entries(INTERVAL_COLORS)
          .map(([tf]) => `<span class="flip-legend-swatch" style="background:${flipColor(INTERVAL_COLORS, tf)}" title="${tf}"></span><span class="flip-legend-tf">${tf[0].toUpperCase()}</span>`)
          .join("")}
      </div>
      <div class="flip-overlay-legend-row">
        <span class="flip-overlay-legend-label">Flip types</span>
        ${types
          .map(
            (t) =>
              `<span class="flip-legend-type" style="--type-color:${flipColor(FLIP_TYPE_COLORS, t)}">${escapeHtml(t.replace(/_/g, " "))}</span>`,
          )
          .join("")}
      </div>
      ${
        isFocusMode()
          ? (() => {
              const fm = formationMetaForTicker(state.focusTicker);
              const fmText = fm
                ? ` · ${fm.type === "ipo" ? "IPO" : "Founded"} ${fm.iso.slice(0, 4)} (${escapeHtml(fm.label)})`
                : "";
              return `<p class="flip-overlay-highlight flip-overlay-focus-banner">Focus <strong>${escapeHtml(state.focusTicker)}</strong>${fmText} · flip walls for this symbol · <button type="button" class="flip-overlay-clear" id="flip-overlay-clear" title="Return to multi-symbol overlay">← Back to symbols</button></p>`;
            })()
          : state.highlightTicker
            ? (() => {
                const fm = formationMetaForTicker(state.highlightTicker);
                const fmText = fm
                  ? ` · ${fm.type === "ipo" ? "IPO" : "Founded"} ${fm.iso.slice(0, 4)} (${escapeHtml(fm.label)})`
                  : "";
                return `<p class="flip-overlay-highlight">Highlighting <strong>${escapeHtml(state.highlightTicker)}</strong>${fmText} · click line to focus</p>`;
              })()
            : `<p class="flip-overlay-legend-hint muted">Click a line, legend ticker, or scrub row to focus one symbol.</p>`
      }`;

    const clear = $("#flip-overlay-clear", root);
    if (clear) {
      clear.addEventListener("click", () => exitFocus());
    }
  }

  function renderWallToggle() {
    const btn = $("#flip-overlay-walls-toggle");
    if (!btn) return;
    btn.classList.toggle("active", state.showWalls);
    btn.textContent = state.showWalls ? "Walls on" : "Walls off";
    btn.onclick = () => {
      state.showWalls = !state.showWalls;
      renderWallToggle();
      updateChart();
    };
  }

  function bindResize() {
    window.addEventListener("resize", () => {
      state.chart?.resize();
    });
  }

  async function loadHistoricalContext() {
    const bust = DATA_CACHE_BUST;
    const fetches = [
      fetch(`${HISTORICAL_INDEX_URL}?v=${bust}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${GROK_EVENTS_URL}?v=${bust}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${WORLD_CONTEXT_URL}?v=${bust}`).then((r) => (r.ok ? r.json() : null)),
    ];
    try {
      const [historicalIndex, grokEvents, worldContext] = await Promise.all(fetches);
      state.historicalIndex = historicalIndex;
      state.grokEvents = grokEvents;
      state.worldContext = worldContext;
      state.allTimeMilestones = buildAllTimeMilestones();
    } catch {
      state.historicalIndex = null;
      state.grokEvents = null;
      state.worldContext = null;
      state.allTimeMilestones = buildAllTimeMilestones();
    }
  }

  async function init() {
    const host = $("#flip-overlay-chart");
    if (!host) return;

    try {
      await loadHistoricalContext();
      const res = await fetch(`${DATA_URL}?v=${DATA_CACHE_BUST}`);
      if (!res.ok) throw new Error(`${res.status}`);
      state.data = await res.json();
      if (!state.data.symbols?.length) {
        host.innerHTML = '<p class="muted" style="padding:16px">No overlay symbols — rebuild with chart data in market-crossover.json.</p>';
        return;
      }
      bindListYearSync();
      renderMeta();
      bindSymbolSortEvents();
      renderSymbolSortBar();
      bindScrubSortEvents();
      bindScrubSymbolClicks();
      renderScrubSortChips();
      bindToolbarEvents();
      renderDateRange();
      renderDateInputs();
      renderDateOrder();
      renderViewToggles();
      renderIntervalToggles();
      renderModeToggles();
      renderWallToggle();
      applyDisplayModeChrome();
      renderLegendChips();
      renderChart();
      bindResize();
    } catch (err) {
      host.innerHTML = `<p class="muted" style="padding:16px">Failed to render flip overlay chart: ${escapeHtml(err.message)}. Run <code>python3 scripts/build_industry_stream.py</code> if data is missing.</p>`;
    }
  }

  window.FlipOverlayChart = {
    init,
    renderChart,
    updateChart,
    setDatePreset,
    setChartView,
    setCustomDateRange,
    toggleDateOrder,
    setScrubSortMode,
    setSymbolFilterMode,
    enterFocus,
    exitFocus,
    toggleExpandMode,
    isFocusMode,
    getDisplayMode: () => state.displayMode,
    isAllTimeView,
    getChartView: () => state.chartView,
    setListYearHighlight: (year) => {
      if (year == null) {
        state.listYearHighlight = null;
        return;
      }
      const unchanged =
        (isAllTimeView() && state.listYearHighlight === year) ||
        (state.chartView === "year" && state.focusYear === year);
      if (isAllTimeView()) state.listYearHighlight = year;
      if (state.chartView === "year") state.focusYear = year;
      if (!yearNavActive() || unchanged) return;
      renderViewToggles();
      renderMeta();
      updateChart({ resetInteraction: false, hardRefresh: state.chartView === "year" });
      refreshScrubForFocusYear();
    },
    stepFocusYear,
    setFocusYear,
    getFocusYear,
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

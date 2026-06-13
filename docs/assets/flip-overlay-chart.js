/**
 * Forbes multi-symbol overlay + flip vertical walls (Q/M/W/D).
 * Data: data/flip-overlay.json (built by scripts/build_industry_stream.py)
 */
(function () {
  "use strict";

  const DATA_URL = "data/flip-overlay.json";

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

  const state = {
    data: null,
    chart: null,
    mode: "norm",
    intervals: new Set(["quarter", "month", "week", "day"]),
    showWalls: true,
    highlightTicker: null,
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
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

  function seriesForSymbol(sym, dates, mode) {
    const byDate = new Map((sym.series || []).map((p) => [p.date, p]));
    const key = mode === "bbWidth" ? "bbWidth" : "norm";
    return dates.map((d) => {
      const p = byDate.get(d);
      const v = p?.[key];
      return v == null ? null : v;
    });
  }

  function filteredWalls() {
    if (!state.data?.walls) return [];
    return state.data.walls.filter((w) => state.intervals.has(w.timeframe));
  }

  function wallMarkLines(walls) {
    if (!state.showWalls || !walls.length) return [];
    const seen = new Set();
    const lines = [];
    for (const w of walls) {
      const key = `${w.date}::${w.timeframe}::${w.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tfColor = flipColor(INTERVAL_COLORS, w.timeframe);
      const typeColor = flipColor(FLIP_TYPE_COLORS, w.type) || tfColor;
      lines.push({
        xAxis: w.date,
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

  function buildOption() {
    const symbols = state.data?.symbols || [];
    const dates = unionDates(symbols);
    const walls = filteredWalls();
    const yName = state.mode === "bbWidth" ? "BB width (U−L)/M" : "Indexed close (100 = window start)";

    const lineSeries = symbols.map((sym, i) => {
      const color = FWJColor.chartSeries(i);
      const dim =
        state.highlightTicker && state.highlightTicker !== sym.ticker ? 0.18 : state.highlightTicker ? 1 : 0.72;
      return {
        name: sym.ticker,
        type: "line",
        data: seriesForSymbol(sym, dates, state.mode),
        showSymbol: false,
        smooth: 0.15,
        connectNulls: false,
        lineStyle: { width: state.highlightTicker === sym.ticker ? 2.4 : 1.2, color, opacity: dim },
        emphasis: { focus: "series", lineStyle: { width: 2.5 } },
        _meta: sym,
      };
    });

    if (lineSeries.length && state.showWalls) {
      lineSeries.push({
        name: "_walls",
        type: "line",
        data: [],
        markLine: {
          symbol: ["none", "none"],
          silent: true,
          animation: false,
          data: wallMarkLines(walls),
        },
      });
    }

    const theme = FWJColor.chartTheme();

    return {
      backgroundColor: theme.background,
      animation: false,
      grid: { left: 52, right: 16, top: 36, bottom: 48 },
      tooltip: {
        trigger: "axis",
        backgroundColor: theme.background,
        borderColor: theme.border,
        textStyle: { color: theme.text, fontSize: 11 },
        formatter(params) {
          const rows = (params || []).filter((p) => p.seriesName && p.seriesName !== "_walls");
          if (!rows.length) return "";
          const date = rows[0].axisValue;
          const dayWalls = walls.filter((w) => w.date === date).slice(0, 8);
          let html = `<strong>${date}</strong>`;
          rows.slice(0, 10).forEach((r) => {
            if (r.data == null) return;
            const val =
              state.mode === "bbWidth"
                ? Number(r.data).toFixed(4)
                : Number(r.data).toFixed(1);
            html += `<br/><span style="color:${r.color}">●</span> ${r.seriesName} ${val}`;
          });
          if (rows.length > 10) html += `<br/><span style="color:${theme.textMuted}">+${rows.length - 10} more</span>`;
          if (dayWalls.length) {
            html += `<br/><span style="color:${theme.textMuted}">Flips:</span> ${dayWalls
              .map((w) => `${w.ticker} ${w.timeframe ? w.timeframe[0].toUpperCase() : ""}:${w.label}`)
              .join(" · ")}`;
          }
          return html;
        },
      },
      legend: {
        type: "scroll",
        bottom: 0,
        textStyle: { color: theme.textMuted, fontSize: 10 },
        pageTextStyle: { color: theme.textMuted },
        data: symbols.map((s) => s.ticker),
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.textMuted, fontSize: 10, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: yName,
        nameTextStyle: { color: theme.textDim, fontSize: 10 },
        axisLine: { show: false },
        axisLabel: { color: theme.textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.grid } },
        scale: true,
      },
      series: lineSeries,
    };
  }

  function renderChart() {
    const host = $("#flip-overlay-chart");
    if (!host || !state.data || typeof echarts === "undefined") return;

    if (state.chart) state.chart.dispose();
    state.chart = echarts.init(host, null, { renderer: "canvas" });
    state.chart.setOption(buildOption());

    state.chart.off("click");
    state.chart.on("click", (params) => {
      if (!params.seriesName || params.seriesName === "_walls") return;
      state.highlightTicker = state.highlightTicker === params.seriesName ? null : params.seriesName;
      renderLegendChips();
      state.chart.setOption(buildOption(), { notMerge: true });
    });
  }

  function renderMeta() {
    const el = $("#flip-overlay-meta");
    if (!el || !state.data) return;
    const s = state.data.summary || {};
    const w = state.data.window || {};
    el.textContent = `${s.symbolCount ?? 0} symbols · ${s.wallCount ?? 0} flip walls · ${w.start ?? ""} → ${w.end ?? ""} · as of ${state.data.asOf || "—"}`;
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

    root.querySelectorAll(".flip-overlay-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tf = btn.dataset.tf;
        if (state.intervals.has(tf)) state.intervals.delete(tf);
        else state.intervals.add(tf);
        if (!state.intervals.size) state.intervals.add(tf);
        renderIntervalToggles();
        renderChart();
      });
    });
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

    root.querySelectorAll(".flip-overlay-mode").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        renderModeToggles();
        renderChart();
      });
    });
  }

  function renderLegendChips() {
    const root = $("#flip-overlay-legend");
    if (!root || !state.data) return;
    const typeCounts = state.data.summary?.flipTypes || {};
    const types = Object.keys(typeCounts).slice(0, 12);
    root.innerHTML = `
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
        state.highlightTicker
          ? `<p class="flip-overlay-highlight">Highlighting <strong>${escapeHtml(state.highlightTicker)}</strong> · click chart or <button type="button" class="flip-overlay-clear" id="flip-overlay-clear">clear</button></p>`
          : ""
      }`;

    const clear = $("#flip-overlay-clear", root);
    if (clear) {
      clear.addEventListener("click", () => {
        state.highlightTicker = null;
        renderLegendChips();
        renderChart();
      });
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
      renderChart();
    };
  }

  function bindResize() {
    window.addEventListener("resize", () => {
      state.chart?.resize();
    });
  }

  async function init() {
    const host = $("#flip-overlay-chart");
    if (!host) return;

    try {
      const res = await fetch(DATA_URL);
      if (!res.ok) throw new Error(`${res.status}`);
      state.data = await res.json();
      if (!state.data.symbols?.length) {
        host.innerHTML = '<p class="muted" style="padding:16px">No overlay symbols — rebuild with chart data in market-crossover.json.</p>';
        return;
      }
      renderMeta();
      renderIntervalToggles();
      renderModeToggles();
      renderWallToggle();
      renderLegendChips();
      renderChart();
      bindResize();
    } catch (err) {
      host.innerHTML = `<p class="muted" style="padding:16px">Failed to load ${DATA_URL}: ${escapeHtml(err.message)}. Run <code>python3 scripts/build_industry_stream.py</code>.</p>`;
    }
  }

  window.FlipOverlayChart = { init, renderChart };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

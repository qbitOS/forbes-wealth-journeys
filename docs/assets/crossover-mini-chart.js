/**
 * Crossover-style mini charts — price + Bollinger (top) · MACD (bottom)
 * Data: market-crossover.json → symbol.market.chart
 */
(function () {
  'use strict';

  const FLIP_COLORS = {
    macd_bullish: '#3dd68c',
    macd_bearish: '#f07178',
    histogram_bullish: '#3dd68c',
    histogram_bearish: '#f07178',
    bb_upper_breakout: '#7aa2f7',
    bb_upper_reentry: '#9aa0a6',
    bb_lower_breakdown: '#f07178',
    bb_lower_reentry: '#7aa2f7',
    bb_middle_bullish: '#e6c068',
    bb_middle_bearish: '#e6c068',
  };

  const instances = new Map();

  function disposeIn(root) {
    if (!root) return;
    root.querySelectorAll('[data-crossover-chart]').forEach((el) => {
      const chart = instances.get(el.id);
      if (chart) {
        chart.dispose();
        instances.delete(el.id);
      }
    });
  }

  function flipMarkLines(flips, dates) {
    const dateSet = new Set(dates);
    return (flips || [])
      .filter((f) => dateSet.has(f.date))
      .map((f) => ({
        xAxis: f.date,
        lineStyle: { color: FLIP_COLORS[f.type] || '#9aa0a6', type: 'dashed', width: 1, opacity: 0.65 },
        label: { show: false },
      }));
  }

  function render(container, chartData, marketMeta) {
    if (!container || !chartData?.points?.length || typeof echarts === 'undefined') return null;

    const existing = instances.get(container.id);
    if (existing) existing.dispose();

    const points = chartData.points;
    const dates = points.map((p) => p.date);
    const closes = points.map((p) => p.close);
    const bbU = points.map((p) => p.bbU);
    const bbM = points.map((p) => p.bbM);
    const bbL = points.map((p) => p.bbL);
    const macd = points.map((p) => p.macd);
    const signal = points.map((p) => p.signal);
    const hist = points.map((p) => p.hist);
    const marks = flipMarkLines(chartData.flips, dates);

    const chart = echarts.init(container, null, { renderer: 'canvas' });
    chart.setOption({
      backgroundColor: '#12151a',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        backgroundColor: 'rgba(18, 21, 26, 0.95)',
        borderColor: '#2a3038',
        textStyle: { color: '#e8eaed', fontSize: 11 },
        formatter(params) {
          const rows = Array.isArray(params) ? params : [params];
          const date = rows[0]?.axisValue || '';
          const close = rows.find((r) => r.seriesName === 'Close')?.data;
          const m = rows.find((r) => r.seriesName === 'MACD')?.data;
          const s = rows.find((r) => r.seriesName === 'Signal')?.data;
          let html = `<strong>${date}</strong>`;
          if (close != null) html += `<br/>Close $${Number(close).toFixed(2)}`;
          if (m != null && s != null) html += `<br/>MACD ${Number(m).toFixed(3)} · Sig ${Number(s).toFixed(3)}`;
          if (marketMeta?.macdBias) html += `<br/>Bias ${marketMeta.macdBias}`;
          return html;
        },
      },
      axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
      grid: [
        { left: 42, right: 8, top: 18, height: '52%' },
        { left: 42, right: 8, top: '68%', height: '24%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#2a3038' } },
          axisLabel: { show: false },
          axisTick: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#2a3038' } },
          axisLabel: { color: '#9aa0a6', fontSize: 9, interval: Math.floor(dates.length / 3) },
          axisTick: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          splitNumber: 3,
          axisLabel: { color: '#9aa0a6', fontSize: 9, formatter: (v) => `$${v}` },
          splitLine: { lineStyle: { color: '#2a3038' } },
        },
        {
          gridIndex: 1,
          scale: true,
          splitNumber: 2,
          axisLabel: { color: '#9aa0a6', fontSize: 8 },
          splitLine: { lineStyle: { color: '#2a3038' } },
        },
      ],
      series: [
        {
          name: 'BB Upper',
          type: 'line',
          data: bbU,
          symbol: 'none',
          lineStyle: { width: 1, color: 'rgba(122, 162, 247, 0.45)' },
          stack: 'bb',
          areaStyle: { color: 'rgba(122, 162, 247, 0.06)' },
          markLine: { symbol: 'none', data: marks, silent: true },
        },
        {
          name: 'BB Mid',
          type: 'line',
          data: bbM,
          symbol: 'none',
          lineStyle: { width: 1, color: 'rgba(154, 160, 166, 0.55)' },
        },
        {
          name: 'BB Lower',
          type: 'line',
          data: bbL,
          symbol: 'none',
          lineStyle: { width: 1, color: 'rgba(122, 162, 247, 0.45)' },
          stack: 'bb',
          areaStyle: { color: 'rgba(122, 162, 247, 0.06)' },
        },
        {
          name: 'Close',
          type: 'line',
          data: closes,
          symbol: 'none',
          lineStyle: { width: 2, color: '#e8eaed' },
          z: 3,
        },
        {
          name: 'Hist',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: hist.map((v) => ({
            value: v,
            itemStyle: { color: v >= 0 ? 'rgba(61, 214, 140, 0.55)' : 'rgba(240, 113, 120, 0.55)' },
          })),
          barWidth: '60%',
        },
        {
          name: 'MACD',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: macd,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#7aa2f7' },
        },
        {
          name: 'Signal',
          type: 'line',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: signal,
          symbol: 'none',
          lineStyle: { width: 1.2, color: '#e6c068' },
        },
      ],
    });

    instances.set(container.id, chart);
    return chart;
  }

  function mountAll(root) {
    if (!root) return;
    disposeIn(root);
    const payloads = window.__crossoverChartPayloads || {};
    root.querySelectorAll('[data-crossover-chart]').forEach((el) => {
      const payload = payloads[el.dataset.chartId];
      if (payload) render(el, payload.chart, payload.market);
    });
  }

  function resizeAll() {
    instances.forEach((chart) => chart.resize());
  }

  window.CrossoverMiniChart = { render, mountAll, disposeIn, resizeAll };
  window.addEventListener('resize', resizeAll);
})();

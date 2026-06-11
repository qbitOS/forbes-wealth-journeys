/** Mission-critical capsule UI — real-time telemetry stub. */
'use strict';

const METRICS = [
  { id: 'altitude', label: 'ALT km', value: () => (420 + Math.random() * 2).toFixed(1) },
  { id: 'velocity', label: 'VEL km/s', value: () => (7.66 + Math.random() * 0.01).toFixed(3) },
  { id: 'pressure', label: 'CAB kPa', value: () => (101.3 + Math.random() * 0.2).toFixed(1) },
  { id: 'temp', label: 'TEMP °C', value: () => (22 + Math.random()).toFixed(1) },
];

function renderMetrics(container) {
  container.innerHTML = METRICS.map(
    (m) => `<div class="metric"><span>${m.label}</span><span class="value" id="${m.id}">—</span></div>`
  ).join('');
}

function tick() {
  METRICS.forEach((m) => {
    const el = document.getElementById(m.id);
    if (el) el.textContent = m.value();
  });
  const clock = document.getElementById('clock');
  if (clock) clock.textContent = new Date().toISOString().slice(11, 19) + ' UTC';
}

function init() {
  const telemetry = document.getElementById('telemetry');
  if (telemetry) renderMetrics(telemetry);
  tick();
  setInterval(tick, 1000);

  const ack = document.getElementById('ack-btn');
  if (ack) {
    ack.addEventListener('click', () => {
      const phase = document.getElementById('phase');
      if (phase) phase.textContent = 'NOMINAL';
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

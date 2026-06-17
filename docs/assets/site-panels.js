/**
 * Horizontal panel navigation — one full-width section per tab, left-to-right scroll.
 */
(function () {
  const PANEL_SELECTOR = '.site-panel';
  const SNAP_IDLE_MS = 120;
  const SNAP_THRESHOLD_PX = 4;

  function getPanelsRoot() {
    return document.getElementById('site-panels');
  }

  function getPanels() {
    return [...document.querySelectorAll(PANEL_SELECTOR)];
  }

  function resolvePanelId(hashId) {
    if (!hashId || hashId === 'top') return 'forbes';
    if (document.getElementById(hashId)?.classList.contains('site-panel')) return hashId;
    if (hashId.startsWith('forbes')) return 'forbes';
    if (
      hashId.startsWith('timeline-portfolio') ||
      hashId.startsWith('timeline-cluster') ||
      hashId.startsWith('timeline-')
    ) {
      return 'timeline';
    }
    if (hashId.startsWith('quick-start') || hashId.startsWith('member-')) return 'quick-start';
    if (hashId.startsWith('activity')) return 'activity';
    if (hashId.startsWith('configurator') || hashId.startsWith('market-')) return 'configurator';
    if (hashId.startsWith('compliance')) return 'compliance-trading';
    if (hashId.startsWith('industry-stream') || hashId.startsWith('stream-')) return 'industry-stream';
    return null;
  }

  function panelIndex(panel) {
    return getPanels().indexOf(panel);
  }

  function panelLeft(panel) {
    const root = getPanelsRoot();
    const index = panelIndex(panel);
    if (!root || index < 0) return 0;
    return index * root.clientWidth;
  }

  function nearestPanelIndex(root = getPanelsRoot()) {
    const panels = getPanels();
    if (!root || !panels.length) return 0;
    const width = root.clientWidth;
    if (!width) return 0;
    const index = Math.round(root.scrollLeft / width);
    return Math.max(0, Math.min(panels.length - 1, index));
  }

  function isSnapping(root = getPanelsRoot()) {
    return root?.dataset?.snapping === '1';
  }

  function setSnapping(root, active) {
    if (!root) return;
    if (active) root.dataset.snapping = '1';
    else delete root.dataset.snapping;
  }

  function snapToNearestPanel({ behavior = 'auto' } = {}) {
    const root = getPanelsRoot();
    const panels = getPanels();
    if (!root || !panels.length || isSnapping(root)) return;

    const index = nearestPanelIndex(root);
    const targetLeft = index * root.clientWidth;
    const drift = Math.abs(root.scrollLeft - targetLeft);
    if (drift <= SNAP_THRESHOLD_PX) return;

    setSnapping(root, true);
    root.scrollTo({ left: targetLeft, behavior });

    const release = () => setSnapping(root, false);
    if (behavior === 'smooth') window.setTimeout(release, 420);
    else requestAnimationFrame(() => requestAnimationFrame(release));
  }

  function scrollToPanel(sectionId, { behavior = 'smooth' } = {}) {
    const root = getPanelsRoot();
    const panel = document.getElementById(sectionId);
    if (!root || !panel?.classList.contains('site-panel')) return false;

    setSnapping(root, true);
    root.scrollTo({ left: panelLeft(panel), behavior });
    window.dispatchEvent(
      new CustomEvent('fwj:panel-visible', { detail: { id: sectionId, behavior: 'navigate' } }),
    );

    const release = () => setSnapping(root, false);
    if (behavior === 'smooth') window.setTimeout(release, 420);
    else requestAnimationFrame(release);
    return true;
  }

  function scrollToHashTarget(hashId, { behavior = 'smooth' } = {}) {
    const panelId = resolvePanelId(hashId);
    if (!panelId) return false;
    const scrolled = scrollToPanel(panelId, { behavior });
    if (!scrolled) return false;
    const target = document.getElementById(hashId);
    if (target && hashId !== panelId) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior, block: 'start' });
      });
    }
    return true;
  }

  function updateHashWithoutScroll(hash) {
    const root = getPanelsRoot();
    const left = root?.scrollLeft ?? 0;
    const url = hash
      ? `${window.location.pathname}${window.location.search}${hash}`
      : `${window.location.pathname}${window.location.search}`;
    history.replaceState({ panelScrollLeft: left }, '', url);
    requestAnimationFrame(() => {
      if (root) root.scrollLeft = left;
    });
  }

  function currentPanelId() {
    const panels = getPanels();
    const index = nearestPanelIndex();
    return panels[index]?.id ?? null;
  }

  function syncNavHighlight() {
    const navLinks = document.querySelectorAll('.site-nav a[data-section]');
    if (!navLinks.length) return;
    const current = currentPanelId();
    const hash = (window.location.hash || '').slice(1);
    navLinks.forEach((link) => {
      const href = (link.getAttribute('href') || '').slice(1);
      const panelId = resolvePanelId(href) || link.dataset.section;
      let active = panelId === current;
      if (panelId === 'timeline' && current === 'timeline') {
        if (href.startsWith('timeline-portfolio')) {
          active = hash.startsWith('timeline-portfolio');
        } else if (href === 'timeline') {
          active = !hash.startsWith('timeline-portfolio');
        }
      }
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function horizontalScrollParent(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node === getPanelsRoot()) return node;
      const style = window.getComputedStyle(node);
      const canScrollX =
        (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay')
        && node.scrollWidth > node.clientWidth + 1;
      if (canScrollX) return node;
      node = node.parentElement;
    }
    return getPanelsRoot();
  }

  function canScrollHorizontally(el, delta) {
    if (!el || el.scrollWidth <= el.clientWidth + 1) return false;
    if (delta < 0) return el.scrollLeft > 0;
    if (delta > 0) return el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    return false;
  }

  function bindWheelRouting() {
    const root = getPanelsRoot();
    if (!root) return;

    root.addEventListener(
      'wheel',
      (event) => {
        const deltaX = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;
        if (!deltaX) return;

        const scrollTarget = horizontalScrollParent(event.target);
        if (scrollTarget && scrollTarget !== root && canScrollHorizontally(scrollTarget, deltaX)) {
          return;
        }

        if (isSnapping(root)) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        root.scrollLeft += deltaX;
      },
      { passive: false },
    );
  }

  function bindNav() {
    document.querySelectorAll('.site-nav a[href^="#"], .site-brand-link[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const id = href.slice(1);
        const panelId = resolvePanelId(id);
        if (!panelId) return;
        e.preventDefault();
        scrollToPanel(panelId);
        updateHashWithoutScroll(`#${id}`);
        syncNavHighlight();
        window.dispatchEvent(
          new CustomEvent('fwj:panel-nav', { detail: { id, panelId, href: `#${id}` } }),
        );
      });
    });

    const root = getPanelsRoot();
    if (root) {
      let scrollTimer;
      root.addEventListener(
        'scroll',
        () => {
          if (!isSnapping(root)) {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
              snapToNearestPanel({ behavior: 'auto' });
              syncNavHighlight();
            }, SNAP_IDLE_MS);
          }
          syncNavHighlight();
        },
        { passive: true },
      );

      root.addEventListener(
        'scrollend',
        () => {
          snapToNearestPanel({ behavior: 'auto' });
          syncNavHighlight();
        },
        { passive: true },
      );
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const panelId = resolvePanelId(hash);
      if (panelId && panelId !== currentPanelId()) {
        scrollToPanel(panelId, { behavior: 'auto' });
      }
      syncNavHighlight();
      window.dispatchEvent(
        new CustomEvent('fwj:panel-nav', { detail: { id: hash, panelId, href: window.location.hash } }),
      );
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const root = getPanelsRoot();
        if (!root) return;
        const index = nearestPanelIndex(root);
        root.scrollLeft = index * root.clientWidth;
        syncNavHighlight();
      }, 100);
    });
  }

  function observePanelVisibility() {
    const root = getPanelsRoot();
    if (!root || !window.IntersectionObserver) return;
    const seen = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.45) return;
          const id = entry.target.id;
          if (seen.has(id)) return;
          seen.add(id);
          window.dispatchEvent(new CustomEvent('fwj:panel-visible', { detail: { id } }));
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
          });
        });
      },
      { root, threshold: [0.45, 0.6, 0.85] },
    );
    getPanels().forEach((panel) => io.observe(panel));
  }

  function restoreFromHash() {
    const hash = window.location.hash.slice(1);
    const panelId = resolvePanelId(hash) || 'forbes';
    scrollToPanel(panelId, { behavior: 'auto' });
    syncNavHighlight();
    if (hash) {
      window.dispatchEvent(
        new CustomEvent('fwj:panel-nav', { detail: { id: hash, panelId, href: window.location.hash } }),
      );
    }
    if (hash && hash !== panelId) {
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }

  function init() {
    if (!getPanelsRoot() || !document.body.classList.contains('site-panels-layout')) return;
    bindWheelRouting();
    bindNav();
    observePanelVisibility();
    restoreFromHash();
    syncNavHighlight();
  }

  window.fwjScrollToSection = scrollToPanel;
  window.fwjScrollToHashTarget = scrollToHashTarget;
  window.fwjResolvePanelId = resolvePanelId;
  window.fwjUpdateHashWithoutScroll = updateHashWithoutScroll;
  window.fwjRestorePanelFromHash = restoreFromHash;
  window.fwjGetPanelsRoot = getPanelsRoot;
  window.fwjSyncNavHighlight = syncNavHighlight;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

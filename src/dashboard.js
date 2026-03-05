// =============================================
// Dashboard - Overview panels & filters
// =============================================

let ffSortAsc = true;

function renderDashboard() {
  renderHeroStats();
  renderMarketComposition();
  renderTopInvestors('all');
  renderConglomerates('ownership');
}

function renderHeroStats() {
  const stocks = Object.keys(stockIndex).length;
  const investors = Object.keys(investorIndex).length;
  const metas = Object.values(stockMeta);
  const avgFF = metas.reduce((s, m) => s + m.freeFloat, 0) / metas.length;
  const localPct = (DATA.filter(d => d.local_foreign === 'L').length / DATA.length) * 100;
  const foreignPct = (DATA.filter(d => d.local_foreign === 'A').length / DATA.length) * 100;

  document.getElementById('heroStats').innerHTML = `
    <div class="hero-card hero-card--clickable" id="heroStocks" title="View all listed stocks">
      <div class="hc-label">Listed Stocks</div>
      <div class="hc-value" style="--accent-text:var(--accent)">${stocks}</div>
      <div class="hc-sub">${DATA[0]?.date || ''}</div>
      <div class="hc-action">View All <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
    </div>
    <div class="hero-card hero-card--clickable" id="heroInvestors" title="View all investors">
      <div class="hc-label">Total Investors</div>
      <div class="hc-value">${investors.toLocaleString()}</div>
      <div class="hc-sub">${DATA.length.toLocaleString()} holdings</div>
      <div class="hc-action">View All <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
    </div>
    <div class="hero-card hero-card--clickable" id="heroFreeFloat" title="Open Free Float Scanner">
      <div class="hc-label">Avg Free Float</div>
      <div class="hc-value">&lt; ${avgFF.toFixed(1)}%</div>
      <div class="hc-sub">Across all stocks</div>
      <div class="hc-action">Scanner <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
    </div>
    <div class="hero-card">
      <div class="hc-label">Local Holders</div>
      <div class="hc-value">${localPct.toFixed(1)}%</div>
      <div class="hc-sub">${DATA.filter(d => d.local_foreign === 'L').length.toLocaleString()} entries</div>
    </div>
    <div class="hero-card">
      <div class="hc-label">Foreign Holders</div>
      <div class="hc-value">${foreignPct.toFixed(1)}%</div>
      <div class="hc-sub">${DATA.filter(d => d.local_foreign === 'A').length.toLocaleString()} entries</div>
    </div>`;
}

// ---- Free Float Slider ----
function initFreeFloatSlider() {
  const minInput = document.getElementById('ffMin');
  const maxInput = document.getElementById('ffMax');
  const fill = document.getElementById('ffFill');
  const minLabel = document.getElementById('ffMinLabel');
  const maxLabel = document.getElementById('ffMaxLabel');

  function updateSlider() {
    let lo = parseInt(minInput.value);
    let hi = parseInt(maxInput.value);
    if (lo > hi) { [lo, hi] = [hi, lo]; minInput.value = lo; maxInput.value = hi; }
    fill.style.left = lo + '%';
    fill.style.width = (hi - lo) + '%';
    minLabel.textContent = lo + '%';
    maxLabel.textContent = hi + '%';
    renderFreeFloatScanner();
  }

  minInput.addEventListener('input', updateSlider);
  maxInput.addEventListener('input', updateSlider);

  document.getElementById('ffAsc').addEventListener('click', () => {
    ffSortAsc = true;
    document.getElementById('ffAsc').classList.add('active');
    document.getElementById('ffDesc').classList.remove('active');
    renderFreeFloatScanner();
  });

  document.getElementById('ffDesc').addEventListener('click', () => {
    ffSortAsc = false;
    document.getElementById('ffDesc').classList.add('active');
    document.getElementById('ffAsc').classList.remove('active');
    renderFreeFloatScanner();
  });

  updateSlider();
}

function renderFreeFloatScanner() {
  const lo = parseInt(document.getElementById('ffMin').value);
  const hi = parseInt(document.getElementById('ffMax').value);
  let metas = Object.values(stockMeta).filter(m => m.freeFloat >= lo && m.freeFloat <= hi);

  metas.sort((a, b) => ffSortAsc ? a.freeFloat - b.freeFloat : b.freeFloat - a.freeFloat);

  document.getElementById('ffCount').textContent = `${metas.length} stocks`;

  const el = document.getElementById('ffBody');
  if (!metas.length) {
    el.innerHTML = '<div style="padding:24px;color:var(--text-muted);text-align:center;font-size:13px">No stocks in this range</div>';
    return;
  }

  el.innerHTML = metas.slice(0, 50).map((m, i) => {
    const c = getPctColor(100 - m.freeFloat);
    return `<div class="list-row" data-action="stock" data-key="${m.code}">
      <span class="list-rank">${i + 1}</span>
      <span class="list-code">${m.code}</span>
      <span class="list-name">${escapeHTML(m.issuer)}</span>
      <span class="list-bar-wrap"><div class="list-bar"><div class="list-bar-fill" style="width:${Math.min(m.freeFloat, 100)}%;background:${c}"></div></div></span>
      <span class="list-value" style="color:${c}">&lt; ${m.freeFloat.toFixed(1)}%</span>
    </div>`;
  }).join('') + (metas.length > 50 ? `<div style="padding:10px 0;color:var(--text-muted);font-size:12px;text-align:center">+${metas.length - 50} more</div>` : '');

  bindListClicks(el);
}

// ---- Market Composition (combined: by type + by origin) ----
let mcMode = 'type';

function renderMarketComposition(mode) {
  if (mode) mcMode = mode;
  const el = document.getElementById('mcBody');

  if (mcMode === 'type') {
    renderMCByType(el);
  } else {
    renderMCByOrigin(el);
  }
}

// SVG donut builder with hoverable segments
function buildSVGDonut(items, total, opts = {}) {
  const size = opts.size || 160;
  const thickness = opts.thickness || 30;
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR - thickness;
  let startAngle = -Math.PI / 2;

  let paths = '';
  items.forEach((item, idx) => {
    const slice = (item.value / total) * Math.PI * 2;
    if (slice < 0.001) { startAngle += slice; return; }
    const gap = items.length > 1 ? 0.025 : 0;
    const s = startAngle + gap / 2;
    const e = startAngle + slice - gap / 2;
    const mid = startAngle + slice / 2;
    const large = (slice - gap) > Math.PI ? 1 : 0;

    const x1 = cx + outerR * Math.cos(s);
    const y1 = cy + outerR * Math.sin(s);
    const x2 = cx + outerR * Math.cos(e);
    const y2 = cy + outerR * Math.sin(e);
    const x3 = cx + innerR * Math.cos(e);
    const y3 = cy + innerR * Math.sin(e);
    const x4 = cx + innerR * Math.cos(s);
    const y4 = cy + innerR * Math.sin(s);

    const tx = (Math.cos(mid) * 6).toFixed(1);
    const ty = (Math.sin(mid) * 6).toFixed(1);
    const pct = (item.value / total * 100).toFixed(1);

    paths += `<path class="donut-seg" d="M${x1.toFixed(2)},${y1.toFixed(2)} A${outerR},${outerR} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${innerR},${innerR} 0 ${large} 0 ${x4.toFixed(2)},${y4.toFixed(2)} Z" fill="${item.color}" data-idx="${idx}" data-label="${escapeAttr(item.label)}" data-val="${item.value.toLocaleString()}" data-pct="${pct}%" style="--tx:${tx}px;--ty:${ty}px"/>`;
    startAngle += slice;
  });

  return `<div class="svg-donut-wrap" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" class="svg-donut">${paths}</svg>
    <div class="svg-donut-center">
      <span class="svg-donut-val">${opts.centerValue || total.toLocaleString()}</span>
      <span class="svg-donut-lbl">${opts.centerLabel || 'Total'}</span>
    </div>
  </div>`;
}

// Wire up hover interactions: segment <-> legend cross-highlight + center update
function setupDonutHover(container) {
  const wrap = container.querySelector('.svg-donut-wrap');
  if (!wrap) return;
  const segs = [...wrap.querySelectorAll('.donut-seg')];
  const valEl = wrap.querySelector('.svg-donut-val');
  const lblEl = wrap.querySelector('.svg-donut-lbl');
  const defVal = valEl.textContent;
  const defLbl = lblEl.textContent;
  const legends = [...container.querySelectorAll('.mc-legend-item')];

  function highlight(idx) {
    valEl.textContent = segs[idx].dataset.val;
    lblEl.textContent = segs[idx].dataset.label;
    segs.forEach((s, i) => s.classList.toggle('dimmed', i !== idx));
    segs[idx].classList.add('active');
    legends.forEach((l, i) => l.classList.toggle('dimmed', i !== idx));
  }
  function reset() {
    valEl.textContent = defVal;
    lblEl.textContent = defLbl;
    segs.forEach(s => { s.classList.remove('dimmed'); s.classList.remove('active'); });
    legends.forEach(l => l.classList.remove('dimmed'));
  }

  segs.forEach((seg, i) => {
    seg.addEventListener('mouseenter', () => highlight(i));
    seg.addEventListener('mouseleave', reset);
  });
  legends.forEach((li, i) => {
    li.addEventListener('mouseenter', () => { if (segs[i]) highlight(i); });
    li.addEventListener('mouseleave', reset);
  });
}

function renderMCByType(el) {
  const typeCounts = {};
  for (const d of DATA) { const t = getTypeName(d.investor_type); typeCounts[t] = (typeCounts[t] || 0) + 1; }
  const items = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] || '#94a3b8' }));

  const total = items.reduce((s, i) => s + i.value, 0);

  const legend = items.map((i, idx) => {
    const pct = (i.value / total * 100);
    return `<div class="mc-legend-item" data-idx="${idx}">
      <span class="mc-legend-dot" style="background:${i.color}"></span>
      <span class="mc-legend-label">${i.label}</span>
      <span class="mc-legend-value">${i.value.toLocaleString()}</span>
      <span class="mc-legend-pct">${pct.toFixed(1)}%</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="mc-chart-vertical">
      <div class="mc-donut-center-wrap">
        ${buildSVGDonut(items, total, { centerValue: total.toLocaleString(), centerLabel: 'Holdings' })}
      </div>
      <div class="mc-legend">${legend}</div>
    </div>`;

  setupDonutHover(el);
}

function renderMCByOrigin(el) {
  const local = DATA.filter(d => d.local_foreign === 'L');
  const foreign = DATA.filter(d => d.local_foreign === 'A');
  const localPct = local.length / DATA.length * 100;
  const foreignPct = foreign.length / DATA.length * 100;
  const otherCount = DATA.length - local.length - foreign.length;

  const domCounts = {};
  for (const d of foreign) domCounts[d.domicile || 'Unknown'] = (domCounts[d.domicile || 'Unknown'] || 0) + 1;
  const topDoms = Object.entries(domCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const originItems = [
    { label: 'Local', value: local.length, color: '#34d399' },
    { label: 'Foreign', value: foreign.length, color: '#60a5fa' },
  ];
  if (otherCount > 0) originItems.push({ label: 'Other', value: otherCount, color: '#94a3b8' });
  const originTotal = DATA.length;

  const legend = originItems.map((i, idx) => {
    const pct = (i.value / originTotal * 100);
    return `<div class="mc-legend-item" data-idx="${idx}">
      <span class="mc-legend-dot" style="background:${i.color}"></span>
      <span class="mc-legend-label">${i.label}</span>
      <span class="mc-legend-value">${i.value.toLocaleString()}</span>
      <span class="mc-legend-pct">${pct.toFixed(1)}%</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="mc-chart-vertical">
      <div class="mc-donut-center-wrap">
        ${buildSVGDonut(originItems, originTotal, { size: 160, centerValue: originTotal.toLocaleString(), centerLabel: 'Holdings' })}
      </div>
      <div class="mc-legend">${legend}</div>
      <div class="fl-stat-grid" style="margin-top:0;width:100%">
        <div class="fl-stat"><div class="fs-value" style="color:var(--green)">${local.length.toLocaleString()}</div><div class="fs-label">Local (${localPct.toFixed(1)}%)</div></div>
        <div class="fl-stat"><div class="fs-value" style="color:var(--blue)">${foreign.length.toLocaleString()}</div><div class="fs-label">Foreign (${foreignPct.toFixed(1)}%)</div></div>
        <div class="fl-stat"><div class="fs-value">${Object.keys(domCounts).length}</div><div class="fs-label">Countries</div></div>
      </div>
      <div style="width:100%">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">Top Foreign Domiciles</div>
        ${topDoms.map(([dom, count]) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
          <span style="font-size:12px;font-weight:500;width:160px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dom}</span>
          <div class="list-bar" style="flex:1"><div class="list-bar-fill" style="width:${count / foreign.length * 100}%;background:var(--blue)"></div></div>
          <span style="font-size:12px;font-weight:600;color:var(--text-muted);width:40px;text-align:right">${count}</span>
        </div>`).join('')}
      </div>
    </div>`;

  setupDonutHover(el);
}

// ---- Top Investors ----
function renderTopInvestors(filter) {
  const invStocks = {};
  for (const d of DATA) {
    if (filter === 'local' && d.local_foreign !== 'L') continue;
    if (filter === 'foreign' && d.local_foreign !== 'A') continue;
    if (filter === 'govt' && !isGovt(d)) continue;
    if (!invStocks[d.investor_name]) invStocks[d.investor_name] = { name: d.investor_name, lf: d.local_foreign, stocks: new Set() };
    invStocks[d.investor_name].stocks.add(d.share_code);
  }

  const sorted = Object.values(invStocks).map(v => ({ ...v, stockCount: v.stocks.size })).sort((a, b) => b.stockCount - a.stockCount).slice(0, 30);
  const max = sorted[0]?.stockCount || 1;
  const el = document.getElementById('tiBody');

  el.innerHTML = sorted.map((inv, i) => {
    const isF = inv.lf === 'A';
    return `<div class="list-row" data-action="investor" data-key="${escapeAttr(inv.name)}">
      <span class="list-rank">${i + 1}</span>
      <span class="list-name" style="min-width:0">${escapeHTML(inv.name)}</span>
      <span class="list-badge" style="background:${isF ? 'var(--blue-dim)' : 'var(--green-dim)'};color:${isF ? 'var(--blue)' : 'var(--green)'}">${isF ? 'Foreign' : 'Local'}</span>
      <span class="list-bar-wrap"><div class="list-bar"><div class="list-bar-fill" style="width:${(inv.stockCount / max) * 100}%;background:var(--accent)"></div></div></span>
      <span class="list-value">${inv.stockCount} stocks</span>
    </div>`;
  }).join('');

  bindListClicks(el);
}

// ---- Conglomerate Groups ----
let congData = [];

function renderConglomerates(mode) {
  const el = document.getElementById('congBody');
  congData = [];

  if (mode === 'rumor') {
    // Rumor/affiliation based: match by stock codes
    for (const cong of CONGLOMERATES_RUMOR) {
      const matchedRecords = [];
      const matchedInvestors = new Set();

      for (const code of cong.stocks) {
        const records = stockIndex[code];
        if (records) {
          for (const r of records) {
            matchedRecords.push(r);
            matchedInvestors.add(r.investor_name);
          }
        }
      }

      congData.push({ ...cong, investors: [...matchedInvestors], records: matchedRecords });
    }
  } else {
    // Ownership based: match by investor name keywords
    for (const cong of CONGLOMERATES) {
      const matchedStocks = new Set();
      const matchedInvestors = new Set();
      const matchedRecords = [];

      for (const d of DATA) {
        const name = d.investor_name.toUpperCase();
        const matches = cong.keywords.some(kw => name.includes(kw.toUpperCase()));
        const excluded = cong.excludeKeywords?.some(kw => name.includes(kw.toUpperCase()));
        if (matches && !excluded) { matchedStocks.add(d.share_code); matchedInvestors.add(d.investor_name); matchedRecords.push(d); }
      }

      if (matchedStocks.size > 0) congData.push({ ...cong, stocks: [...matchedStocks].sort(), investors: [...matchedInvestors], records: matchedRecords });
    }
  }

  congData.sort((a, b) => b.stocks.length - a.stocks.length);

  el.innerHTML = `<div class="cong-grid">${congData.map(c => `
    <div class="cong-card" data-cong="${escapeAttr(c.name)}" style="border-left-color:${c.color}">
      <div class="cc-top">
        <div class="cc-name" style="color:${c.color}">${c.name}</div>
        <div class="cc-stats">
          <span class="cc-stat-item">${c.stocks.length} stocks</span>
          ${mode !== 'rumor' ? `<span class="cc-stat-item">${c.investors.length} entities</span>` : ''}
        </div>
      </div>
      <div class="cc-desc">${c.desc}</div>
      <div class="cc-stocks">
        ${c.stocks.slice(0, 12).map(s => `<span class="cc-chip" style="background:${colorAlpha(c.color, 0.15)};color:${c.color}">${s}</span>`).join('')}
        ${c.stocks.length > 12 ? `<span class="cc-chip" style="background:var(--bar-bg);color:var(--text-muted)">+${c.stocks.length - 12}</span>` : ''}
      </div>
    </div>`).join('')}</div>`;

  el.querySelectorAll('.cong-card').forEach(card => {
    card.addEventListener('click', () => {
      const cong = congData.find(c => c.name === card.dataset.cong);
      if (cong) navigateTo('conglomerate', cong.name);
    });
  });
}

function bindListClicks(container) {
  container.querySelectorAll('.list-row[data-action]').forEach(row => {
    row.addEventListener('click', () => navigateTo(row.dataset.action, row.dataset.key));
  });
}

// ---- Free Float Scanner Page ----
function showFreeFloatScanner() {
  navHistory.push({ type: 'freeFloat', key: 'freeFloat' });
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('allListPanel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const metas = Object.values(stockMeta);
  const avgFF = metas.reduce((s, m) => s + m.freeFloat, 0) / metas.length;

  const el = document.getElementById('allListPanel');

  el.innerHTML = `
    <div class="info-header-row">
      <button class="back-btn" id="allListBack" title="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <div class="info-header">
        <div class="info-icon" style="background:var(--accent-dim);color:var(--accent)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <div class="info-text">
          <h2>Free Float Scanner</h2>
          <p>Average free float &lt; ${avgFF.toFixed(1)}% across ${metas.length} stocks</p>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px">
      <div class="panel-header">
        <h3>Filter Range</h3>
        <div class="ff-controls">
          <button class="sort-btn active" id="ffAsc" title="Ascending">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 19V5m-7 7l7-7 7 7"/></svg>
            Asc
          </button>
          <button class="sort-btn" id="ffDesc" title="Descending">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14m7-7l-7 7-7-7"/></svg>
            Desc
          </button>
        </div>
      </div>
      <div class="ff-slider-area">
        <div class="dual-range">
          <div class="dual-range-track"><div class="dual-range-fill" id="ffFill"></div></div>
          <input type="range" min="0" max="100" value="0" id="ffMin" class="dual-range-input">
          <input type="range" min="0" max="100" value="100" id="ffMax" class="dual-range-input">
        </div>
        <div class="dual-range-labels">
          <span id="ffMinLabel">0%</span>
          <span class="dual-range-count" id="ffCount"></span>
          <span id="ffMaxLabel">100%</span>
        </div>
      </div>
      <div class="panel-body scroll-y" id="ffBody" style="max-height:60vh"></div>
    </div>`;

  ffSortAsc = true;
  initFreeFloatSlider();
  renderFreeFloatScanner();

  document.getElementById('allListBack').addEventListener('click', () => {
    navHistory.pop();
    document.getElementById('allListPanel').style.display = 'none';
    showDashboard();
  });
}

// ---- All Stocks Page ----
function showAllStocks() {
  navHistory.push({ type: 'allStocks', key: 'allStocks' });
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('allListPanel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const metas = Object.values(stockMeta).sort((a, b) => a.code.localeCompare(b.code));
  const el = document.getElementById('allListPanel');

  el.innerHTML = `
    <div class="info-header-row">
      <button class="back-btn" id="allListBack" title="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <div class="info-header">
        <div class="info-icon stock-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-10"/></svg>
        </div>
        <div class="info-text">
          <h2>All Listed Stocks</h2>
          <p>${metas.length} stocks registered at KSEI</p>
        </div>
      </div>
    </div>
    <div class="all-list-search">
      <input type="text" id="allListSearch" placeholder="Search stock code or issuer name..." autocomplete="off">
    </div>
    <div class="all-list-body" id="allListBody"></div>`;

  function renderStockList(filter) {
    const filtered = filter
      ? metas.filter(m => m.code.toUpperCase().includes(filter) || m.issuer.toUpperCase().includes(filter))
      : metas;

    document.getElementById('allListBody').innerHTML = filtered.length
      ? filtered.map((m, i) => {
          const c = getPctColor(m.topPct);
          return `<div class="list-row" data-action="stock" data-key="${m.code}">
            <span class="list-rank">${i + 1}</span>
            <span class="list-code">${m.code}</span>
            <span class="list-name">${escapeHTML(m.issuer)}</span>
            <span class="list-badge" style="background:var(--accent-dim);color:var(--accent)">${m.holders} holders</span>
            <span class="list-value" style="color:${c}">FF &lt; ${m.freeFloat.toFixed(1)}%</span>
          </div>`;
        }).join('')
      : '<div style="padding:24px;color:var(--text-muted);text-align:center">No stocks found</div>';

    bindListClicks(document.getElementById('allListBody'));
  }

  renderStockList('');
  document.getElementById('allListSearch').addEventListener('input', e => {
    renderStockList(e.target.value.trim().toUpperCase());
  });
  document.getElementById('allListBack').addEventListener('click', () => {
    navHistory.pop();
    document.getElementById('allListPanel').style.display = 'none';
    showDashboard();
  });
}

// ---- All Investors Page ----
function showAllInvestors() {
  navHistory.push({ type: 'allInvestors', key: 'allInvestors' });
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('allListPanel').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const invMap = {};
  for (const d of DATA) {
    if (!invMap[d.investor_name]) invMap[d.investor_name] = { name: d.investor_name, lf: d.local_foreign, type: d.investor_type, stocks: new Set() };
    invMap[d.investor_name].stocks.add(d.share_code);
  }
  const investors = Object.values(invMap).map(v => ({ ...v, stockCount: v.stocks.size })).sort((a, b) => b.stockCount - a.stockCount);

  const el = document.getElementById('allListPanel');

  el.innerHTML = `
    <div class="info-header-row">
      <button class="back-btn" id="allListBack" title="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back
      </button>
      <div class="info-header">
        <div class="info-icon investor-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="info-text">
          <h2>All Investors</h2>
          <p>${investors.length} investors recorded</p>
        </div>
      </div>
    </div>
    <div class="all-list-search">
      <input type="text" id="allListSearch" placeholder="Search investor name..." autocomplete="off">
    </div>
    <div class="all-list-body" id="allListBody"></div>`;

  function renderInvestorList(filter) {
    const filtered = filter
      ? investors.filter(inv => inv.name.toUpperCase().includes(filter))
      : investors;

    document.getElementById('allListBody').innerHTML = filtered.length
      ? filtered.map((inv, i) => {
          const isF = inv.lf === 'A';
          return `<div class="list-row" data-action="investor" data-key="${escapeAttr(inv.name)}">
            <span class="list-rank">${i + 1}</span>
            <span class="list-name" style="min-width:0">${escapeHTML(inv.name)}</span>
            <span class="list-badge" style="background:${isF ? 'var(--blue-dim)' : 'var(--green-dim)'};color:${isF ? 'var(--blue)' : 'var(--green)'}">${isF ? 'Foreign' : 'Local'}</span>
            <span class="list-value">${inv.stockCount} stocks</span>
          </div>`;
        }).join('')
      : '<div style="padding:24px;color:var(--text-muted);text-align:center">No investors found</div>';

    bindListClicks(document.getElementById('allListBody'));
  }

  renderInvestorList('');
  document.getElementById('allListSearch').addEventListener('input', e => {
    renderInvestorList(e.target.value.trim().toUpperCase());
  });
  document.getElementById('allListBack').addEventListener('click', () => {
    navHistory.pop();
    document.getElementById('allListPanel').style.display = 'none';
    showDashboard();
  });
}

// =============================================
// KSEI Explorer v2 - Main Application
// Data sourced from KSEI public archive
// =============================================

// ===== Globals =====
let DATA = null;    // { summary, stocks }
let stockMap = {};  // code -> stock object
let charts = {};    // chart instances

const TYPE_NAMES = {
  IS: 'Insurance', CP: 'Corporate', PF: 'Pension Fund',
  IB: 'Inv. Bank', ID: 'Individual', MF: 'Mutual Fund',
  SC: 'Securities', FD: 'Foundation', OT: 'Other',
};

const TYPE_COLORS = {
  CP: '#34d399', ID: '#fbbf24', MF: '#818cf8', IB: '#60a5fa',
  SC: '#22d3ee', PF: '#f472b6', IS: '#fb923c', FD: '#a78bfa', OT: '#64748b',
};

const INVESTOR_TYPES = ['CP', 'ID', 'MF', 'IB', 'SC', 'PF', 'IS', 'FD', 'OT'];

// ===== Helpers =====
function fmt(n) {
  if (!n) return '0';
  if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString('id-ID');
}

function fmtRupiah(n) {
  if (!n) return 'Rp 0';
  if (n >= 1e12) return 'Rp ' + (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'M';
  return 'Rp ' + n.toLocaleString('id-ID');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function pctColor(pct) {
  if (pct >= 50) return '#f87171';
  if (pct >= 30) return '#fb923c';
  if (pct >= 15) return '#fbbf24';
  if (pct >= 5) return '#60a5fa';
  return '#34d399';
}

function alpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function isDark() { return document.documentElement.dataset.theme === 'dark'; }

function chartTooltipConfig() {
  const dark = isDark();
  return {
    backgroundColor: dark ? '#1a1d27' : '#ffffff',
    titleColor: dark ? '#f1f5f9' : '#0f172a',
    bodyColor: dark ? '#94a3b8' : '#475569',
    borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    borderWidth: 1, padding: 12, cornerRadius: 10,
  };
}

function destroyChart(name) {
  if (charts[name]) { charts[name].destroy(); charts[name] = null; }
}

// ===== Data Loading =====
function loadData() {
  DATA = window.KSEI_DATA;
  delete window.KSEI_DATA;
  if (!DATA || !DATA.stocks) {
    document.getElementById('dataDate').textContent = 'Error: data not loaded';
    return;
  }
  for (const st of DATA.stocks) stockMap[st.code] = st;
  document.getElementById('dataBadge').innerHTML =
    `<span class="badge-dot"></span>${DATA.stocks.length.toLocaleString()} stocks`;
  document.getElementById('dataDate').textContent =
    `Data: ${DATA.summary.date} · Source: KSEI Public Archive`;
}

// ===== Theme =====
function setupTheme() {
  const saved = localStorage.getItem('ksei-v2-theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('ksei-v2-theme', next);
    // Re-render charts on theme change
    renderDashboardCharts();
    if (document.getElementById('detailView').style.display !== 'none') {
      const code = document.getElementById('detailHeader').dataset.code;
      if (code) renderDetailCharts(stockMap[code]);
    }
  });
}

// ===== Search =====
function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  const dd = document.getElementById('searchDropdown');
  let timer;

  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') { dd.classList.remove('open'); input.blur(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const val = input.value.trim().toUpperCase();
    clearBtn.classList.toggle('visible', val.length > 0);
    timer = setTimeout(() => {
      if (val.length >= 1) showSuggestions(val);
      else dd.classList.remove('open');
    }, 100);
  });

  input.addEventListener('keydown', e => {
    const items = dd.querySelectorAll('.dd-item');
    const active = dd.querySelector('.dd-item.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!items.length) return;
      if (!active) { items[0].classList.add('active'); return; }
      active.classList.remove('active');
      const next = active.nextElementSibling;
      (next?.classList.contains('dd-item') ? next : items[0]).classList.add('active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      if (!active) { items[items.length - 1].classList.add('active'); return; }
      active.classList.remove('active');
      const prev = active.previousElementSibling;
      (prev?.classList.contains('dd-item') ? prev : items[items.length - 1]).classList.add('active');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = active || items[0];
      if (target) navigateTo(target.dataset.code);
    }
  });

  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.classList.remove('visible'); dd.classList.remove('open'); showDashboard(); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-container')) dd.classList.remove('open'); });
}

function showSuggestions(q) {
  const matches = DATA.stocks.filter(s => s.code.includes(q)).slice(0, 10);
  const dd = document.getElementById('searchDropdown');
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(s => `
    <div class="dd-item" data-code="${s.code}">
      <span class="dd-badge stock">${s.code}</span>
      <span class="dd-name">${s.type}</span>
      <span class="dd-sub">Rp ${s.price.toLocaleString('id-ID')} · ${s.foreignPct.toFixed(1)}% foreign</span>
    </div>`).join('');
  dd.classList.add('open');
  dd.querySelectorAll('.dd-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.code));
  });
}

// ===== Navigation =====
function navigateTo(code) {
  const st = stockMap[code];
  if (!st) return;
  document.getElementById('searchInput').value = code;
  document.getElementById('searchClear').classList.add('visible');
  document.getElementById('searchDropdown').classList.remove('open');
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('detailView').style.display = '';
  renderDetail(st);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDashboard() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
  document.getElementById('searchDropdown').classList.remove('open');
  document.getElementById('dashboardView').style.display = '';
  document.getElementById('detailView').style.display = 'none';
  destroyChart('detailPie');
  destroyChart('detailBar');
}

// ===== Dashboard =====
function renderDashboard() {
  renderHero();
  renderDashboardCharts();
  renderForeignLocal();
  renderForeignList('desc');
  renderMcapList();
  renderScanner('foreignPct', 'desc');
}

function renderHero() {
  const s = DATA.summary;
  const totalLocal = DATA.stocks.reduce((a, st) => a + st.local.total, 0);
  const totalForeign = DATA.stocks.reduce((a, st) => a + st.foreign.total, 0);
  const totalAll = totalLocal + totalForeign;

  const cards = [
    { icon: '📊', label: 'Total Saham', value: s.totalStocks.toLocaleString(), sub: s.date, color: '#818cf8', bg: 'var(--accent-dim)' },
    { icon: '💰', label: 'Market Cap', value: fmtRupiah(s.totalMarketCap), sub: `${DATA.stocks.filter(x => x.price > 0).length} priced`, color: '#a78bfa', bg: 'var(--purple-dim)' },
    { icon: '🏠', label: 'Avg Local', value: `${s.avgLocalPct.toFixed(1)}%`, sub: `${fmt(totalLocal)} shares`, color: '#34d399', bg: 'var(--green-dim)' },
    { icon: '🌍', label: 'Avg Foreign', value: `${s.avgForeignPct.toFixed(1)}%`, sub: `${fmt(totalForeign)} shares`, color: '#60a5fa', bg: 'var(--blue-dim)' },
    { icon: '📈', label: 'Total Shares', value: fmt(totalAll), sub: 'tracked by KSEI', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  ];

  document.getElementById('heroGrid').innerHTML = cards.map((c, i) => `
    <div class="stat-hero fade-up fade-up-${i + 1}">
      <div class="stat-glow" style="background:${c.color}"></div>
      <div class="stat-icon" style="background:${c.bg};color:${c.color}">${c.icon}</div>
      <div class="stat-label">${c.label}</div>
      <div class="stat-value" style="color:${c.color}">${c.value}</div>
      <div class="stat-sub">${c.sub}</div>
    </div>`).join('');
}

function renderDashboardCharts() {
  renderMCChart(document.querySelector('#mcTabs .tab.active')?.dataset.mc || 'type');
  renderTypeBarChart();
}

// ===== Market Composition Donut =====
function renderMCChart(mode) {
  destroyChart('mc');
  const ctx = document.getElementById('mcChart');
  let labels, values, colors;

  if (mode === 'type') {
    labels = INVESTOR_TYPES.map(t => TYPE_NAMES[t]);
    values = INVESTOR_TYPES.map(t => DATA.summary.byType[t].total);
    colors = INVESTOR_TYPES.map(t => TYPE_COLORS[t]);
  } else {
    const totalLocal = DATA.stocks.reduce((a, s) => a + s.local.total, 0);
    const totalForeign = DATA.stocks.reduce((a, s) => a + s.foreign.total, 0);
    labels = ['Local', 'Foreign'];
    values = [totalLocal, totalForeign];
    colors = ['#34d399', '#60a5fa'];
  }

  charts.mc = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: isDark() ? '#11131e' : '#ffffff',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { padding: 14, usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' } } },
        tooltip: {
          ...chartTooltipConfig(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return ` ${ctx.label}: ${fmt(ctx.raw)} (${(ctx.raw / total * 100).toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });
}

// ===== Type Bar Chart =====
function renderTypeBarChart() {
  destroyChart('typeBar');
  const ctx = document.getElementById('typeBarChart');
  const labels = INVESTOR_TYPES.map(t => TYPE_NAMES[t]);
  const localVals = INVESTOR_TYPES.map(t => DATA.summary.byType[t].local);
  const foreignVals = INVESTOR_TYPES.map(t => DATA.summary.byType[t].foreign);

  charts.typeBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Local',
          data: localVals,
          backgroundColor: alpha('#34d399', 0.7),
          borderColor: '#34d399',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Foreign',
          data: foreignVals,
          backgroundColor: alpha('#60a5fa', 0.7),
          borderColor: '#60a5fa',
          borderWidth: 1,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' } } },
        tooltip: { ...chartTooltipConfig(), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)} shares` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
        y: {
          grid: { color: isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
          ticks: { callback: v => fmt(v), font: { size: 10 } }
        }
      }
    }
  });
}

// ===== Foreign vs Local Overview =====
function renderForeignLocal() {
  const el = document.getElementById('flVisual');
  const totalLocal = DATA.stocks.reduce((a, s) => a + s.local.total, 0);
  const totalForeign = DATA.stocks.reduce((a, s) => a + s.foreign.total, 0);
  const totalAll = totalLocal + totalForeign;
  const localPct = totalLocal / totalAll * 100;
  const foreignPct = totalForeign / totalAll * 100;

  // Count stocks where foreign > 50%, >20%, etc.
  const foreign50 = DATA.stocks.filter(s => s.foreignPct >= 50).length;
  const foreign20 = DATA.stocks.filter(s => s.foreignPct >= 20).length;
  const foreignLow = DATA.stocks.filter(s => s.foreignPct < 1).length;

  el.innerHTML = `
    <div class="fl-progress">
      <div class="fl-seg" style="width:${localPct}%;background:linear-gradient(90deg,#34d399,#10b981)">${localPct.toFixed(1)}%</div>
      <div class="fl-seg" style="width:${foreignPct}%;background:linear-gradient(90deg,#60a5fa,#3b82f6)">${foreignPct > 3 ? foreignPct.toFixed(1) + '%' : ''}</div>
    </div>
    <div class="fl-cards">
      <div class="fl-card">
        <div class="fl-card-value" style="color:var(--green)">${fmt(totalLocal)}</div>
        <div class="fl-card-label">Local Shares</div>
      </div>
      <div class="fl-card">
        <div class="fl-card-value" style="color:var(--blue)">${fmt(totalForeign)}</div>
        <div class="fl-card-label">Foreign Shares</div>
      </div>
      <div class="fl-card">
        <div class="fl-card-value">${fmt(totalAll)}</div>
        <div class="fl-card-label">Total Shares</div>
      </div>
    </div>
    <div class="fl-domicile">
      <div class="fl-domicile-title">Foreign Ownership Insights</div>
      <div class="fl-dom-row">
        <span class="fl-dom-name">Foreign >= 50%</span>
        <div class="fl-dom-bar list-bar-wrap" style="flex:1">
          <div class="list-bar"><div class="list-bar-fill" style="width:${foreign50 / DATA.stocks.length * 100}%;background:#f87171"></div></div>
        </div>
        <span class="fl-dom-count">${foreign50} stocks</span>
      </div>
      <div class="fl-dom-row">
        <span class="fl-dom-name">Foreign >= 20%</span>
        <div class="fl-dom-bar list-bar-wrap" style="flex:1">
          <div class="list-bar"><div class="list-bar-fill" style="width:${foreign20 / DATA.stocks.length * 100}%;background:#fb923c"></div></div>
        </div>
        <span class="fl-dom-count">${foreign20} stocks</span>
      </div>
      <div class="fl-dom-row">
        <span class="fl-dom-name">Foreign < 1%</span>
        <div class="fl-dom-bar list-bar-wrap" style="flex:1">
          <div class="list-bar"><div class="list-bar-fill" style="width:${foreignLow / DATA.stocks.length * 100}%;background:#34d399"></div></div>
        </div>
        <span class="fl-dom-count">${foreignLow} stocks</span>
      </div>
      <div class="fl-dom-row" style="margin-top:8px">
        <span class="fl-dom-name" style="color:var(--text)">Avg Foreign %</span>
        <div style="flex:1"></div>
        <span class="fl-dom-count" style="color:var(--blue);font-weight:800;font-size:14px">${DATA.summary.avgForeignPct.toFixed(1)}%</span>
      </div>
    </div>`;
}

// ===== Top Foreign List =====
function renderForeignList(dir) {
  const sorted = [...DATA.stocks].sort((a, b) => dir === 'desc' ? b.foreignPct - a.foreignPct : a.foreignPct - b.foreignPct);
  const top = sorted.slice(0, 40);
  const el = document.getElementById('foreignList');
  el.innerHTML = top.map((s, i) => {
    const c = pctColor(s.foreignPct);
    return `<div class="list-item" data-code="${s.code}">
      <span class="list-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
      <span class="list-code">${s.code}</span>
      <span class="list-name">Rp ${s.price.toLocaleString('id-ID')}</span>
      <span class="list-bar-wrap"><div class="list-bar"><div class="list-bar-fill" style="width:${s.foreignPct}%;background:${c}"></div></div></span>
      <span class="list-value" style="color:${c}">${s.foreignPct.toFixed(1)}%</span>
    </div>`;
  }).join('');
  bindStockClicks(el);
}

// ===== Top Market Cap =====
function renderMcapList() {
  const sorted = [...DATA.stocks].filter(s => s.marketCap > 0).sort((a, b) => b.marketCap - a.marketCap);
  const top = sorted.slice(0, 40);
  const max = top[0]?.marketCap || 1;
  const el = document.getElementById('mcapList');
  el.innerHTML = top.map((s, i) => {
    return `<div class="list-item" data-code="${s.code}">
      <span class="list-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
      <span class="list-code">${s.code}</span>
      <span class="list-name">Rp ${s.price.toLocaleString('id-ID')}</span>
      <span class="list-bar-wrap"><div class="list-bar"><div class="list-bar-fill" style="width:${s.marketCap / max * 100}%;background:linear-gradient(90deg,#818cf8,#a78bfa)"></div></div></span>
      <span class="list-value">${fmtRupiah(s.marketCap)}</span>
    </div>`;
  }).join('');
  bindStockClicks(el);
}

// ===== Stock Scanner =====
function renderScanner(col, dir) {
  const sorted = [...DATA.stocks].sort((a, b) => {
    if (col === 'code') return dir === 'asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
    return dir === 'desc' ? (b[col] || 0) - (a[col] || 0) : (a[col] || 0) - (b[col] || 0);
  });

  const top = sorted.slice(0, 60);
  const el = document.getElementById('scannerList');

  el.innerHTML = `<div class="scanner-header-row">
    <span class="sh-rank">#</span>
    <span class="sh-code">Code</span>
    <span class="sh-price">Price</span>
    <span class="sh-bar">Local / Foreign</span>
    <span class="sh-pct">Local %</span>
    <span class="sh-pct">Foreign %</span>
    <span class="sh-mcap">Market Cap</span>
  </div>` + top.map((s, i) => {
    const fc = pctColor(s.foreignPct);
    return `<div class="list-item scanner-row" data-code="${s.code}">
      <span class="list-rank ${i < 3 ? 'top-3' : ''}">${i + 1}</span>
      <span class="list-code">${s.code}</span>
      <span class="list-name" style="min-width:70px">Rp ${s.price.toLocaleString('id-ID')}</span>
      <span class="scanner-bar">
        <div class="dual-bar">
          <div class="dual-bar-local" style="width:${s.localPct}%"></div>
          <div class="dual-bar-foreign" style="width:${s.foreignPct}%"></div>
        </div>
      </span>
      <span class="list-value" style="color:var(--green)">${s.localPct.toFixed(1)}%</span>
      <span class="list-value" style="color:${fc}">${s.foreignPct.toFixed(1)}%</span>
      <span class="list-value" style="color:var(--text-secondary)">${fmtRupiah(s.marketCap)}</span>
    </div>`;
  }).join('') + (sorted.length > 60 ? `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px">Showing top 60 of ${sorted.length}</div>` : '');

  bindStockClicks(el);
}

// ===== Detail View =====
function renderDetail(st) {
  renderDetailHeader(st);
  renderDetailStats(st);
  renderDetailCharts(st);
  renderDetailTable(st);
}

function renderDetailHeader(st) {
  const el = document.getElementById('detailHeader');
  el.dataset.code = st.code;
  el.innerHTML = `
    <div class="detail-icon" style="background:var(--accent-dim);color:var(--accent)">${st.code.slice(0, 2)}</div>
    <div>
      <div class="detail-title">${st.code}</div>
      <div class="detail-sub">${st.type} · Rp ${st.price.toLocaleString('id-ID')} · ${st.date}</div>
    </div>`;
}

function renderDetailStats(st) {
  const el = document.getElementById('detailStats');
  const cards = [
    { label: 'Total Shares (KSEI)', value: fmt(st.totalShares) },
    { label: 'Securities Number', value: fmt(st.secNum) },
    { label: 'Local %', value: `${st.localPct}%`, sub: `${fmt(st.local.total)} shares` },
    { label: 'Foreign %', value: `${st.foreignPct}%`, sub: `${fmt(st.foreign.total)} shares` },
    { label: 'Market Cap', value: fmtRupiah(st.marketCap) },
    { label: 'Price', value: `Rp ${st.price.toLocaleString('id-ID')}` },
  ];
  el.innerHTML = cards.map(c => `
    <div class="d-stat">
      <div class="d-stat-label">${c.label}</div>
      <div class="d-stat-value">${c.value}</div>
      ${c.sub ? `<div class="d-stat-sub">${c.sub}</div>` : ''}
    </div>`).join('');
}

function renderDetailCharts(st) {
  // Pie: Local vs Foreign
  destroyChart('detailPie');
  charts.detailPie = new Chart(document.getElementById('detailPieChart'), {
    type: 'doughnut',
    data: {
      labels: ['Local', 'Foreign'],
      datasets: [{
        data: [st.local.total, st.foreign.total],
        backgroundColor: ['#34d399', '#60a5fa'],
        borderColor: isDark() ? '#11131e' : '#ffffff',
        borderWidth: 3, hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' } } },
        tooltip: { ...chartTooltipConfig(), callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} shares (${(ctx.raw / st.totalShares * 100).toFixed(1)}%)` } }
      }
    }
  });

  // Bar: By investor type
  destroyChart('detailBar');
  const barLabels = INVESTOR_TYPES.map(t => TYPE_NAMES[t]);
  const localData = INVESTOR_TYPES.map(t => st.byType[t].local);
  const foreignData = INVESTOR_TYPES.map(t => st.byType[t].foreign);

  charts.detailBar = new Chart(document.getElementById('detailBarChart'), {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [
        { label: 'Local', data: localData, backgroundColor: alpha('#34d399', 0.7), borderColor: '#34d399', borderWidth: 1, borderRadius: 4 },
        { label: 'Foreign', data: foreignData, backgroundColor: alpha('#60a5fa', 0.7), borderColor: '#60a5fa', borderWidth: 1, borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' } } },
        tooltip: { ...chartTooltipConfig(), callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)} shares` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' } } },
        y: { grid: { color: isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { callback: v => fmt(v), font: { size: 10 } } }
      }
    }
  });
}

function renderDetailTable(st) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');

  thead.innerHTML = `<tr>
    <th>Investor Type</th>
    <th class="num">Local</th>
    <th class="num">Foreign</th>
    <th class="num">Total</th>
    <th class="num">% of Total</th>
    <th>Distribution</th>
  </tr>`;

  const rows = INVESTOR_TYPES.map(t => {
    const d = st.byType[t];
    const pct = st.totalShares > 0 ? (d.total / st.totalShares * 100) : 0;
    const localPctOfType = d.total > 0 ? (d.local / d.total * 100) : 0;
    const foreignPctOfType = d.total > 0 ? (d.foreign / d.total * 100) : 0;
    return { type: t, ...d, pct, localPctOfType, foreignPctOfType };
  }).sort((a, b) => b.total - a.total);

  const maxTotal = rows[0]?.total || 1;

  document.getElementById('tableCount').textContent = `${INVESTOR_TYPES.length} types`;

  tbody.innerHTML = rows.map(r => {
    const c = TYPE_COLORS[r.type] || '#64748b';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:10px;height:10px;border-radius:3px;background:${c};flex-shrink:0"></span>
          <span class="type-tag" style="background:${alpha(c, 0.12)};color:${c}">${TYPE_NAMES[r.type]}</span>
        </div>
      </td>
      <td class="num"><span class="holding-num">${fmt(r.local)}</span></td>
      <td class="num"><span class="holding-num">${fmt(r.foreign)}</span></td>
      <td class="num"><span class="holding-num" style="font-weight:800">${fmt(r.total)}</span></td>
      <td class="num"><span class="pct-val" style="color:${c}">${r.pct.toFixed(2)}%</span></td>
      <td>
        <div class="dual-bar" style="width:120px">
          <div class="dual-bar-local" style="width:${r.localPctOfType}%"></div>
          <div class="dual-bar-foreign" style="width:${r.foreignPctOfType}%"></div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ===== Bind Clicks =====
function bindStockClicks(container) {
  container.querySelectorAll('[data-code]').forEach(row => {
    row.addEventListener('click', () => navigateTo(row.dataset.code));
  });
}

// ===== Event Listeners =====
function setupFilters() {
  document.getElementById('mcTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#mcTabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderMCChart(tab.dataset.mc);
  });

  document.getElementById('foreignSort').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#foreignSort .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderForeignList(tab.dataset.sort);
  });

  document.getElementById('scanSort').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    document.querySelectorAll('#scanSort .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderScanner(tab.dataset.col, tab.dataset.dir);
  });
}

// ===== Init =====
function init() {
  loadData();
  if (!DATA) return;
  setupTheme();
  setupSearch();
  setupFilters();
  document.getElementById('logoHome').addEventListener('click', () => showDashboard());
  document.getElementById('backBtn').addEventListener('click', () => showDashboard());
  renderDashboard();
}

init();

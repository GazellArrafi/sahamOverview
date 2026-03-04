// =============================================
// App - Main init, navigation, theme
// =============================================

// ===== Global Data =====
let DATA = [];
let stockIndex = {};
let investorIndex = {};
let stockMeta = {};
const navHistory = [];

// ===== Data Loading =====
function loadData() {
  DATA = window.STOCK_DATA || [];
  delete window.STOCK_DATA; // free memory of the duplicate reference

  for (const d of DATA) {
    if (!stockIndex[d.share_code]) stockIndex[d.share_code] = [];
    stockIndex[d.share_code].push(d);
    if (!investorIndex[d.investor_name]) investorIndex[d.investor_name] = [];
    investorIndex[d.investor_name].push(d);
  }

  for (const [code, records] of Object.entries(stockIndex)) {
    const totalPct = records.reduce((s, r) => s + (r.percentage || 0), 0);
    const sorted = [...records].sort((a, b) => b.percentage - a.percentage);
    stockMeta[code] = {
      code,
      issuer: records[0].issuer_name,
      date: records[0].date,
      holders: records.length,
      totalPct,
      freeFloat: 100 - totalPct,
      topHolder: sorted[0],
      topPct: sorted[0]?.percentage || 0,
      localCount: records.filter(r => r.local_foreign === 'L').length,
      foreignCount: records.filter(r => r.local_foreign === 'A').length,
    };
  }

  document.getElementById('dataBadge').innerHTML = '<svg width="6" height="6" viewBox="0 0 6 6" style="margin-right:4px;vertical-align:middle"><circle cx="3" cy="3" r="3" fill="var(--green)"/></svg>IDX Data Loaded';
}

// ===== Navigation =====
function navigateTo(type, key) {
  navHistory.push({ type, key });
  const input = document.getElementById('searchInput');
  input.value = key;
  document.getElementById('searchClear').classList.add('visible');
  document.getElementById('searchDropdown').classList.remove('open');
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('resultPanel').style.display = '';
  showResult(type, key);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateBack() {
  navHistory.pop();
  if (navHistory.length > 0) {
    const prev = navHistory[navHistory.length - 1];
    document.getElementById('searchInput').value = prev.key;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('resultPanel').style.display = '';
    showResult(prev.type, prev.key);
  } else {
    showDashboard();
  }
}

function showDashboard() {
  navHistory.length = 0;
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
  document.getElementById('searchDropdown').classList.remove('open');
  document.getElementById('dashboard').style.display = '';
  document.getElementById('resultPanel').style.display = 'none';
  document.getElementById('allListPanel').style.display = 'none';
  stopSimulation();
}

// ===== Theme =====
function setupTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    if (graphState.nodes.length) drawGraph();
  });
}

// ===== Filters =====
function setupFilters() {
  document.getElementById('mcFilter').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('#mcFilter .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderMarketComposition(pill.dataset.mc);
  });

  document.getElementById('tiFilter').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('#tiFilter .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderTopInvestors(pill.dataset.ti);
  });

  document.getElementById('congFilter').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.querySelectorAll('#congFilter .pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderConglomerates(pill.dataset.cong);
  });
}

// ===== Resize =====
function setupResize() {
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (graphState.nodes.length) drawGraph(); }, 200);
  });
}

// ===== Init =====
function init() {
  loadData();
  setupTheme();
  setupSearch();
  setupFilters();
  setupGraphInteraction();
  setupResize();

  document.getElementById('logoHome').addEventListener('click', () => showDashboard());
  document.getElementById('backBtn').addEventListener('click', () => navigateBack());

  renderDashboard();

  // Hero card click handlers (bound after renderDashboard populates them)
  document.getElementById('heroStocks').addEventListener('click', () => showAllStocks());
  document.getElementById('heroInvestors').addEventListener('click', () => showAllInvestors());
  document.getElementById('heroFreeFloat').addEventListener('click', () => showFreeFloatScanner());
}

init();

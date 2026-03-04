// =============================================
// Utils - Shared helper functions
// =============================================

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatNum(n) {
  if (!n) return '0';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function getTypeName(code) {
  return TYPE_MAP[code] || code || '-';
}

function getNodeType(investorType) {
  if (investorType === 'CP') return 'corp';
  if (investorType === 'ID') return 'individual';
  if (['IS', 'IB', 'MF', 'PF', 'SC'].includes(investorType)) return 'institution';
  return 'other';
}

function getNodeColor(ntype) {
  const colors = { stock: '#6366f1', corp: '#10b981', individual: '#f59e0b', institution: '#3b82f6', other: '#8b5cf6' };
  return colors[ntype] || colors.other;
}

function isGovt(d) {
  const n = d.investor_name.toUpperCase();
  return n.includes('GOVERNMENT') || n.includes('NEGARA') || n.includes('PEMERINTAH') ||
    n.includes('PERSERO') || n.includes('TASPEN') || n.includes('ASABRI') ||
    n.includes('KETENAGAKERJAAN') || n.includes('KEJAKSAAN');
}

// Color with alpha helper
function colorAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Format number with dot separator (Indonesian style)
function formatDot(n) {
  if (!n) return '0';
  return n.toLocaleString('id-ID');
}

// Check if investor belongs to a conglomerate group
function getInvestorConglo(investorName) {
  const upper = (investorName || '').toUpperCase();
  for (const cong of CONGLOMERATES) {
    const matches = cong.keywords.some(kw => upper.includes(kw.toUpperCase()));
    const excluded = cong.excludeKeywords?.some(kw => upper.includes(kw.toUpperCase()));
    if (matches && !excluded) return { name: cong.name, color: cong.color };
  }
  return null;
}

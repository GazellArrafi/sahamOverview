// =============================================
// Search - Autocomplete, results, table
// =============================================

function getSearchSuggestions(query) {
  if (!query || query.length < 1) return { stocks: [], investors: [] };
  const q = query.toUpperCase();

  const stockMap = new Map();
  const investorMap = new Map();

  for (const d of DATA) {
    if (d.share_code.toUpperCase().includes(q) || d.issuer_name.toUpperCase().includes(q)) {
      if (!stockMap.has(d.share_code)) stockMap.set(d.share_code, { code: d.share_code, name: d.issuer_name, count: 0 });
      stockMap.get(d.share_code).count++;
    }
    if (d.investor_name.toUpperCase().includes(q)) {
      if (!investorMap.has(d.investor_name)) investorMap.set(d.investor_name, { name: d.investor_name, count: 0 });
      investorMap.get(d.investor_name).count++;
    }
  }

  const stocks = [...stockMap.values()].sort((a, b) => {
    if (a.code === q) return -1; if (b.code === q) return 1;
    return a.code.localeCompare(b.code);
  }).slice(0, 8);

  const investors = [...investorMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  return { stocks, investors };
}

function renderDropdown(suggestions) {
  const dd = document.getElementById('searchDropdown');
  if (!suggestions.stocks.length && !suggestions.investors.length) { dd.classList.remove('open'); return; }

  let html = '';
  if (suggestions.stocks.length) {
    html += '<div class="dropdown-group-title">Stocks</div>';
    suggestions.stocks.forEach(s => {
      html += `<div class="dropdown-item" data-type="stock" data-key="${s.code}">
        <span class="item-badge stock">${s.code}</span>
        <span class="item-name">${escapeHTML(s.name)}</span>
        <span class="item-sub">${s.count} holders</span></div>`;
    });
  }
  if (suggestions.investors.length) {
    html += '<div class="dropdown-group-title">Investors</div>';
    suggestions.investors.forEach(s => {
      html += `<div class="dropdown-item" data-type="investor" data-key="${escapeAttr(s.name)}">
        <span class="item-badge investor">INV</span>
        <span class="item-name">${escapeHTML(s.name)}</span>
        <span class="item-sub">${s.count} stocks</span></div>`;
    });
  }

  dd.innerHTML = html;
  dd.classList.add('open');
  dd.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.type, item.dataset.key));
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = input.value.trim();
    clearBtn.classList.toggle('visible', val.length > 0);
    debounceTimer = setTimeout(() => {
      if (val.length >= 1) renderDropdown(getSearchSuggestions(val));
      else document.getElementById('searchDropdown').classList.remove('open');
    }, 150);
  });

  input.addEventListener('keydown', e => {
    const dd = document.getElementById('searchDropdown');
    const items = dd.querySelectorAll('.dropdown-item');
    const active = dd.querySelector('.dropdown-item.active');

    if (e.key === 'ArrowDown') {
      e.preventDefault(); if (!items.length) return;
      if (!active) { items[0].classList.add('active'); return; }
      active.classList.remove('active');
      const next = active.nextElementSibling;
      (next?.classList.contains('dropdown-item') ? next : items[0]).classList.add('active');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); if (!items.length) return;
      if (!active) { items[items.length - 1].classList.add('active'); return; }
      active.classList.remove('active');
      const prev = active.previousElementSibling;
      (prev?.classList.contains('dropdown-item') ? prev : items[items.length - 1]).classList.add('active');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = active || items[0];
      if (target) navigateTo(target.dataset.type, target.dataset.key);
    } else if (e.key === 'Escape') { dd.classList.remove('open'); }
  });

  clearBtn.addEventListener('click', () => showDashboard());
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container')) document.getElementById('searchDropdown').classList.remove('open');
  });
}

// ===== Result Rendering =====
function showResult(type, key) {
  let records;
  if (type === 'stock') records = stockIndex[key] || [];
  else if (type === 'investor') records = investorIndex[key] || [];
  else if (type === 'conglomerate') {
    const cong = congData.find(c => c.name === key);
    records = cong ? cong.records : [];
  }
  if (!records.length) return;

  renderInfoHeader(type, key, records);
  renderStats(type, key, records);
  renderResultTable(type, records);
  renderAllocation(type, key, records);
  buildGraph(type, key, records);
}

function renderInfoHeader(type, key, records) {
  const el = document.getElementById('infoHeader');
  if (type === 'stock') {
    el.innerHTML = `<div class="info-icon stock-icon">${key.slice(0, 2)}</div>
      <div class="info-text"><h2>${key}</h2><p>${escapeHTML(records[0]?.issuer_name || key)} &middot; ${records[0]?.date || ''}</p></div>`;
  } else if (type === 'investor') {
    el.innerHTML = `<div class="info-icon investor-icon">${key.charAt(0)}</div>
      <div class="info-text"><h2>${escapeHTML(key)}</h2><p>Investor &middot; Holds ${records.length} stock(s)</p></div>`;
  } else if (type === 'conglomerate') {
    const cong = congData.find(c => c.name === key);
    el.innerHTML = `<div class="info-icon" style="background:${colorAlpha(cong?.color || '#6366f1', 0.15)};color:${cong?.color || '#6366f1'}">${key.charAt(0)}</div>
      <div class="info-text"><h2>${escapeHTML(key)}</h2><p>${escapeHTML(cong?.desc || '')} &middot; ${cong?.stocks.length || 0} stocks &middot; ${cong?.investors.length || 0} entities</p></div>`;
  }
}

function renderStats(type, key, records) {
  const el = document.getElementById('statsRow');
  if (type === 'stock') {
    const totalShares = records.reduce((s, r) => s + (r.total_holding || 0), 0);
    const localCount = records.filter(r => r.local_foreign === 'L').length;
    const foreignCount = records.filter(r => r.local_foreign === 'A').length;
    const topHolder = [...records].sort((a, b) => b.percentage - a.percentage)[0];
    const totalPct = records.reduce((s, r) => s + (r.percentage || 0), 0);
    el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Shareholders</div><div class="stat-value">${records.length}</div><div class="stat-sub">${localCount} local, ${foreignCount} foreign</div></div>
      <div class="stat-card"><div class="stat-label">Total Shares Tracked</div><div class="stat-value">${formatNum(totalShares)}</div></div>
      <div class="stat-card"><div class="stat-label">Top Holder</div><div class="stat-value">${topHolder?.percentage || 0}%</div><div class="stat-sub">${escapeHTML((topHolder?.investor_name || '').slice(0, 30))}</div></div>
      <div class="stat-card"><div class="stat-label">Free Float</div><div class="stat-value">&lt; ${(100 - totalPct).toFixed(2)}%</div><div class="stat-sub">100% - ${totalPct.toFixed(2)}% tracked</div></div>`;
  } else if (type === 'investor') {
    const topStock = [...records].sort((a, b) => b.percentage - a.percentage)[0];
    el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Stocks Held</div><div class="stat-value">${records.length}</div></div>
      <div class="stat-card"><div class="stat-label">Investor Type</div><div class="stat-value">${getTypeName(records[0]?.investor_type)}</div><div class="stat-sub">${records[0]?.local_foreign === 'L' ? 'Local' : 'Foreign'}</div></div>
      <div class="stat-card"><div class="stat-label">Largest Holding</div><div class="stat-value">${topStock?.percentage || 0}%</div><div class="stat-sub">${topStock?.share_code || ''}</div></div>
      <div class="stat-card"><div class="stat-label">Domicile</div><div class="stat-value">${records[0]?.domicile || '-'}</div></div>`;
  } else if (type === 'conglomerate') {
    const stocks = new Set(records.map(r => r.share_code));
    const investors = new Set(records.map(r => r.investor_name));
    el.innerHTML = `
      <div class="stat-card"><div class="stat-label">Stocks</div><div class="stat-value">${stocks.size}</div></div>
      <div class="stat-card"><div class="stat-label">Entities</div><div class="stat-value">${investors.size}</div></div>
      <div class="stat-card"><div class="stat-label">Total Holdings</div><div class="stat-value">${records.length}</div></div>
      <div class="stat-card"><div class="stat-label">Avg Holding</div><div class="stat-value">${(records.reduce((s, r) => s + r.percentage, 0) / records.length).toFixed(1)}%</div></div>`;
  }
}

// ===== Table with row coloring + badges =====
function renderResultTable(type, records) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  const sorted = [...records].sort((a, b) => b.percentage - a.percentage);

  // Set colgroup for fixed column widths
  const colgroup = document.getElementById('dataTable').querySelector('colgroup');
  if (colgroup) colgroup.remove();

  if (type === 'stock') {
    document.getElementById('dataTable').insertAdjacentHTML('afterbegin',
      '<colgroup><col style="width:36px"><col><col style="width:115px"><col style="width:80px"><col style="width:135px"><col style="width:80px"></colgroup>');

    thead.innerHTML = `<tr>
      <th>#</th>
      <th>Pemegang Saham</th>
      <th>Tipe</th>
      <th>Status</th>
      <th class="num">Lembar Saham</th>
      <th class="num">%</th>
    </tr>`;

    tbody.innerHTML = sorted.map((r, i) => {
      const color = getPctColor(r.percentage);
      const bgAlpha = 0.04 + (r.percentage / 100) * 0.1;
      const konglo = getInvestorConglo(r.investor_name);
      const typeBg = r.investor_type === 'CP' ? 'var(--green-dim)' : r.investor_type === 'ID' ? 'var(--accent-dim)' : 'var(--blue-dim)';
      const typeColor = r.investor_type === 'CP' ? 'var(--green)' : r.investor_type === 'ID' ? 'var(--accent)' : 'var(--blue)';
      const statusBg = r.local_foreign === 'L' ? 'var(--green-dim)' : r.local_foreign === 'A' ? 'var(--blue-dim)' : '';
      const statusColor = r.local_foreign === 'L' ? 'var(--green)' : r.local_foreign === 'A' ? 'var(--blue)' : 'var(--text-muted)';
      const statusText = r.local_foreign === 'L' ? 'Lokal' : r.local_foreign === 'A' ? 'Foreign' : '—';

      return `<tr style="background:linear-gradient(90deg, ${colorAlpha(color, bgAlpha)} 0%, transparent ${Math.max(r.percentage * 2, 20)}%)">
        <td style="border-left:4px solid ${color}">${i + 1}</td>
        <td class="td-truncate" title="${escapeAttr(r.investor_name)}">
          <div class="holder-name">
            <span class="holder-name-text">${escapeHTML(r.investor_name)}</span>
            ${konglo ? `<span class="konglo-badge" style="background:${colorAlpha(konglo.color, 0.15)};color:${konglo.color}"><span class="kb-dot" style="background:${konglo.color}"></span>K</span>` : ''}
          </div>
        </td>
        <td><span class="type-badge" style="background:${typeBg};color:${typeColor}">${getTypeName(r.investor_type)}</span></td>
        <td>${statusBg ? `<span class="status-badge" style="background:${statusBg};color:${statusColor}">${statusText}</span>` : `<span style="color:var(--text-muted)">—</span>`}</td>
        <td class="num">${formatDot(r.total_holding)}</td>
        <td class="num"><span class="pct-cell" style="color:${color}">${r.percentage.toFixed(2)}%</span></td>
      </tr>`;
    }).join('');

  } else if (type === 'investor') {
    document.getElementById('dataTable').insertAdjacentHTML('afterbegin',
      '<colgroup><col style="width:36px"><col style="width:60px"><col><col style="width:135px"><col style="width:80px"></colgroup>');

    thead.innerHTML = `<tr>
      <th>#</th>
      <th>Kode</th>
      <th>Nama Saham</th>
      <th class="num">Lembar Saham</th>
      <th class="num">%</th>
    </tr>`;

    tbody.innerHTML = sorted.map((r, i) => {
      const color = getPctColor(r.percentage);
      const bgAlpha = 0.04 + (r.percentage / 100) * 0.1;
      return `<tr style="background:linear-gradient(90deg, ${colorAlpha(color, bgAlpha)} 0%, transparent ${Math.max(r.percentage * 2, 20)}%)">
        <td style="border-left:4px solid ${color}">${i + 1}</td>
        <td class="code-cell">${r.share_code}</td>
        <td class="td-truncate" title="${escapeAttr(r.issuer_name)}">${escapeHTML(r.issuer_name)}</td>
        <td class="num">${formatDot(r.total_holding)}</td>
        <td class="num"><span class="pct-cell" style="color:${color}">${r.percentage.toFixed(2)}%</span></td>
      </tr>`;
    }).join('');

  } else {
    // Conglomerate
    document.getElementById('dataTable').insertAdjacentHTML('afterbegin',
      '<colgroup><col style="width:36px"><col style="width:60px"><col><col style="width:135px"><col style="width:80px"></colgroup>');

    thead.innerHTML = `<tr>
      <th>#</th>
      <th>Kode</th>
      <th>Investor</th>
      <th class="num">Lembar Saham</th>
      <th class="num">%</th>
    </tr>`;

    tbody.innerHTML = sorted.map((r, i) => {
      const color = getPctColor(r.percentage);
      const bgAlpha = 0.04 + (r.percentage / 100) * 0.1;
      return `<tr style="background:linear-gradient(90deg, ${colorAlpha(color, bgAlpha)} 0%, transparent ${Math.max(r.percentage * 2, 20)}%)">
        <td style="border-left:4px solid ${color}">${i + 1}</td>
        <td class="code-cell">${r.share_code}</td>
        <td class="td-truncate" title="${escapeAttr(r.investor_name)}">${escapeHTML(r.investor_name)}</td>
        <td class="num">${formatDot(r.total_holding)}</td>
        <td class="num"><span class="pct-cell" style="color:${color}">${r.percentage.toFixed(2)}%</span></td>
      </tr>`;
    }).join('');
  }
}

// ===== Allocation Panel =====
function buildConicGradient(items, total) {
  let angle = 0;
  const stops = [];
  for (const item of items) {
    const deg = (item.value / total) * 360;
    stops.push(`${item.color} ${angle}deg ${angle + deg}deg`);
    angle += deg;
  }
  return `conic-gradient(${stops.join(', ')})`;
}

function renderAllocation(type, key, records) {
  const el = document.getElementById('allocContainer');

  if (type === 'stock') {
    // By investor type donut
    const typeCounts = {};
    for (const r of records) {
      const t = getTypeName(r.investor_type);
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const typeItems = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: TYPE_COLORS[label] || '#94a3b8' }));
    const typeTotal = typeItems.reduce((s, i) => s + i.value, 0);

    // Local vs Foreign bar
    const localCount = records.filter(r => r.local_foreign === 'L').length;
    const foreignCount = records.filter(r => r.local_foreign === 'A').length;
    const otherCount = records.length - localCount - foreignCount;
    const lfTotal = records.length;

    // Top 5 holders
    const top5 = [...records].sort((a, b) => b.percentage - a.percentage).slice(0, 5);

    el.innerHTML = `
      <div class="alloc-section">
        <div class="alloc-section-title">By Investor Type</div>
        <div class="alloc-donut-area">
          <div class="alloc-donut" style="background:${buildConicGradient(typeItems, typeTotal)}">
            <div class="alloc-donut-hole">
              <span class="donut-val">${typeTotal}</span>
              <span class="donut-lbl">Holders</span>
            </div>
          </div>
          <div class="alloc-legend">
            ${typeItems.map(i => `<div class="alloc-legend-item">
              <span class="alloc-legend-dot" style="background:${i.color}"></span>
              <span class="alloc-legend-label">${i.label}</span>
              <span class="alloc-legend-val">${i.value}</span>
              <span class="alloc-legend-pct">${(i.value / typeTotal * 100).toFixed(1)}%</span>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="alloc-section">
        <div class="alloc-section-title">Local vs Foreign</div>
        <div class="alloc-bars">
          <div class="alloc-bar-row">
            <span class="alloc-bar-label" style="color:var(--green)">Local</span>
            <div class="alloc-bar-track"><div class="alloc-bar-fill" style="width:${localCount / lfTotal * 100}%;background:var(--green)">${localCount > lfTotal * 0.08 ? (localCount / lfTotal * 100).toFixed(0) + '%' : ''}</div></div>
            <span class="alloc-bar-val">${localCount}</span>
          </div>
          <div class="alloc-bar-row">
            <span class="alloc-bar-label" style="color:var(--blue)">Foreign</span>
            <div class="alloc-bar-track"><div class="alloc-bar-fill" style="width:${foreignCount / lfTotal * 100}%;background:var(--blue)">${foreignCount > lfTotal * 0.08 ? (foreignCount / lfTotal * 100).toFixed(0) + '%' : ''}</div></div>
            <span class="alloc-bar-val">${foreignCount}</span>
          </div>
          ${otherCount > 0 ? `<div class="alloc-bar-row">
            <span class="alloc-bar-label" style="color:var(--text-muted)">Other</span>
            <div class="alloc-bar-track"><div class="alloc-bar-fill" style="width:${otherCount / lfTotal * 100}%;background:var(--text-muted)">${otherCount > lfTotal * 0.08 ? (otherCount / lfTotal * 100).toFixed(0) + '%' : ''}</div></div>
            <span class="alloc-bar-val">${otherCount}</span>
          </div>` : ''}
        </div>
      </div>
      <div class="alloc-section">
        <div class="alloc-section-title">Top 5 Holders</div>
        <div class="alloc-top-list">
          ${top5.map((r, i) => {
            const c = getPctColor(r.percentage);
            return `<div class="alloc-top-item">
              <span class="alloc-top-rank">${i + 1}</span>
              <span class="alloc-top-name">${escapeHTML(r.investor_name)}</span>
              <span class="alloc-top-pct" style="color:${c}">${r.percentage.toFixed(2)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

  } else if (type === 'investor') {
    // Allocation across stocks - donut by percentage
    const sorted = [...records].sort((a, b) => b.percentage - a.percentage);
    const colors = ['#818cf8', '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#f87171', '#06b6d4'];
    const items = sorted.map((r, i) => ({
      label: r.share_code,
      value: r.percentage,
      color: colors[i % colors.length],
    }));
    const total = items.reduce((s, i) => s + i.value, 0);

    // By stock type (unique stocks count)
    const stockCount = records.length;

    el.innerHTML = `
      <div class="alloc-section">
        <div class="alloc-section-title">Holdings Distribution</div>
        <div class="alloc-donut-area">
          <div class="alloc-donut" style="background:${buildConicGradient(items, total)}">
            <div class="alloc-donut-hole">
              <span class="donut-val">${stockCount}</span>
              <span class="donut-lbl">Stocks</span>
            </div>
          </div>
          <div class="alloc-legend">
            ${items.slice(0, 6).map(i => `<div class="alloc-legend-item">
              <span class="alloc-legend-dot" style="background:${i.color}"></span>
              <span class="alloc-legend-label">${i.label}</span>
              <span class="alloc-legend-val">${i.value.toFixed(2)}%</span>
            </div>`).join('')}
            ${items.length > 6 ? `<div class="alloc-legend-item"><span class="alloc-legend-dot" style="background:var(--text-muted)"></span><span class="alloc-legend-label" style="color:var(--text-muted)">+${items.length - 6} more</span></div>` : ''}
          </div>
        </div>
      </div>
      <div class="alloc-section">
        <div class="alloc-section-title">Top Holdings</div>
        <div class="alloc-top-list">
          ${sorted.slice(0, 5).map((r, i) => {
            const c = getPctColor(r.percentage);
            return `<div class="alloc-top-item">
              <span class="alloc-top-rank">${i + 1}</span>
              <span class="alloc-top-name"><strong style="color:var(--accent)">${r.share_code}</strong> &middot; ${escapeHTML(r.issuer_name)}</span>
              <span class="alloc-top-pct" style="color:${c}">${r.percentage.toFixed(2)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;

  } else {
    // Conglomerate - allocation across stocks
    const stockPcts = {};
    for (const r of records) {
      if (!stockPcts[r.share_code]) stockPcts[r.share_code] = { code: r.share_code, totalPct: 0, count: 0 };
      stockPcts[r.share_code].totalPct += r.percentage;
      stockPcts[r.share_code].count++;
    }
    const stockList = Object.values(stockPcts).sort((a, b) => b.totalPct - a.totalPct);
    const colors = ['#818cf8', '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#f87171', '#06b6d4'];
    const items = stockList.map((s, i) => ({ label: s.code, value: s.totalPct, color: colors[i % colors.length] }));
    const total = items.reduce((s, i) => s + i.value, 0);

    el.innerHTML = `
      <div class="alloc-section">
        <div class="alloc-section-title">Ownership by Stock</div>
        <div class="alloc-donut-area">
          <div class="alloc-donut" style="background:${buildConicGradient(items, total)}">
            <div class="alloc-donut-hole">
              <span class="donut-val">${stockList.length}</span>
              <span class="donut-lbl">Stocks</span>
            </div>
          </div>
          <div class="alloc-legend">
            ${items.slice(0, 6).map(i => `<div class="alloc-legend-item">
              <span class="alloc-legend-dot" style="background:${i.color}"></span>
              <span class="alloc-legend-label">${i.label}</span>
              <span class="alloc-legend-val">${i.value.toFixed(1)}%</span>
            </div>`).join('')}
            ${items.length > 6 ? `<div class="alloc-legend-item"><span class="alloc-legend-dot" style="background:var(--text-muted)"></span><span class="alloc-legend-label" style="color:var(--text-muted)">+${items.length - 6} more</span></div>` : ''}
          </div>
        </div>
      </div>
      <div class="alloc-section">
        <div class="alloc-section-title">Largest Positions</div>
        <div class="alloc-top-list">
          ${stockList.slice(0, 5).map((s, i) => {
            const c = getPctColor(s.totalPct);
            return `<div class="alloc-top-item">
              <span class="alloc-top-rank">${i + 1}</span>
              <span class="alloc-top-name"><strong style="color:var(--accent)">${s.code}</strong> &middot; ${s.count} entities</span>
              <span class="alloc-top-pct" style="color:${c}">${s.totalPct.toFixed(1)}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }
}

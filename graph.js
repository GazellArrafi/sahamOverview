// =============================================
// Graph - Animated force-directed network graph
// =============================================

const graphState = {
  nodes: [], edges: [],
  zoom: 1, panX: 0, panY: 0,
  dragging: null, mouseDown: false,
  lastMouse: { x: 0, y: 0 },
  hoveredNode: null,
  animFrame: null, running: false,
};

function buildGraph(type, key, records) {
  stopSimulation();

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  function addNode(id, label, ntype, size, meta, sub) {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, nodes.length);
      nodes.push({ id, label, ntype, size, meta: meta || {}, sub: !!sub, x: 0, y: 0, vx: 0, vy: 0, parent: null });
    }
    return nodeMap.get(id);
  }

  const MAX_PRIMARY = 15;
  const MAX_SUB = 3;

  if (type === 'stock') {
    // Center: stock
    addNode(`stock:${key}`, key, 'stock', 34, { code: key, issuer_name: records[0]?.issuer_name });

    records.forEach(r => {
      const idx = addNode(`inv:${r.investor_name}`, r.investor_name, getNodeType(r.investor_type), 13 + Math.sqrt(r.percentage) * 4, r);
      edges.push({ source: idx, target: 0, weight: r.percentage, label: `${r.percentage}%` });
    });

    // Sub-nodes: for each holder, show their top 3 OTHER stocks
    records.slice(0, MAX_PRIMARY).forEach(r => {
      const parentIdx = nodeMap.get(`inv:${r.investor_name}`);
      const otherStocks = (investorIndex[r.investor_name] || [])
        .filter(d => d.share_code !== key)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, MAX_SUB);

      otherStocks.forEach(d => {
        const subIdx = addNode(`stock:${d.share_code}`, d.share_code, 'stock', 9, d, true);
        nodes[subIdx].parent = parentIdx;
        edges.push({ source: parentIdx, target: subIdx, weight: d.percentage, label: `${d.percentage}%`, sub: true });
      });
    });

  } else if (type === 'investor') {
    // Center: investor
    addNode(`inv:${key}`, key, getNodeType(records[0]?.investor_type), 34, records[0]);

    const topRecords = [...records].sort((a, b) => b.percentage - a.percentage).slice(0, MAX_PRIMARY);
    topRecords.forEach(r => {
      const idx = addNode(`stock:${r.share_code}`, r.share_code, 'stock', 13 + Math.sqrt(r.percentage) * 4, r);
      edges.push({ source: 0, target: idx, weight: r.percentage, label: `${r.percentage}%` });
    });

    // Sub-nodes: for each stock, show top 3 OTHER holders
    topRecords.forEach(r => {
      const parentIdx = nodeMap.get(`stock:${r.share_code}`);
      const otherHolders = (stockIndex[r.share_code] || [])
        .filter(d => d.investor_name !== key)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, MAX_SUB);

      otherHolders.forEach(d => {
        const subIdx = addNode(`inv:${d.investor_name}`, d.investor_name, getNodeType(d.investor_type), 9, d, true);
        nodes[subIdx].parent = parentIdx;
        edges.push({ source: subIdx, target: parentIdx, weight: d.percentage, label: `${d.percentage}%`, sub: true });
      });
    });

  } else if (type === 'conglomerate') {
    const investorSet = new Set();
    const stockSet = new Set();
    records.forEach(r => { investorSet.add(r.investor_name); stockSet.add(r.share_code); });

    investorSet.forEach(name => {
      const recs = records.filter(r => r.investor_name === name);
      addNode(`inv:${name}`, name, getNodeType(recs[0]?.investor_type), 16 + Math.sqrt(recs.length) * 4, recs[0]);
    });
    stockSet.forEach(code => {
      addNode(`stock:${code}`, code, 'stock', 14, { code, share_code: code });
    });
    records.forEach(r => {
      const si = nodeMap.get(`inv:${r.investor_name}`);
      const ti = nodeMap.get(`stock:${r.share_code}`);
      if (si !== undefined && ti !== undefined) {
        edges.push({ source: si, target: ti, weight: r.percentage, label: `${r.percentage}%` });
      }
    });
  }

  // Initial layout
  const canvas = document.getElementById('graphCanvas');
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const cx = W / 2, cy = H / 2;

  // Separate primary and sub nodes
  const primaryNodes = nodes.filter(n => !n.sub);
  const subNodes = nodes.filter(n => n.sub);

  // Layout primary nodes in circle
  if (type === 'conglomerate') {
    primaryNodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / primaryNodes.length;
      const r = Math.min(W, H) * 0.34;
      n.x = cx + Math.cos(angle) * r * (0.8 + Math.random() * 0.2);
      n.y = cy + Math.sin(angle) * r * (0.8 + Math.random() * 0.2);
    });
  } else {
    primaryNodes[0].x = cx;
    primaryNodes[0].y = cy;
    primaryNodes.slice(1).forEach((n, i) => {
      const angle = (2 * Math.PI * i) / (primaryNodes.length - 1);
      const r = Math.min(W, H) * 0.28;
      n.x = cx + Math.cos(angle) * r;
      n.y = cy + Math.sin(angle) * r;
    });
  }

  // Layout sub nodes near their parent
  subNodes.forEach(n => {
    const parent = nodes[n.parent];
    if (parent) {
      const angle = Math.atan2(parent.y - cy, parent.x - cx) + (Math.random() - 0.5) * 1.5;
      const dist = 60 + Math.random() * 30;
      n.x = parent.x + Math.cos(angle) * dist;
      n.y = parent.y + Math.sin(angle) * dist;
    } else {
      n.x = cx + (Math.random() - 0.5) * W * 0.6;
      n.y = cy + (Math.random() - 0.5) * H * 0.6;
    }
  });

  graphState.nodes = nodes;
  graphState.edges = edges;
  graphState.zoom = 1;
  graphState.panX = 0;
  graphState.panY = 0;
  graphState.hoveredNode = null;

  startSimulation();
}

// ===== Force Simulation (animated) =====
function startSimulation() {
  graphState.running = true;
  let cooldown = 1.0;

  function tick() {
    if (!graphState.running) return;
    const { nodes, edges, dragging } = graphState;
    const canvas = document.getElementById('graphCanvas');
    if (!canvas) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const cx = W / 2, cy = H / 2;

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        // Sub nodes repel less
        const strength = (nodes[i].sub && nodes[j].sub) ? 800 : (nodes[i].sub || nodes[j].sub) ? 1200 : 2500;
        const force = strength / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        if (nodes[i] !== dragging) { nodes[i].vx -= fx; nodes[i].vy -= fy; }
        if (nodes[j] !== dragging) { nodes[j].vx += fx; nodes[j].vy += fy; }
      }
    }

    // Attraction (springs)
    edges.forEach(e => {
      const a = nodes[e.source], b = nodes[e.target];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = e.sub ? 70 : 140 + (nodes.length > 30 ? 20 : 0);
      const force = (dist - ideal) * (e.sub ? 0.012 : 0.008);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (a !== dragging) { a.vx += fx; a.vy += fy; }
      if (b !== dragging) { b.vx -= fx; b.vy -= fy; }
    });

    // Center gravity
    nodes.forEach(n => {
      if (n === dragging) return;
      n.vx += (cx - n.x) * 0.0006;
      n.vy += (cy - n.y) * 0.0006;
    });

    // Apply + damp
    const damping = 0.82;
    let totalV = 0;
    nodes.forEach(n => {
      if (n === dragging) { n.vx = 0; n.vy = 0; return; }
      n.vx *= damping * cooldown;
      n.vy *= damping * cooldown;
      n.x += n.vx;
      n.y += n.vy;
      totalV += Math.abs(n.vx) + Math.abs(n.vy);
    });

    cooldown = Math.max(cooldown * 0.998, 0.3);
    drawGraph();

    if (totalV > 0.2 || dragging) {
      graphState.animFrame = requestAnimationFrame(tick);
    } else {
      graphState.running = false;
    }
  }

  graphState.animFrame = requestAnimationFrame(tick);
}

function stopSimulation() {
  graphState.running = false;
  if (graphState.animFrame) { cancelAnimationFrame(graphState.animFrame); graphState.animFrame = null; }
}

function resumeSimulation() {
  if (!graphState.running && graphState.nodes.length) {
    graphState.nodes.forEach(n => {
      if (n !== graphState.dragging) { n.vx += (Math.random() - 0.5) * 0.5; n.vy += (Math.random() - 0.5) * 0.5; }
    });
    startSimulation();
  }
}

// ===== Drawing =====
function drawGraph() {
  const canvas = document.getElementById('graphCanvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = canvas.clientWidth, H = canvas.clientHeight;
  const { nodes, edges, zoom, panX, panY, hoveredNode } = graphState;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(panX + W / 2, panY + H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);

  const isDark = document.documentElement.dataset.theme === 'dark';
  const edgeColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
  const edgeSubColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.08)';
  const edgeHighlight = isDark ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.65)';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const textDim = isDark ? '#475569' : '#cbd5e1';

  const hovIdx = hoveredNode ? nodes.indexOf(hoveredNode) : -1;
  const connEdges = new Set();
  const connNodes = new Set();

  if (hovIdx >= 0) {
    edges.forEach((e, i) => {
      if (e.source === hovIdx || e.target === hovIdx) {
        connEdges.add(i);
        connNodes.add(e.source);
        connNodes.add(e.target);
      }
    });
  }

  // Edges
  edges.forEach((e, i) => {
    const a = nodes[e.source], b = nodes[e.target];
    const isHL = connEdges.has(i);
    const dimmed = hovIdx >= 0 && !isHL;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = isHL ? edgeHighlight : dimmed ? (isDark ? 'rgba(148,163,184,0.03)' : 'rgba(100,116,139,0.03)') : (e.sub ? edgeSubColor : edgeColor);
    ctx.lineWidth = isHL ? Math.min(2 + e.weight / 12, 5) : e.sub ? 0.8 : Math.min(1 + e.weight / 25, 3);
    ctx.stroke();

    if (!dimmed && !e.sub) {
      ctx.fillStyle = isHL ? (isDark ? '#c7d2fe' : '#4338ca') : (isDark ? 'rgba(148,163,184,0.4)' : 'rgba(71,85,105,0.5)');
      ctx.font = isHL ? 'bold 11px Inter,sans-serif' : '9px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 5);
    }
  });

  // Nodes
  nodes.forEach((n, i) => {
    const color = getNodeColor(n.ntype);
    const isHov = i === hovIdx;
    const isConn = connNodes.has(i);
    const dimmed = hovIdx >= 0 && !isConn && !isHov;
    const subDim = n.sub && !isConn && !isHov && hovIdx < 0;

    // Glow
    if (isHov || isConn) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.size + (isHov ? 10 : 6), 0, Math.PI * 2);
      ctx.fillStyle = colorAlpha(color, isHov ? 0.22 : 0.1);
      ctx.fill();
    }

    // Node
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
    const alpha = dimmed ? 0.1 : subDim ? 0.5 : 1;
    ctx.fillStyle = alpha < 1 ? colorAlpha(color, alpha) : color;
    ctx.fill();

    if (isHov) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    } else if (!dimmed) {
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = n.sub ? 0.8 : 1.5; ctx.stroke();
    }

    // Label
    if (!dimmed && !(subDim && n.size < 10)) {
      const label = n.label.length > 22 ? n.label.slice(0, 20) + '..' : n.label;
      ctx.fillStyle = dimmed ? textDim : subDim ? (isDark ? '#64748b' : '#94a3b8') : textColor;
      ctx.font = (n.size > 20 || isHov) ? 'bold 12px Inter,sans-serif' : n.sub ? '9px Inter,sans-serif' : '11px Inter,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, n.x, n.y + n.size + 4);
    }
  });

  ctx.restore();
}

// ===== Interaction =====
function setupGraphInteraction() {
  const canvas = document.getElementById('graphCanvas');
  const tooltip = document.getElementById('tooltip');

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    graphState.zoom = Math.max(0.2, Math.min(6, graphState.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    drawGraph();
  });

  canvas.addEventListener('mousedown', e => {
    graphState.mouseDown = true;
    graphState.lastMouse = { x: e.clientX, y: e.clientY };
    const pos = canvasToGraph(e);
    for (const n of graphState.nodes) {
      if (Math.hypot(pos.x - n.x, pos.y - n.y) < n.size + 5) {
        graphState.dragging = n;
        canvas.style.cursor = 'grabbing';
        resumeSimulation();
        return;
      }
    }
  });

  canvas.addEventListener('mousemove', e => {
    const pos = canvasToGraph(e);
    if (graphState.dragging) {
      graphState.dragging.x = pos.x;
      graphState.dragging.y = pos.y;
      if (!graphState.running) drawGraph();
      return;
    }
    if (graphState.mouseDown) {
      graphState.panX += e.clientX - graphState.lastMouse.x;
      graphState.panY += e.clientY - graphState.lastMouse.y;
      graphState.lastMouse = { x: e.clientX, y: e.clientY };
      drawGraph();
      return;
    }
    let hovered = null;
    for (const n of graphState.nodes) {
      if (Math.hypot(pos.x - n.x, pos.y - n.y) < n.size + 5) { hovered = n; break; }
    }
    if (hovered !== graphState.hoveredNode) { graphState.hoveredNode = hovered; drawGraph(); }
    if (hovered) {
      canvas.style.cursor = 'pointer';
      showGraphTooltip(e.clientX, e.clientY, hovered);
    } else {
      canvas.style.cursor = 'grab';
      tooltip.classList.remove('visible');
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (graphState.dragging) { graphState.dragging = null; setTimeout(() => { if (!graphState.running) startSimulation(); }, 100); }
    graphState.mouseDown = false; canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('mouseleave', () => {
    graphState.mouseDown = false; graphState.dragging = null;
    graphState.hoveredNode = null; drawGraph(); tooltip.classList.remove('visible');
  });

  canvas.addEventListener('dblclick', e => {
    const pos = canvasToGraph(e);
    for (const n of graphState.nodes) {
      if (Math.hypot(pos.x - n.x, pos.y - n.y) < n.size + 5) {
        if (n.id.startsWith('stock:')) navigateTo('stock', n.id.replace('stock:', ''));
        else navigateTo('investor', n.id.replace('inv:', ''));
        break;
      }
    }
  });

  document.getElementById('zoomIn').addEventListener('click', () => { graphState.zoom = Math.min(6, graphState.zoom * 1.3); drawGraph(); });
  document.getElementById('zoomOut').addEventListener('click', () => { graphState.zoom = Math.max(0.2, graphState.zoom * 0.7); drawGraph(); });
  document.getElementById('resetView').addEventListener('click', () => { graphState.zoom = 1; graphState.panX = 0; graphState.panY = 0; drawGraph(); });
}

function canvasToGraph(e) {
  const canvas = document.getElementById('graphCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - graphState.panX - canvas.clientWidth / 2) / graphState.zoom + canvas.clientWidth / 2,
    y: (e.clientY - rect.top - graphState.panY - canvas.clientHeight / 2) / graphState.zoom + canvas.clientHeight / 2,
  };
}

// Enhanced tooltip - fetches ALL holders/stocks from index
function showGraphTooltip(mx, my, node) {
  const tooltip = document.getElementById('tooltip');
  const isStock = node.id.startsWith('stock:');
  const code = node.id.replace('stock:', '').replace('inv:', '');

  let html = `<div class="tt-title" style="display:flex;align-items:center;gap:8px">
    <span style="width:10px;height:10px;border-radius:50%;background:${getNodeColor(node.ntype)};flex-shrink:0"></span>
    ${escapeHTML(node.label)}
  </div>`;

  if (isStock) {
    // Show ALL holders from index
    const allHolders = (stockIndex[code] || []).sort((a, b) => b.percentage - a.percentage);
    html += `<div class="tt-row"><span class="tt-label">Issuer</span><span>${escapeHTML(node.meta?.issuer_name || '')}</span></div>`;
    html += `<div class="tt-row"><span class="tt-label">Total holders</span><span>${allHolders.length}</span></div>`;
    html += `<div style="border-top:1px solid var(--border);margin:6px 0 4px;font-size:10px;color:var(--text-muted);font-weight:600">ALL HOLDERS</div>`;
    allHolders.slice(0, 12).forEach(h => {
      const c = getPctColor(h.percentage);
      html += `<div class="tt-row"><span class="tt-label">${escapeHTML(h.investor_name.length > 28 ? h.investor_name.slice(0, 26) + '..' : h.investor_name)}</span><span style="font-weight:600;color:${c}">${h.percentage}%</span></div>`;
    });
    if (allHolders.length > 12) html += `<div class="tt-row"><span class="tt-label" style="font-style:italic">+${allHolders.length - 12} more</span><span></span></div>`;
  } else {
    // Show ALL stocks from index
    const allStocks = (investorIndex[code] || []).sort((a, b) => b.percentage - a.percentage);
    html += `<div class="tt-row"><span class="tt-label">Type</span><span>${getTypeName(node.meta?.investor_type)}</span></div>`;
    html += `<div class="tt-row"><span class="tt-label">Domicile</span><span>${node.meta?.domicile || '-'}</span></div>`;
    html += `<div class="tt-row"><span class="tt-label">Total stocks</span><span>${allStocks.length}</span></div>`;
    html += `<div style="border-top:1px solid var(--border);margin:6px 0 4px;font-size:10px;color:var(--text-muted);font-weight:600">ALL HOLDINGS</div>`;
    allStocks.slice(0, 12).forEach(s => {
      const c = getPctColor(s.percentage);
      html += `<div class="tt-row"><span class="tt-label">${s.share_code} - ${escapeHTML(s.issuer_name.length > 20 ? s.issuer_name.slice(0, 18) + '..' : s.issuer_name)}</span><span style="font-weight:600;color:${c}">${s.percentage}%</span></div>`;
    });
    if (allStocks.length > 12) html += `<div class="tt-row"><span class="tt-label" style="font-style:italic">+${allStocks.length - 12} more</span><span></span></div>`;
  }

  html += `<div style="margin-top:6px;font-size:10px;color:var(--text-muted)">Double-click to explore</div>`;

  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let tx = mx + 14, ty = my + 14;
  if (tx + tw > window.innerWidth - 16) tx = mx - tw - 14;
  if (ty + th > window.innerHeight - 16) ty = my - th - 14;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
}

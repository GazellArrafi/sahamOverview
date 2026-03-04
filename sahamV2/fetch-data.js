#!/usr/bin/env node
// =============================================
// KSEI Data Fetcher
// Downloads holding composition from KSEI,
// extracts ZIP, parses data, outputs JSON.
// Usage: node fetch-data.js [YYYYMMDD]
// =============================================

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TYPE_NAMES = {
  IS: 'Insurance',
  CP: 'Corporate',
  PF: 'Pension Fund',
  IB: 'Investment Bank',
  ID: 'Individual',
  MF: 'Mutual Fund',
  SC: 'Securities',
  FD: 'Foundation',
  OT: 'Other',
};

const INVESTOR_TYPES = ['IS', 'CP', 'PF', 'IB', 'ID', 'MF', 'SC', 'FD', 'OT'];

// Get the date parameter or use latest available
function getDateParam() {
  if (process.argv[2]) return process.argv[2];
  // Default: last business day of previous month or today
  const now = new Date();
  // Try current month's last available
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchArchivePage() {
  console.log('Fetching KSEI archive page to find latest date...');
  const html = await download('https://web.ksei.co.id/archive_download/holding_composition');
  const text = html.toString('utf8');
  // Find all download links like /Download/BalanceposEfek20260227.zip
  const matches = [...text.matchAll(/\/Download\/BalanceposEfek(\d{8})\.zip/g)];
  if (!matches.length) {
    throw new Error('No download links found on KSEI archive page');
  }
  // Sort descending and return the latest date
  const dates = matches.map(m => m[1]).sort().reverse();
  console.log(`Found dates: ${dates.join(', ')}`);
  return dates[0];
}

function parseLine(line) {
  const parts = line.split('|');
  if (parts.length < 25) return null;

  const [dateStr, code, type, secNumStr, priceStr,
    lIS, lCP, lPF, lIB, lID, lMF, lSC, lFD, lOT, lTotal,
    fIS, fCP, fPF, fIB, fID, fMF, fSC, fFD, fOT, fTotal] = parts;

  const secNum = parseInt(secNumStr) || 0;
  const price = parseInt(priceStr) || 0;

  const local = {
    IS: parseInt(lIS) || 0,
    CP: parseInt(lCP) || 0,
    PF: parseInt(lPF) || 0,
    IB: parseInt(lIB) || 0,
    ID: parseInt(lID) || 0,
    MF: parseInt(lMF) || 0,
    SC: parseInt(lSC) || 0,
    FD: parseInt(lFD) || 0,
    OT: parseInt(lOT) || 0,
    total: parseInt(lTotal) || 0,
  };

  const foreign = {
    IS: parseInt(fIS) || 0,
    CP: parseInt(fCP) || 0,
    PF: parseInt(fPF) || 0,
    IB: parseInt(fIB) || 0,
    ID: parseInt(fID) || 0,
    MF: parseInt(fMF) || 0,
    SC: parseInt(fSC) || 0,
    FD: parseInt(fFD) || 0,
    OT: parseInt(fOT) || 0,
    total: parseInt(fTotal) || 0,
  };

  const totalShares = local.total + foreign.total;
  const localPct = totalShares > 0 ? (local.total / totalShares * 100) : 0;
  const foreignPct = totalShares > 0 ? (foreign.total / totalShares * 100) : 0;
  const marketCap = secNum * price;

  // Build per-type breakdown
  const byType = {};
  for (const t of INVESTOR_TYPES) {
    byType[t] = {
      local: local[t],
      foreign: foreign[t],
      total: local[t] + foreign[t],
    };
  }

  return {
    date: dateStr,
    code,
    type,
    secNum,
    price,
    marketCap,
    local,
    foreign,
    totalShares,
    localPct: Math.round(localPct * 100) / 100,
    foreignPct: Math.round(foreignPct * 100) / 100,
    byType,
  };
}

async function main() {
  try {
    let dateParam = process.argv[2];

    // If no date given, auto-detect from archive page
    if (!dateParam) {
      dateParam = await fetchArchivePage();
    }

    const url = `https://web.ksei.co.id/Download/BalanceposEfek${dateParam}.zip`;
    console.log(`Downloading: ${url}`);

    const zipBuffer = await download(url);
    const zipPath = path.join(__dirname, `_temp_ksei_${dateParam}.zip`);
    const txtPath = path.join(__dirname, `Balancepos${dateParam}.txt`);

    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`Downloaded ${(zipBuffer.length / 1024).toFixed(1)} KB`);

    // Extract using system unzip (or tar on some systems)
    try {
      execSync(`unzip -o "${zipPath}" -d "${__dirname}"`, { stdio: 'pipe' });
    } catch {
      // Try powershell on Windows
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${__dirname}' -Force"`, { stdio: 'pipe' });
    }

    // Find the extracted file
    let dataFile = txtPath;
    if (!fs.existsSync(dataFile)) {
      // Try finding any .txt file that was just created
      const files = fs.readdirSync(__dirname).filter(f => f.startsWith('Balancepos') && f.endsWith('.txt'));
      if (files.length) dataFile = path.join(__dirname, files[files.length - 1]);
      else throw new Error('Could not find extracted data file');
    }

    console.log(`Parsing: ${path.basename(dataFile)}`);
    const raw = fs.readFileSync(dataFile, 'utf8');
    const lines = raw.trim().split('\n');

    // Skip header
    const header = lines[0];
    const dataLines = lines.slice(1);

    const stocks = [];
    for (const line of dataLines) {
      const parsed = parseLine(line.trim());
      if (parsed && parsed.code) stocks.push(parsed);
    }

    // Sort by code
    stocks.sort((a, b) => a.code.localeCompare(b.code));

    // Compute market-wide aggregates
    const summary = {
      date: stocks[0]?.date || dateParam,
      totalStocks: stocks.length,
      totalMarketCap: stocks.reduce((s, st) => s + st.marketCap, 0),
      totalShares: stocks.reduce((s, st) => s + st.totalShares, 0),
      avgLocalPct: stocks.reduce((s, st) => s + st.localPct, 0) / stocks.length,
      avgForeignPct: stocks.reduce((s, st) => s + st.foreignPct, 0) / stocks.length,
      byType: {},
    };

    for (const t of INVESTOR_TYPES) {
      summary.byType[t] = {
        local: stocks.reduce((s, st) => s + st.byType[t].local, 0),
        foreign: stocks.reduce((s, st) => s + st.byType[t].foreign, 0),
        total: stocks.reduce((s, st) => s + st.byType[t].total, 0),
      };
    }

    const output = { summary, stocks };
    const outputPath = path.join(__dirname, 'ksei-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(output));
    console.log(`\nOutput: ${outputPath}`);
    console.log(`Stocks: ${stocks.length}`);
    console.log(`Date: ${summary.date}`);
    console.log(`Total Market Cap: Rp ${(summary.totalMarketCap / 1e12).toFixed(1)}T`);
    console.log(`Avg Local: ${summary.avgLocalPct.toFixed(1)}% | Avg Foreign: ${summary.avgForeignPct.toFixed(1)}%`);

    // Also write as JS for direct browser use
    const jsPath = path.join(__dirname, 'ksei-data.js');
    fs.writeFileSync(jsPath, `// Auto-generated from KSEI - ${summary.date}\nwindow.KSEI_DATA = ${JSON.stringify(output)};\n`);
    console.log(`JS output: ${jsPath}`);

    // Cleanup
    try { fs.unlinkSync(zipPath); } catch {}
    try { fs.unlinkSync(dataFile); } catch {}

    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();

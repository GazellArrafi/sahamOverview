const esbuild = require('esbuild');
const fs = require('fs');
const vm = require('vm');

// Encode data.js: evaluate it to extract STOCK_DATA, then base64-encode the JSON
const dataRaw = fs.readFileSync('src/data.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(dataRaw, sandbox);
const dataJson = JSON.stringify(sandbox.window.STOCK_DATA);
const dataEncoded = Buffer.from(dataJson).toString('base64');
const dataRuntime = `window.STOCK_DATA=JSON.parse(atob("${dataEncoded}"));`;

// Bundle the rest of the logic files normally
const logicOrder = ['config.js', 'utils.js', 'graph.js', 'dashboard.js', 'search.js', 'app.js'];
const logic = logicOrder.map(f => fs.readFileSync(`src/${f}`, 'utf8')).join('\n;\n');

const combined = dataRuntime + '\n;\n' + logic;

esbuild.transform(combined, {
  minify: true,
  target: 'es2015',
}).then(({ code }) => {
  fs.writeFileSync('app.js', code);
  console.log('Build complete: app.js (' + (code.length / 1024).toFixed(1) + ' KB)');
}).catch(err => {
  console.error('Build failed:', err.message);
  process.exit(1);
});

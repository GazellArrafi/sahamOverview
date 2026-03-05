const esbuild = require('esbuild');
const fs = require('fs');

const order = ['data.js', 'config.js', 'utils.js', 'graph.js', 'dashboard.js', 'search.js', 'app.js'];
const combined = order.map(f => fs.readFileSync(`src/${f}`, 'utf8')).join('\n;\n');

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

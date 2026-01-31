const fs = require('fs'), path = require('path');
const repo = process.argv[2] || (process.env.HOME + '/Arvdoul');
const src = path.join(repo, 'src');
function walk(dir, acc=[]) {
  try { for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir,f);
    if (fs.statSync(fp).isDirectory()) walk(fp,acc);
    else acc.push(fp);
  }} catch(e){}
  return acc;
}
const existsSet = new Set(walk(src).map(p => path.relative(src,p).replace(/\\/g,'/')));
const jsFiles = walk(src).filter(p=>/\.(js|jsx|ts|tsx)$/.test(p));
const missing = [];
for (const f of jsFiles) {
  const txt = fs.readFileSync(f,'utf8');
  const relDir = path.dirname(path.relative(src,f)).replace(/\\/g,'/');
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const imp = m[1];
    if (imp.startsWith('.')) {
      const candidateBase = path.normalize(path.join(relDir, imp)).replace(/\\/g,'/');
      const possibilities = [
        candidateBase,
        candidateBase + '.js', candidateBase + '.jsx', candidateBase + '.ts', candidateBase + '.tsx',
        candidateBase + '/index.js', candidateBase + '/index.jsx', candidateBase + '/index.ts', candidateBase + '/index.tsx'
      ];
      let found = possibilities.some(p=>existsSet.has(p));
      if (!found) missing.push({file: path.relative(src,f).replace(/\\/g,'/'), import: imp});
    }
  }
}
console.log(JSON.stringify({missing}, null, 2));

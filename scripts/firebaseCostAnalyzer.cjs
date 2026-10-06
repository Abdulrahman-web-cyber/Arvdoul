'use strict';

const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function balancedCalls(text, callee) {
  const sites = [];
  const re = new RegExp(callee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'g');
  let m;
  while ((m = re.exec(text))) {
    let depth = 0;
    let j = m.index + m[0].length - 1;
    for (; j < text.length; j++) {
      const c = text[j];
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    sites.push(text.slice(m.index + m[0].length - 1, j + 1));
  }
  return sites;
}

const LIMIT = /\b\w*[Ll]imit\s*\(/;

function firstArg(call) {
  const inner = call.slice(1, -1);
  let depth = 0;
  let out = '';
  for (const c of inner) {
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) break;
    out += c;
  }
  return out.trim();
}

function declOf(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp('(?:const|let|var)\\s+' + escaped + '\\s*=\\s*([^;\\n]+)'));
  return m ? m[1] : '';
}

function isBounded(call, text) {
  if (LIMIT.test(call)) return true;
  const a = firstArg(call);
  const resolved = /^[A-Za-z_$][\w$]*$/.test(a) ? declOf(text, a) : call;
  if (LIMIT.test(resolved)) return true;
  return /\.doc\(|\bdoc\(/.test(a) || /\.doc\(|\bdoc\(/.test(resolved);
}

function analyze(root) {
  const files = walk(path.join(root, 'src')).filter((f) => !f.includes('__tests__'));
  const unboundedReads = {};
  const listeners = {};
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const text = fs.readFileSync(f, 'utf8');
    let unbounded = 0;
    for (const call of balancedCalls(text, 'getDocs')) {
      if (!isBounded(call, text)) unbounded++;
    }
    if (unbounded) unboundedReads[rel] = unbounded;
    const l = balancedCalls(text, 'onSnapshot').length;
    if (l) listeners[rel] = l;
  }
  return { unboundedReads, listeners };
}

module.exports = { analyze };

/**
 * AST-accurate Firestore composite index auditor.
 *
 * Walks every CallExpression that resolves to a Firestore `collection()` or
 * `.collection()` reference, then reads the where()/orderBy() calls chained
 * directly onto that same expression. This avoids the false merges a regex
 * lookahead produces when two queries appear on adjacent lines.
 *
 * Usage: node scripts/audit-firestore-indexes.mjs
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '__tests__', 'dist', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function parse(source, file) {
  for (const sourceType of ['module', 'script']) {
    try {
      return acorn.Parser.extend(jsx()).parse(source, {
        sourceType,
        ecmaVersion: 'latest',
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
      });
    } catch { /* try next */ }
  }
  return null;
}

/** Recursively visit every node. */
function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) visit(n, fn); return; }
  if (typeof node.type === 'string') fn(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    visit(node[key], fn);
  }
}

const isIdent = (n, name) => n && n.type === 'Identifier' && n.name === name;

/** `collection(x, 'name')` */
function collectionCall(node) {
  if (node?.type !== 'CallExpression') return null;
  if (!isIdent(node.callee, 'collection')) return null;
  const arg = node.arguments[1];
  if (arg?.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  return null;
}

/** `.collection('name')` */
function collectionMember(node) {
  if (node?.type !== 'CallExpression') return null;
  const c = node.callee;
  if (c?.type !== 'MemberExpression' || !c.computed) return null;
  if (c.property?.type !== 'Literal' || typeof c.property.value !== 'string') return null;
  if (!isIdent(c.object, 'fs') && !isIdent(c.object, 'firestore') && !isIdent(c.object, 'db')) return null;
  if (!isIdent(c.property, 'collection')) return c.property?.name === 'collection' ? c.property.value : null;
  return null;
}

/** Resolve a node to {collection} if it is a collection reference. */
function resolveCollection(node) {
  const direct = collectionCall(node);
  if (direct) return direct;
  if (node?.type !== 'CallExpression') return null;
  const c = node.callee;
  if (c?.type === 'MemberExpression' && isIdent(c.property, 'collection')) {
    const arg = node.arguments[0];
    if (arg?.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  }
  return null;
}

const strArg = (node, i) => {
  const a = node.arguments[i];
  return a?.type === 'Literal' && typeof a.value === 'string' ? a.value : null;
};

function findQueries(ast, file, out) {
  // For each collection ref, walk *up* through the chain is hard with acorn
  // (no parent links); instead we detect chains top-down: a `query(...)` call
  // or a chained call whose root is a collection ref.
  const chains = [];

  function chainOf(node) {
    /** Return {collection, wheres, orders} if this expression is a chain over a collection. */
    if (!node || node.type !== 'CallExpression') return null;
    const col = resolveCollection(node);
    if (col) return { collection: col, wheres: [], orders: [] };
    const c = node.callee;
    if (c?.type !== 'MemberExpression') return null;
    const base = chainOf(c.object);
    if (!base) return null;
    const prop = c.property;
    const name = prop && (prop.name || prop.value);
    if (name === 'where') {
      const f = strArg(node, 0);
      if (f) base.wheres.push(f);
    } else if (name === 'orderBy') {
      const f = strArg(node, 0);
      if (f) base.orders.push(f);
    }
    return base;
  }

  visit(ast, (node) => {
    if (node.type !== 'CallExpression') return;
    // query(ref, where(...), orderBy(...)) form
    if (isIdent(node.callee, 'query')) {
      const first = node.arguments[0];
      const ref = resolveCollection(first);
      if (!ref) {
        // query(collection(db,'x'), ...) where first is a call expression
        const maybe = first?.type === 'CallExpression' ? resolveCollection(first) : null;
        if (!maybe) return;
        const wheres = [], orders = [];
        for (const a of node.arguments.slice(1)) {
          if (a.type !== 'CallExpression') continue;
          const prop = a.callee?.property;
          const name = prop && (prop.name || prop.value);
          const f = a.arguments?.[0];
          const field = f?.type === 'Literal' && typeof f.value === 'string' ? f.value : null;
          if (!field) continue;
          if (name === 'where') wheres.push(field);
          else if (name === 'orderBy') orders.push(field);
        }
        if (wheres.length + orders.length) out.push({ file, collection: maybe, wheres, orders });
        return;
      }
      const wheres = [], orders = [];
      for (const a of node.arguments.slice(1)) {
        if (a.type !== 'CallExpression') continue;
        const prop = a.callee?.property;
        const name = prop && (prop.name || prop.value);
        const f = a.arguments?.[0];
        const field = f?.type === 'Literal' && typeof f.value === 'string' ? f.value : null;
        if (!field) continue;
        if (name === 'where') wheres.push(field);
        else if (name === 'orderBy') orders.push(field);
      }
      if (wheres.length + orders.length) out.push({ file, collection: ref, wheres, orders });
      return;
    }
    // Chained: collection(...).where(...).orderBy(...)
    const chain = chainOf(node);
    if (chain && (chain.wheres.length || chain.orders.length)) {
      out.push({ file, ...chain });
    }
  });
}

const ROOTS = [path.join(ROOT, 'src'), path.join(ROOT, 'functions')];
const files = ROOTS.flatMap(r => fs.existsSync(r) ? walk(r) : []);
const found = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = parse(src, f);
  if (!ast) { console.error('parse failed:', path.relative(ROOT, f)); continue; }
  findQueries(ast, path.relative(ROOT, f), found);
}

// Deduplicate the same chain being reported at each nesting level.
const uniq = new Map();
for (const q of found) {
  const fields = [...new Set([...q.wheres, ...q.orders])].filter(x => x !== '__name__');
  if (fields.length <= 1) continue;
  const key = `${q.file}|${q.collection}|${fields.sort().join(',')}`;
  uniq.set(key, q);
}

// Keep only maximal chains: a prefix of a longer chain in the same
// collection is not a distinct query.
const byCol = new Map();
for (const q of uniq.values()) {
  const key = `${q.file}|${q.collection}`;
  if (!byCol.has(key)) byCol.set(key, []);
  byCol.get(key).push(q);
}
const maximal = [];
for (const group of byCol.values()) {
  for (const q of group) {
    const fields = new Set([...q.wheres, ...q.orders].filter(x => x !== '__name__'));
    const isPrefix = group.some(o => {
      if (o === q) return false;
      const of_ = new Set([...o.wheres, ...o.orders].filter(x => x !== '__name__'));
      return fields.size < of_.size && [...fields].every(f => of_.has(f));
    });
    if (!isPrefix) maximal.push(q);
  }
}

const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8'));
const declared = new Map();
for (const i of idx.indexes) {
  if (!declared.has(i.collectionGroup)) declared.set(i.collectionGroup, []);
  declared.get(i.collectionGroup).push(new Set(i.fields.map(x => x.fieldPath)));
}

const missing = [];
for (const q of maximal) {
  const fields = new Set([...q.wheres, ...q.orders].filter(x => x !== '__name__'));
  const cands = declared.get(q.collection) || [];
  const ok = cands.some(c => fields.size <= c.size && [...fields].every(f => c.has(f)));
  if (!ok) missing.push(`${q.file} -> ${q.collection} [${[...fields].sort().join(', ')}]`);
}

console.log(`queries analyzed: ${uniq.size}`);
console.log('=== MISSING COMPOSITE INDEXES ===');
for (const m of [...new Set(missing)].sort()) console.log(m);
console.log(`\ntotal missing: ${new Set(missing).size}`);

/**
 * Dead-wiring guards (N076 / N087).
 *
 * Three "looks wired, is not" bug classes that shipped repeatedly:
 *
 *  1. A prop is destructured in a component signature but never referenced in
 *     the body — the caller passes real data that the component silently drops
 *     (`currentUser` on ImageCard/AudioCard, `tokens` on VideoCard, `theme` on
 *     ProfileAbout/ProfileViewAsBanner, `conversationId` on MessageInput).
 *  2. A module is imported by a component but never rendered — the import
 *     keeps the module "reachable" for the orphan guard while the UI never
 *     shows it (`GlassCard`/`GlassButton` in VideoAnalyticsScreen, `PageLoader`
 *     in three files, `RouteSkeletonShell`).
 *  3. A dead component module whose only importer never renders it is deleted
 *     outright rather than left as a no-op (`PageLoader`).
 *
 * The scan is deliberately conservative: it only reports a prop when the
 * identifier appears nowhere after the destructure, and only reports an import
 * when *every* importer imports it without ever referencing the binding. That
 * keeps it at zero false positives on the real tree while still failing on the
 * regressions above.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');
const EXTS = ['', '.jsx', '.js', '.cjs', '.mjs'];

const ALIASES = {
  '@': SRC,
  '@components': path.join(SRC, 'components'),
  '@screens': path.join(SRC, 'screens'),
  '@context': path.join(SRC, 'context'),
  '@lib': path.join(SRC, 'lib'),
  '@hooks': path.join(SRC, 'hooks'),
  '@data': path.join(SRC, 'data'),
  '@assets': path.join(SRC, 'assets'),
  '@app-firebase': path.join(SRC, 'firebase'),
  '@styles': path.join(SRC, 'styles'),
};

// Component modules whose only consumer is another module's *type-level* or
// side-effect use, not a render. Keep empty unless proven.
const IMPORT_ALLOWLIST = new Set();

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js|mjs|cjs)$/.test(entry.name)) out.push(path.normalize(full));
  }
  return out;
}

function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    base = path.normalize(path.join(path.dirname(fromFile), spec));
  } else {
    const alias = Object.keys(ALIASES)
      .sort((a, b) => b.length - a.length)
      .find((a) => spec === a || spec.startsWith(`${a}/`));
    if (!alias) return null;
    base = path.normalize(path.join(ALIASES[alias], spec.slice(alias.length).replace(/^\//, '')));
  }
  for (const ext of EXTS) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
  }
  for (const ext of EXTS) {
    const idx = path.join(base, `index${ext}`);
    if (fs.existsSync(idx) && fs.statSync(idx).isFile()) return idx;
  }
  return null;
}

const IMPORT_RE = /^\s*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;

function isIdentifier(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

function identifiersInClause(clause) {
  const names = [];
  const def = clause.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/);
  if (def) names.push(def[1]);
  const ns = clause.match(/\*\s*as\s+([A-Za-z_$][\w$]*)/);
  if (ns) names.push(ns[1]);
  const braces = clause.match(/\{([^}]*)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.push((as[1] || as[0]).trim());
    }
  }
  return names.filter(isIdentifier);
}

function referencesOutside(name, source, cutStart, cutEnd) {
  const rest = source.slice(0, cutStart) + source.slice(cutEnd);
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(rest);
}

describe('dead-wiring guard: destructured props are used', () => {
  test('no component destructures a prop it never references', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      const re = /\(\s*\{([^}]{3,600})\}\s*\)\s*=>/g;
      let match;
      while ((match = re.exec(source))) {
        for (const item of match[1].split(',')) {
          const trimmed = item.trim();
          if (!trimmed) continue;
          const aliased = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/);
          const plain = trimmed.match(/^([A-Za-z_$][\w$]*)/);
          const propName = aliased ? aliased[1] : plain && plain[1];
          if (!propName) continue;
          const checkName = aliased ? aliased[2] : propName;
          if (!referencesOutside(checkName, source, match.index, match.index + match[0].length)) {
            violations.push(`${path.relative(root, file)}: prop "${propName}" destructured but never used`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('dead-wiring guard: imported bindings are rendered', () => {
  test('no module is imported by every importer without being referenced', () => {
    const importers = new Map();
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = IMPORT_RE.exec(source))) {
        const clause = match[1];
        const target = resolve(match[2], file);
        if (!target || !target.startsWith(SRC)) continue;
        for (const name of identifiersInClause(clause)) {
          const used = referencesOutside(name, source, match.index, match.index + match[0].length);
          if (!importers.has(target)) importers.set(target, []);
          importers.get(target).push({ importer: file, name, used });
        }
      }
    }

    const violations = [];
    for (const [target, entries] of importers) {
      const rel = path.relative(root, target);
      if (IMPORT_ALLOWLIST.has(rel)) continue;
      if (entries.length > 0 && entries.every((e) => !e.used)) {
        const where = [...new Set(entries.map((e) => `${path.relative(root, e.importer)}#${e.name}`))];
        violations.push(`${rel} imported but never referenced: ${where.join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('the deleted dead loaders stay deleted', () => {
    expect(fs.existsSync(path.join(SRC, 'components/UI/PageLoader.jsx'))).toBe(false);
    const routeProgress = fs.readFileSync(
      path.join(SRC, 'components/Navigation/RouteProgressBar.jsx'),
      'utf8'
    );
    expect(routeProgress).not.toContain('RouteSkeletonShell');
  });
});

describe('dead-wiring guard: import bindings are referenced', () => {
  // `no-unused-vars` catches this in ESLint, but the `lint` CI job is advisory
  // (continue-on-error), so 800+ dead import bindings accumulated unnoticed
  // until the config was made JSX-aware. This makes the class hard-failing: a
  // binding named in an import statement must appear somewhere else in the file.
  test('no import binding is unused', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      IMPORT_RE.lastIndex = 0;
      let match;
      while ((match = IMPORT_RE.exec(source))) {
        for (const name of identifiersInClause(match[1])) {
          if (!referencesOutside(name, source, match.index, match.index + match[0].length)) {
            violations.push(`${path.relative(root, file)}: import binding "${name}" is never referenced`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('dead-wiring guard: mutation handlers are actually invoked', () => {
  // A handler that performs a real service mutation but is never referenced is
  // dead code — and when the UI shows a success toast in its place, the feature
  // is a lie. `SponsoredPostCard.handleReportAd` called `reportAd()` but was
  // never wired; the "Report ad" button just toasted success. The scan is
  // conservative: only a `const NAME = (...) => { ... }` whose body contains a
  // service mutation call, and where NAME occurs exactly once in the file.
  const MUTATION_CALL =
    /(?:get[A-Za-z]+Service|userService|svc|service|this)\s*\.\s*(?:report|save|send|submit|delete|update|create|follow|unfollow|like|unlike|purchase|withdraw|claim|block|mute|share|publish|export|hide)[A-Za-z]*\s*\(/;

  test('no mutation handler is defined without being invoked', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
      let match;
      while ((match = re.exec(source))) {
        const name = match[1];
        const open = source.indexOf('{', match.index + match[0].length - 1);
        let depth = 0;
        let end = open;
        for (; end < source.length; end++) {
          if (source[end] === '{') depth++;
          else if (source[end] === '}') {
            depth--;
            if (depth === 0) { end++; break; }
          }
        }
        const body = source.slice(open, end);
        if (!MUTATION_CALL.test(body)) continue;
        const occurrences = (source.match(new RegExp(`(?<![\\w$])${name}(?![\\w$])`, 'g')) || []).length;
        if (occurrences <= 1) {
          violations.push(`${path.relative(root, file)}: "${name}" mutates via a service but is never invoked`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

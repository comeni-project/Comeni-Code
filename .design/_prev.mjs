// Render a .dc.html artboard to a standalone HTML file and screenshot it.
//
// Labs' .design/_prev.py strips the logic script and shoots the markup, which is fine for a
// static artboard and useless for one whose content comes out of renderVals(). This runs the
// component: it evaluates the class, calls renderVals(), then expands <sc-for>, <sc-if> and
// {{holes}} the way the real runtime would.
//
//   node _prev.mjs Main NodeRead                 # default state
//   node _prev.mjs Main --state '{"level":2}'    # drive the component
//
// Screenshots land in the scratchpad path below, one PNG per artboard per state.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = process.env.PREV_OUT
  || '/tmp/claude-1000/-home-rafael-Documents-GitHub-Comeni-Labs--claude-worktrees-plan-4-phase-0/'
     + '7b8cb1a9-565b-41c3-b85b-7c801bcb6409/scratchpad/prev';
fs.mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const names = [];
let state = {}, tag = '', width = 0;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--state') { state = JSON.parse(argv[++i]); tag = '-' + Object.values(state).join('-'); }
  else if (argv[i] === '--w') { width = Number(argv[++i]); }
  else names.push(argv[i]);
}
if (!names.length) names.push('Main');

class DCLogic {
  constructor() { this.props = {}; this.state = {}; }
  setState(o) { Object.assign(this.state, o); }
  forceUpdate() {}
}

const get = (scope, key) =>
  key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);

function expand(html, scope) {
  // <sc-if value="{{cond}}">...</sc-if>  — innermost first
  let prev;
  do {
    prev = html;
    html = html.replace(
      /<sc-if\s+value="\{\{\s*([\w.$]+)\s*\}\}"[^>]*>((?:(?!<sc-if)[\s\S])*?)<\/sc-if>/g,
      (m, k, inner) => (get(scope, k) ? inner : '')
    );
  } while (html !== prev);
  // {{holes}} — a dotted lookup, exactly like the real runtime
  return html.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, k) => {
    const v = get(scope, k);
    return v === undefined ? '' : String(v);
  });
}

for (const name of names) {
  const file = `${name}.dc.html`;
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); continue; }
  let html = fs.readFileSync(file, 'utf8');

  // run the component, if it has one
  let vals = {};
  const m = html.match(/<script data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (m) {
    const Component = new Function('DCLogic', `${m[1]}\n; return Component;`)(DCLogic);
    const inst = new Component();
    Object.assign(inst.state, state);
    vals = inst.renderVals ? inst.renderVals() : {};
  }

  // strip the runtime scaffolding
  html = html
    .replace(/<script src="\.\/support\.js"><\/script>/, '')
    .replace(/<script data-dc-script[\s\S]*?<\/script>/, '')
    .replace(/<\/?x-dc>/g, '')
    .replace(/<\/?helmet>/g, '');

  // <sc-for list="{{xs}}" as="x">...</sc-for>
  html = html.replace(
    /<sc-for\s+list="\{\{\s*(\w+)\s*\}\}"\s+as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g,
    (mm, listName, asName, inner) => {
      const arr = vals[listName] || [];
      return arr
        .map((item, i) => expand(inner, { ...vals, [asName]: item, $index: i }))
        .join('');
    }
  );
  html = expand(html, vals);

  const outHtml = path.join(OUT, `${name}${tag}.html`);
  fs.writeFileSync(outHtml, html);

  const hm = html.match(/min-height:(\d+)px/);
  const h = hm ? Number(hm[1]) : 1200;
  const wm = html.match(/"\$preview":\{"width":(\d+)/);
  const w = width || (wm ? Number(wm[1]) : 1440);

  execFileSync('google-chrome-stable', [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=3000', `--window-size=${w},${h}`,
    `--screenshot=${path.join(OUT, `${name}${tag}.png`)}`, `file://${outHtml}`
  ], { stdio: 'pipe' });

  console.log(`shot ${name}${tag}  ${w}x${h}`);
}

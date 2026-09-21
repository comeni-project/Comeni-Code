// Builds the Comeni Code page artboards (hybrid identity) into this folder.
// Specs: docs/superpowers/specs/2026-09-16-comeni-code-weaving-and-pages-design.md (pages)
//        docs/superpowers/specs/2026-09-17-code-as-tutor-design.md (resources, step back, scores, skeletons)
//   node .design/build_pages.mjs
import { writeFileSync } from 'node:fs';
import { T, head, foot, logo, chip, primary, secondary, panel, label, seg, gridBg, labs, code, MONO, UI } from './_identity.mjs';

const D = new URL('.', import.meta.url).pathname;
const c = T.light;

// ── small shared pieces ─────────────────────────────────────────
const page = (w, h, inner) => `${head(c)}
<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;background:${c.bg};color:${c.ink};font-family:${UI};overflow:hidden">
${inner}
</div>
${foot}`;
const ic = {
  search: `<svg width="15" height="15" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" style="fill:none;stroke:currentColor;stroke-width:1.6"></circle><path d="M11 11l3.5 3.5" style="stroke:currentColor;stroke-width:1.6;stroke-linecap:round"></path></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" style="stroke:currentColor;stroke-width:1.8;stroke-linecap:round"></path></svg>`,
  check: (col) => `<svg width="15" height="15" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" style="fill:none;stroke:${col};stroke-width:2;stroke-linecap:round;stroke-linejoin:round"></path></svg>`,
  arrow: `<svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"></path></svg>`,
  person: `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="6" r="3" style="fill:none;stroke:currentColor;stroke-width:1.6"></circle><path d="M2.5 14c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round"></path></svg>`,
  lock: `<svg width="14" height="14" viewBox="0 0 16 16"><rect x="3" y="7" width="10" height="7" rx="2" style="fill:none;stroke:currentColor;stroke-width:1.6"></rect><path d="M5.5 7V5a2.5 2.5 0 015 0v2" style="fill:none;stroke:currentColor;stroke-width:1.6"></path></svg>`,
  chevron: `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round"></path></svg>`,
};
const mono = (s, extra = '') => `<span style="font-family:${MONO};${extra}">${s}</span>`;
const h1 = (s, size = 30) => `<h1 style="margin:0;font-size:${size}px;font-weight:600;letter-spacing:-.02em;line-height:1.15;text-wrap:balance">${s}</h1>`;
const p = (s, extra = '') => `<p style="margin:0;font-size:15px;line-height:1.65;color:${c.ink2};max-width:66ch;${extra}">${s}</p>`;
const amberTag = (s = 'Not yet reviewed') => `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:${c.measSoft};color:${c.meas};font-size:11.5px;font-weight:600;white-space:nowrap">${s}</span>`;
const blueTag = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:${c.selSoft};color:${c.sel};font-size:11.5px;font-weight:600;white-space:nowrap">${s}</span>`;
const greyTag = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;border:1px solid ${c.border2};color:${c.ink2};font-size:11.5px;font-weight:500;white-space:nowrap">${s}</span>`;
const redTag = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:${c.openSoft};color:${c.open};font-size:11.5px;font-weight:600;white-space:nowrap">${s}</span>`;
const greenTag = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;background:${c.lineSoft};color:${c.btn};font-size:11.5px;font-weight:600;white-space:nowrap">${s}</span>`;
const dot = (st) => {
  const m = { settled: [c.settled, c.settled], stale: [c.measBar, c.measSoft], next: [c.sel, c.selSoft], open: [c.ink3, c.surface], missing: [c.ink3, c.surface] }[st];
  return `<span style="width:11px;height:11px;border-radius:50%;flex:none;background:${m[1]};border:2px ${st === 'missing' ? 'dashed' : 'solid'} ${m[0]}"></span>`;
};
// A level describes a node's content, never the learner, and spends no colour (tutor spec T10.1).
const levelTag = (s) => `<span style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;border:1px solid ${c.border2};color:${c.ink2};font-size:11.5px;font-weight:500;white-space:nowrap"><svg width="12" height="10" viewBox="0 0 12 10"><rect x="0" y="6" width="2.4" height="4" rx="0.6" style="fill:currentColor"></rect><rect x="3.2" y="4" width="2.4" height="6" rx="0.6" style="fill:currentColor"></rect><rect x="6.4" y="2" width="2.4" height="8" rx="0.6" style="fill:currentColor;opacity:.35"></rect><rect x="9.6" y="0" width="2.4" height="10" rx="0.6" style="fill:currentColor;opacity:.35"></rect></svg>${s}</span>`;
const card = (inner, extra = '') => `<div style="${panel(c)};padding:18px 20px;display:flex;flex-direction:column;gap:10px;${extra}">${inner}</div>`;

const avatar = `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;border-radius:999px;border:1px solid ${c.border};background:${c.surface};color:${c.ink2}">
  <span style="width:26px;height:26px;border-radius:50%;background:${c.selSoft};color:${c.sel};display:flex;align-items:center;justify-content:center">${ic.person}</span>${ic.chevron}</span>`;
const learnBar = (q = '') => `<header style="height:60px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 28px;border-bottom:1px solid ${c.border};background:${c.bg}">
  ${logo(c, 'Comeni Code')}
  <div style="display:flex;align-items:center;gap:10px;width:460px;height:38px;padding:0 14px;border-radius:10px;border:1px solid ${c.border2};background:${c.surface};color:${c.ink3};font-size:14px">
    ${ic.search}<span>${q || 'Search topics, tools and goals'}</span><span style="margin-left:auto;font-family:${MONO};font-size:11px;padding:1px 6px;border:1px solid ${c.border};border-radius:5px">/</span></div>
  ${avatar}
</header>`;
const focusBar = (left, centerHtml, right) => `<header style="height:60px;flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 24px;border-bottom:1px solid ${c.border};background:${c.surface}">
  <div style="display:flex;align-items:center;gap:12px;color:${c.ink2};font-size:14px"><span style="width:34px;height:34px;border-radius:9px;border:1px solid ${c.border};display:flex;align-items:center;justify-content:center">${ic.close}</span>${left}</div>
  <div>${centerHtml}</div>
  <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px">${right}</div>
</header>`;
const progress = (done, cur, total) => `<div style="display:flex;align-items:center;gap:4px">${Array.from({ length: total }, (_, i) => `<span style="width:30px;height:6px;border-radius:3px;background:${i < done ? c.line : i === cur ? c.ink : c.border2}"></span>`).join('')}<span style="font-family:${MONO};font-size:12px;color:${c.ink3};margin-left:10px">${cur + 1} / ${total}</span></div>`;

// ── the network (transit view of every woven track) ─────────────
const TY = 250, TX = (i) => 60 + 100 * i;
const ROUTE = [
  ['DNA and genes', 15, 'settled', 'thr'], ['Gene expression', 10, 'stale'], ['RNA-seq experiments', 12, 'settled'], ['Sequencing reads', 12, 'settled', 'thr'],
  ['FASTQ on disk', 15, 'settled', 'inter'], ['Reference transcriptome', 10, 'next'], ['k-mers', 10, 'next'], ['de Bruijn graphs', 12, 'open', 'inter'],
  ['Sequence alignment', 15, 'open', 'inter'], ['Selective alignment', 15, 'missing'], ['Expectation–maximisation', 20, 'open', 'thr'], ['Salmon', 25, 'open', 'goal'],
];
const OTHERS = [
  { name: 'Learn STAR', d: `M460 250 L540 330 H1170 M860 330 V250`, stops: [[620, 330, 'Reference genome'], [720, 330, 'Coordinates'], [1000, 330, 'Splice-aware alignment'], [1130, 330, 'STAR']], lx: 1190, ly: 334 },
  { name: 'Call variants', d: `M860 250 L940 170 H1170`, stops: [[1010, 170, 'Pileups'], [1130, 170, 'Calling variants']], lx: 1190, ly: 174 },
  { name: 'Assemble a genome', d: `M760 250 L900 110 H1170`, stops: [[1010, 110, 'Contigs'], [1130, 110, 'Assemble a genome']], lx: 1190, ly: 114 },
];
const ZONES = [['Biology', 0, 230], ['Sequencing', 230, 590], ['Algorithms', 590, 910], ['Quantification', 910, 1330]];
function network({ sel = null, edit = false, showOthers = true, detail = 2 } = {}) {
  const txt = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" style="font-family:${o.mono ? MONO : UI};font-size:${o.size || 11.5}px;font-weight:${o.w || 500};fill:${o.fill || c.ink}">${s}</text>`;
  const stop = (x, y, st, kind, small) => {
    const r = kind === 'thr' || kind === 'goal' ? 10 : kind === 'inter' ? 8.5 : small ? 5 : 6.5;
    if (st === 'missing') return `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${c.surface};stroke:${c.ink3};stroke-width:2;stroke-dasharray:3 3"></circle>`;
    const fill = st === 'settled' ? c.settled : st === 'stale' ? c.measSoft : st === 'next' ? c.selSoft : c.surface;
    const stroke = st === 'stale' ? c.measBar : st === 'next' ? c.sel : st === 'settled' ? (kind === 'inter' || kind === 'thr' ? c.ink : c.settled) : (kind === 'inter' || kind === 'thr' || kind === 'goal' ? c.ink : c.ink3);
    const sw = kind === 'thr' || kind === 'goal' ? 3.5 : kind === 'inter' ? 2.5 : 2;
    let s = `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${fill};stroke:${stroke};stroke-width:${sw}"></circle>`;
    if (kind === 'thr') s += `<circle cx="${x}" cy="${y}" r="3" style="fill:${st === 'settled' ? c.surface : c.ink}"></circle>`;
    if (kind === 'goal') s += `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" style="fill:${c.line}"></rect>`;
    if (st === 'next') s += `<circle cx="${x}" cy="${y}" r="2.6" style="fill:${c.sel}"></circle>`;
    return s;
  };
  let out = `<svg viewBox="0 0 1330 400" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block">`;
  ZONES.forEach(([n, a, b], i) => {
    if (i % 2 === 0) out += `<rect x="${a}" y="0" width="${b - a}" height="400" style="fill:${c.grid2}"></rect>`;
    if (a > 0) out += `<line x1="${a}" y1="14" x2="${a}" y2="390" style="stroke:${c.border2};stroke-width:1;stroke-dasharray:2 4"></line>`;
    out += txt(a + 12, 34, n.toUpperCase(), { a: 'start', size: 10, w: 600, fill: c.ink3, mono: true });
  });
  if (showOthers) OTHERS.forEach(o => {
    out += `<path d="${o.d}" style="fill:none;stroke:${c.rail};stroke-width:4;stroke-linecap:round;stroke-linejoin:round"></path>`;
    o.stops.forEach(([x, y, n], i) => {
      out += stop(x, y, 'open', 'stop');
      if (detail >= 2) out += txt(x, y + (y > TY ? 24 : -14), n, { size: 11, fill: c.ink2, w: 400 });
    });
    out += txt(o.lx, o.ly, o.name, { a: 'start', size: 12, w: 600, fill: c.ink2 });
  });
  out += `<line x1="${TX(0)}" y1="${TY}" x2="${TX(11)}" y2="${TY}" style="stroke:${c.line};stroke-width:7;stroke-linecap:round"></line>`;
  out += txt(1190, TY + 4, 'Learn Salmon', { a: 'start', size: 12.5, w: 700, fill: c.btn });
  ROUTE.forEach(([n, t, st, kind], i) => {
    const x = TX(i);
    out += stop(x, TY, st, kind);
    if (sel === i) out += `<circle cx="${x}" cy="${TY}" r="17" style="fill:none;stroke:${c.sel};stroke-width:1.5;stroke-dasharray:3 3"></circle>`;
    const above = i % 2 === 0;
    const anchor = i === 8 ? 'end' : 'middle';
    const lx = i === 8 ? x - 4 : x;
    const tm = st === 'missing' ? 'not written yet' : st === 'stale' ? 'review due' : st === 'next' ? `${t} min · ready` : `${t} min`;
    const tcol = st === 'stale' ? c.meas : st === 'next' ? c.sel : c.ink3;
    const bold = kind === 'thr' || kind === 'goal' ? 700 : 500;
    if (above) { out += txt(lx, TY - 34, n, { a: anchor, w: bold }); out += txt(lx, TY - 20, tm, { a: anchor, size: 10, mono: true, fill: tcol }); }
    else { out += txt(lx, TY + 32, n, { a: anchor, w: bold }); out += txt(lx, TY + 46, tm, { a: anchor, size: 10, mono: true, fill: tcol }); }
  });
  if (edit) {
    out += `<circle cx="1260" cy="370" r="6.5" style="fill:${c.surface};stroke:${c.open};stroke-width:2"></circle>`;
    out += txt(1250, 374, 'Phylogenetic trees · orphan', { a: 'end', size: 11, fill: c.open });
  }
  return out + '</svg>';
}

// ── L1 Start ────────────────────────────────────────────────────
function start() {
  const ex = ['Salmon', 'Why my reads don’t map', 'Differential expression', 'de Bruijn graphs', 'Call variants'];
  return page(1440, 1300, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;align-items:center;gap:26px;padding:48px 28px">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
      ${h1('What do you want to learn?', 40)}
      ${p('Name a tool, a topic or a problem. We build a route from pages that already exist — every stop says why it’s there.', 'text-align:center;max-width:56ch')}
    </div>
    <div style="width:760px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;height:58px;padding:0 10px 0 20px;border-radius:14px;border:2px solid ${c.ink};background:${c.surface};font-size:19px">
        <span>salmon</span><span style="width:2px;height:24px;background:${c.ink};margin-left:-8px"></span>
        <span style="margin-left:auto">${primary(c, 'Build my route', '')}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">${ex.map(e => `<span style="padding:5px 12px;border-radius:999px;border:1px solid ${c.border2};background:${c.surface};font-size:13px;color:${c.ink2}">${e}</span>`).join('')}</div>
    </div>

    <div style="width:1240px;${panel(c)};padding:22px 26px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;flex-direction:column;gap:10px">
        <span style="${label(c)}">1 · Is this what you mean?</span>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;border:2px solid ${c.sel};background:${c.selSoft}">
          <span style="width:20px;height:20px;border-radius:5px;background:${c.sel};display:flex;align-items:center;justify-content:center">${ic.check('#FFFFFF')}</span>
          <div style="display:flex;flex-direction:column"><span style="font-size:15px;font-weight:600">${mono('Salmon')}</span><span style="font-size:13px;color:${c.ink2}">A tool that estimates how much each transcript is expressed, from RNA-seq reads.</span></div>
          <span style="margin-left:auto;font-size:12px;color:${c.ink3}">Suggested from your words · you decide</span>
        </div>
        <a style="font-size:13px;font-weight:500">+ Add another target (up to 3) — e.g. “Differential expression”</a>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;padding-top:16px;border-top:1px solid ${c.border}">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="${label(c)}">2 · Your route</span>
          <span style="font-size:12.5px;color:${c.ink3}">Built by following what each page needs, back from Salmon · columns can be done in any order</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:22px">
          <span style="font-size:26px;font-weight:600;letter-spacing:-.02em">13 nodes</span>
          <span style="font-size:15px;color:${c.ink2}">about 3 h 10 min</span>
          ${levelTag('First steps → Advanced')}
          ${greyTag('1 not written yet — requested, you can follow it')}
        </div>
        <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:10px;padding:8px 12px">${routeMetro({ sel: null, fresh: true })}</div>
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;background:${c.bg}">
          <div style="display:flex;flex-direction:column;gap:2px;flex:1">
            <span style="font-size:14px;font-weight:600">You probably know some of this already</span>
            <span style="font-size:13px;color:${c.ink2}">A 4-minute placement asks one question per node and drops what you know. It usually removes 2–4 nodes.</span>
          </div>
          ${secondary(c, 'Start from the beginning')}
          ${primary(c, 'Place me first', '')}
        </div>
      </div>
    </div>
    <span style="font-size:13px;color:${c.ink3}">Just looking? <a style="font-weight:500">Explore existing tracks</a></span>
  </main>`);
}

// ── figure: k-mer / de Bruijn graph ─────────────────────────────
function kmerFigure(scale = 1) {
  const k = ['ACG', 'CGT', 'GTT', 'TTA', 'TAG'];
  const box = (x, y, s, o = {}) => `<rect x="${x}" y="${y}" width="76" height="34" rx="7" style="fill:${o.fill || c.surface};stroke:${o.stroke || c.ink2};stroke-width:${o.sw || 1.5}"></rect><text x="${x + 38}" y="${y + 22}" text-anchor="middle" style="font-family:${MONO};font-size:15px;font-weight:500;fill:${c.ink}">${s}</text>`;
  const arr = (x1, y1, x2, y2, col) => `<path d="M${x1} ${y1} H${x2 - 6}" style="stroke:${col};stroke-width:2"></path><path d="M${x2 - 8} ${y1 - 5} L${x2} ${y1} L${x2 - 8} ${y1 + 5}" style="fill:none;stroke:${col};stroke-width:2;stroke-linejoin:round"></path>`;
  let s = `<svg viewBox="0 0 700 230" width="100%" style="display:block">`;
  s += `<text x="0" y="22" style="font-family:${MONO};font-size:11px;fill:${c.ink3}">reads</text>`;
  ['ACGTT', 'CGTTA', 'GTTAG'].forEach((r, i) => { s += `<text x="${90 + i * 110}" y="22" style="font-family:${MONO};font-size:14px;fill:${c.ink2}">${r}</text>`; });
  s += `<text x="450" y="22" style="font-family:${MONO};font-size:11px;fill:${c.ink3}">k = 3</text>`;
  k.forEach((m, i) => {
    const x = 20 + i * 136;
    s += box(x, 60, m, { fill: c.lineSoft, stroke: c.line, sw: 2 });
    if (i < 4) s += arr(x + 76, 77, x + 136, 77, c.line);
  });
  s += `<path d="M194 94 V140 H250" style="fill:none;stroke:${c.rail};stroke-width:2;stroke-dasharray:4 4"></path>`;
  s += box(250, 124, 'GTC');
  s += `<text x="336" y="146" style="font-family:${UI};font-size:12px;fill:${c.ink3}">from another read · a branch</text>`;
  s += `<line x1="20" y1="186" x2="680" y2="186" style="stroke:${c.border};stroke-width:1"></line>`;
  s += `<text x="0" y="214" style="font-family:${MONO};font-size:11px;fill:${c.ink3}">path spells</text>`;
  s += `<text x="110" y="216" style="font-family:${MONO};font-size:19px;font-weight:500;letter-spacing:6px;fill:${c.ink}">?  ?  ?  ?  ?  ?  ?</text>`;
  return s + '</svg>';
}

// ── the route as a metro map: lines split from the start and merge into the goal ──
const MX = [60, 280, 500, 720, 940, 1160];
const MS = {
  cells: ['Living things carry instructions', -110, 290, 'settled', 10, 'mid'],
  dna: ['DNA and genes', MX[0], 290, 'settled', 15, 'mid', 'inter'],
  expr: ['Gene expression', MX[1], 150, 'stale', 10, 'top'],
  reads: ['Sequencing reads', MX[1], 290, 'settled', 12, 'mid', 'inter'],
  kmers: ['k-mers', MX[1], 430, 'ready', 10, 'bot', 'inter'],
  rnaseq: ['RNA-seq experiments', MX[2], 150, 'settled', 12, 'top', 'inter'],
  fastq: ['FASTQ on disk', MX[2], 290, 'settled', 15, 'mid'],
  dbg: ['de Bruijn graphs', MX[2], 430, 'ahead', 12, 'bot', 'thr'],
  reftx: ['Reference transcriptome', MX[3], 80, 'current', 10, 'top'],
  em: ['Expectation–maximisation', MX[3], 150, 'ready', 20, 'top'],
  align: ['Sequence alignment', MX[3], 290, 'ready', 15, 'mid'],
  selal: ['Selective alignment', MX[4], 290, 'missing', 15, 'mid', 'inter'],
  salmon: ['Salmon', MX[5], 290, 'goal', 25, 'goal'],
};
const MLINES = [
  // main lines (thick)
  ['M-110 290 H1160', 0, 'M940 290 H1160'],
  ['M60 290 H140 L280 150 H720 H1020 L1160 290', 0],
  ['M560 150 L630 80 H950 L1020 150', 0],
  ['M60 290 H140 L280 430 H1020 L1160 290', 0],
];
const MLINKS = [
  // thin connectors: a need that isn't along a line
  ['M280 290 H360 L500 150'],
  ['M360 290 L500 430'],
  ['M280 430 H340 L410 500 H730 L940 290', 1],
];
function routeMetro({ sel = 'reftx', fresh = false, h = 530 } = {}) {
  const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" style="font-family:${o.mono ? MONO : UI};font-size:${o.size || 12}px;font-weight:${o.w || 500};fill:${o.fill || c.ink}">${s}</text>`;
  let s = `<svg viewBox="-240 0 1560 ${h}" width="100%" style="display:block">`;
  MLINES.forEach(([d, , dashed]) => {
    s += `<path d="${d}" style="fill:none;stroke:${c.line};stroke-width:7;stroke-linecap:round;stroke-linejoin:round"></path>`;
    if (dashed) s += `<path d="${dashed}" style="fill:none;stroke:${c.surface};stroke-width:3;stroke-dasharray:6 6"></path>`;
  });
  MLINKS.forEach(([d, dashed]) => {
    s += `<path d="${d}" style="fill:none;stroke:${c.surface};stroke-width:7;stroke-linejoin:round"></path>`;
    s += `<path d="${d}" style="fill:none;stroke:${c.line};stroke-width:2.5;stroke-linejoin:round;${dashed ? 'stroke-dasharray:6 5;' : ''}"></path>`;
  });
  Object.entries(MS).forEach(([k, [n, x, y, st0, t, lane, kind]]) => {
    const st = fresh && st0 !== 'goal' && st0 !== 'missing' ? 'open' : st0;
    const big = kind === 'inter' || kind === 'thr';
    const r = st === 'goal' ? 13 : st === 'current' ? 10 : big ? 9 : 7;
    if (k === sel && !fresh) s += `<circle cx="${x}" cy="${y}" r="${r + 8}" style="fill:none;stroke:${c.sel};stroke-width:1.5;stroke-dasharray:3 3"></circle>`;
    const f = { settled: c.settled, stale: c.measSoft, ready: c.selSoft, current: c.selSoft, ahead: c.surface, open: c.surface, missing: c.surface, goal: c.surface }[st];
    const k2 = { settled: big ? c.ink : c.settled, stale: c.measBar, ready: c.sel, current: c.sel, ahead: big ? c.ink : c.ink3, open: big ? c.ink : c.ink3, missing: c.ink3, goal: c.ink }[st];
    const sw = st === 'goal' || kind === 'thr' ? 3.5 : st === 'current' ? 3 : big ? 2.5 : 2;
    s += `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${f};stroke:${k2};stroke-width:${sw};${st === 'missing' ? 'stroke-dasharray:3 3' : ''}"></circle>`;
    if (st === 'goal') s += `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" style="fill:${c.line}"></rect>`;
    else if (kind === 'thr') s += `<circle cx="${x}" cy="${y}" r="3" style="fill:${c.ink}"></circle>`;
    else if (st === 'ready' || st === 'current') s += `<circle cx="${x}" cy="${y}" r="3" style="fill:${c.sel}"></circle>`;
    const meta = st === 'open' ? `${t} min` : { settled: 'settled', stale: 'review due', ready: `ready · ${t} min`, current: 'in progress · 2 of 5', ahead: `${t} min`, missing: 'not written yet', goal: 'your goal' }[st];
    const mc = { stale: c.meas, ready: c.sel, current: c.sel, goal: c.btn }[st] || c.ink3;
    const bold = st === 'goal' || kind === 'thr' || st === 'current' ? 700 : 500;
    if (lane === 'goal') { s += T(x + 24, y - 2, n, { a: 'start', size: 17, w: 700, mono: true }); s += T(x + 24, y + 16, meta, { a: 'start', size: 11, fill: mc }); }
    else if (lane === 'bot') { s += T(x, y + 30, n, { w: bold, fill: st === 'missing' ? c.ink3 : c.ink }); s += T(x, y + 45, meta, { size: 10.5, mono: true, fill: mc }); }
    else { const o = lane === 'mid' ? 0 : 0; s += T(x, y - 34 + o, n, { w: bold, fill: st === 'missing' ? c.ink3 : c.ink }); s += T(x, y - 19 + o, meta, { size: 10.5, mono: true, fill: mc }); }
  });
  return s + '</svg>';
}
const routeLegend = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;font-size:12px;color:${c.ink2}">
  <span>Every line ends at your goal. Thin lines are extra needs. Stops at the same distance can be done in any order.</span>
  <span style="display:flex;align-items:center;gap:6px">${dot('settled')}Settled</span><span style="display:flex;align-items:center;gap:6px">${dot('stale')}Review due</span>
  <span style="display:flex;align-items:center;gap:6px">${dot('next')}Ready</span><span style="display:flex;align-items:center;gap:6px">${dot('missing')}Not written yet</span>
  <span style="display:flex;align-items:center;gap:6px"><svg width="20" height="20"><circle cx="10" cy="10" r="7" style="fill:${c.surface};stroke:${c.ink};stroke-width:2.5"></circle></svg>Where lines meet</span></div>`;

// ── L3 Home ─────────────────────────────────────────────────────
function home() {
  const ready = (n, meta, st = 'next') => `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid ${c.border}">${dot(st)}<div style="display:flex;flex-direction:column;flex:1"><span style="font-size:14px;font-weight:500">${n}</span><span style="font-size:12px;color:${st === 'stale' ? c.meas : c.sel}">${meta}</span></div></div>`;
  const routeRow = (n, a, b, meta, on) => `<div style="display:flex;flex-direction:column;gap:6px;padding:9px 0;border-top:1px solid ${c.border}">
      <div style="display:flex;justify-content:space-between"><span style="font-size:14px;font-weight:600">${n}</span>${on ? greyTag('Shown above') : `<a style="font-size:13px;font-weight:500">Show</a>`}</div>
      <div style="display:flex;gap:3px">${Array.from({ length: b }, (_, i) => `<span style="flex:1;height:5px;border-radius:2px;background:${i < a ? c.line : c.border2}"></span>`).join('')}</div>
      <span style="font-size:12px;color:${c.ink3}">${meta}</span></div>`;
  return page(1440, 1120, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;gap:18px;padding:24px 28px 28px;min-height:0">
    <div style="${panel(c)};padding:20px 26px;display:flex;align-items:center;gap:28px">
      <div style="display:flex;flex-direction:column;gap:6px;flex:1">
        <span style="${label(c)}">Continue where you left off</span>
        ${h1('Reference transcriptome', 28)}
        <span style="font-size:13.5px;color:${c.ink2}">Learn Salmon · 2 of 5 questions answered on this page · about 6 min left</span>
      </div>
      ${primary(c, 'Continue', ic.arrow)}
    </div>

    <section style="${panel(c)};display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:1px solid ${c.border}">
        <div style="display:flex;align-items:baseline;gap:14px"><span style="font-size:17px;font-weight:600">Learn Salmon</span><span style="font-size:13px;color:${c.ink2}">6 of 13 settled · 4 ready now · about 2 h 20 min left</span></div>
        <div style="display:flex;align-items:center;gap:14px"><a style="font-size:13px;font-weight:500">Switch route ▾</a>${secondary(c, 'Open route')}</div>
      </div>
      <div style="padding:10px 22px 4px">${routeMetro()}</div>
      <div style="padding:6px 22px 14px">${routeLegend}</div>
    </section>

    <div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:18px">
      ${card(`<span style="font-size:15px;font-weight:600">Ready for you</span>${ready('k-mers', '10 min · Learn Salmon')}${ready('Sequence alignment', '15 min · Learn Salmon')}${ready('Gene expression', 'Quick review due', 'stale')}`)}
      ${card(`<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:600">Review</span>${secondary(c, 'Start')}</div>
        <span style="font-size:13.5px;color:${c.ink2};line-height:1.5">8 questions from pages you’ve read · about 6 min. Tomorrow’s set is picked for you; nothing piles up.</span>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid ${c.border}"><span style="font-size:13px;color:${c.ink2}">Or test yourself on a route</span><a style="font-size:13px;font-weight:600">Test yourself</a></div>`)}
      ${card(`<div style="display:flex;justify-content:space-between;align-items:center"><span style="${label(c)}">Weekly problem · 16 Sep</span><span style="font-size:12px;color:${c.ink3}">solved by 38%</span></div>
        <span style="font-size:15.5px;font-weight:600">Count the reads on one gene</span>
        <span style="font-size:13px;color:${c.ink2}">Needs 3 nodes · you hold 2. Open forever, nobody is ranked.</span>`)}
      ${card(`<span style="font-size:15px;font-weight:600">Your routes</span>
        ${routeRow('Learn Salmon', 6, 13, '6 of 13 · last opened today', true)}
        ${routeRow('Learn STAR', 5, 11, 'You already hold 5 of 11')}
        <div style="display:flex;justify-content:space-between;padding-top:4px"><a style="font-size:13px;font-weight:500">Learn something new</a><a style="font-size:13px;font-weight:500">Your whole network</a></div>`)}
    </div>
  </main>`);
}

// ── L4 Route ────────────────────────────────────────────────────
function route() {
  const kv = (k, v) => `<span style="color:${c.ink3}">${k}</span><span>${v}</span>`;
  const next = (n, t, why, on) => `<div style="display:flex;flex-direction:column;gap:4px;padding:11px 14px;border-radius:10px;background:${c.surface};border:${on ? `2px solid ${c.sel}` : `1px solid ${c.border}`}">
    <div style="display:flex;justify-content:space-between;gap:8px"><span style="font-size:14px;font-weight:600">${n}</span><span style="font-family:${MONO};font-size:11.5px;color:${c.ink3}">${t}</span></div>
    <span style="font-size:12.5px;color:${c.ink2};line-height:1.4">${why}</span></div>`;
  const lineProg = (name, a, b, note, col) => `<div style="display:flex;flex-direction:column;gap:5px;flex:1">
    <div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="font-weight:600">${name}</span><span style="color:${col || c.ink3}">${note}</span></div>
    <div style="display:flex;gap:3px">${Array.from({ length: b }, (_, i) => `<span style="flex:1;height:6px;border-radius:3px;background:${i < a ? c.line : c.border2}"></span>`).join('')}</div></div>`;
  const milestone = (kind, title, sub, state) => `<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-top:1px solid ${c.border}">
    <span style="width:34px;height:34px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:11px;font-weight:600;${state === 'blocked' ? `border:1.5px dashed ${c.ink3};color:${c.ink3}` : state === 'end' ? `background:${c.ink};color:${c.bg}` : `background:${c.selSoft};color:${c.sel}`}">${kind}</span>
    <div style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-size:14px;font-weight:600;color:${state === 'blocked' ? c.ink3 : c.ink}">${title}</span><span style="font-size:12.5px;color:${c.ink2}">${sub}</span></div></div>`;
  return page(1440, 1480, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;gap:18px;padding:24px 36px 32px;min-height:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <span style="font-size:13px;color:${c.ink3}">Home › Your routes</span>
        ${h1('Learn Salmon', 36)}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${levelTag('First steps → Advanced · starts at Introductory for you')}${greyTag('Ends in a Comeni Labs pipeline')}</div>
        <span style="font-size:16px;color:${c.ink};max-width:70ch;line-height:1.5"><b style="font-weight:600">At the end you can</b> estimate transcript expression from your own RNA-seq reads with Salmon, and explain each step it takes.</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;padding-top:26px">${seg(c, ['Map', 'List'], 0)}${secondary(c, 'Test yourself')}${secondary(c, 'Change goal')}</div>
    </div>

    <div style="${panel(c)};padding:14px 20px;display:flex;align-items:center;gap:28px">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:190px"><span style="font-size:22px;font-weight:600">7 stops to go</span><span style="font-size:13px;color:${c.ink2}">about 2 h 20 min · 6 of 13 settled</span></div>
      <div style="display:flex;flex-direction:column;gap:2px;min-width:200px;padding-left:24px;border-left:1px solid ${c.border}"><span style="font-size:14px;font-weight:600">About 5 days</span><span style="font-size:12.5px;color:${c.ink2}">at your usual 30 min a day</span></div>
      <div style="display:flex;gap:20px;flex:1;padding-left:24px;border-left:1px solid ${c.border}">
        ${lineProg('Data line', 2, 4, '2 to go')}${lineProg('Reads line', 2, 4, 'blocked at 4', c.ink3)}${lineProg('Index line', 0, 2, '2 to go')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0, 1fr) 360px;gap:18px">
      <section style="${panel(c)};padding:14px 18px 10px;display:flex;flex-direction:column;gap:6px;min-width:0">
        ${routeMetro()}
        ${routeLegend}
        <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-top:6px;border-radius:9px;background:${c.bg}">
          <span style="font-size:13px;line-height:1.5;color:${c.ink2};flex:1"><b style="color:${c.ink};font-weight:600">How it fits together.</b> The data line says what your reads and transcripts are; the reads line gets them onto transcripts; the index line builds the graph Salmon searches. All three meet at Salmon.</span>${amberTag('AI-written · not yet reviewed')}
        </div>
      </section>
      <aside style="${panel(c)};padding:18px;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="${label(c)}">Selected stop</span>${blueTag('In progress')}</div>
        <span style="font-size:20px;font-weight:600;line-height:1.2">Reference transcriptome</span>
        <span style="font-size:14px;line-height:1.5">Explain why Salmon compares reads with a list of transcripts rather than with a genome.</span>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px">
          ${kv('Level', 'Introductory')}${kv('Time', '10 min · 6 left')}${kv('Questions', '2 of 5 answered')}${kv('Needs', `RNA-seq experiments ${ic.check(c.ink2)}`)}${kv('Unlocks', 'Salmon')}${kv('Proved by', 'Build a transcript index · rung 2')}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:9px;background:${c.lineSoft}">
          <span style="font-size:12px;font-weight:600">Why it’s on this route</span>
          <span style="font-size:13px;line-height:1.5">Salmon indexes transcripts, not a genome — this is the list it searches.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:9px;background:${c.bg}">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:600;color:${c.ink2}">Coming from RNA-seq experiments</span>${amberTag()}</div>
          <span style="font-size:13px;line-height:1.5;font-style:italic;color:${c.ink2}">Your reads are copies of transcripts. Salmon compares them with a list of known transcripts — that list is this stop.</span>
        </div>
        <div style="margin-top:auto;display:flex;gap:8px">${primary(c, 'Continue', '')}${secondary(c, 'Open page')}</div>
      </aside>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:18px">
      ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600">Next up</span><span style="font-size:12px;color:${c.ink3}">4 ready · any order</span></div>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
          ${next('Reference transcriptome', '6 min left', 'Data line · you started it', true)}
          ${next('Expectation–maximisation', '20 min', 'Data line · how reads are shared')}
          ${next('Sequence alignment', '15 min', 'Reads line')}
          ${next('k-mers', '10 min', 'Index line · unlocks 2 stops')}
        </div>
        <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;border:1.5px dashed ${c.sel};background:${c.selSoft}">
          <div style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-size:13.5px;font-weight:600">Step back suggested · k-mers</span><span style="font-size:12.5px;color:${c.ink2}">After your answer on de Bruijn graphs. A 10-minute detour; the route order doesn’t change.</span></div>
          ${secondary(c, 'Take the detour')}</div>`)}
      ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600">Milestones</span><span style="font-size:12px;color:${c.ink3}">a problem proves each line</span></div>
        ${milestone('P', 'Split reads between two isoforms', 'Data line · rung 2 · after Expectation–maximisation', 'open')}
        ${milestone('P', 'Rebuild a sequence from its k-mers', 'Index line · rung 3 · after de Bruijn graphs', 'open')}
        ${milestone('P', 'Place reads on transcripts', 'Reads line · waiting for Selective alignment to be written · follow', 'blocked')}
        ${milestone('Labs', 'Run salmon quant on your own reads', 'The end of the route · a ready pipeline in Comeni Labs', 'end')}`)}
    </div>
  </main>`);
}

// ── node-page figures (each is a library component filled with data) ──
const F = {
  tiling() {
    const g = 'ATGCGTACGTTAGCCTAGGATCCAGTACGTTAGGCATCGA';
    let s = `<svg viewBox="0 0 740 150" width="100%" style="display:block">`;
    s += `<text x="0" y="24" style="font-family:${MONO};font-size:11px;fill:${c.ink3}">genome</text>`;
    [...g].forEach((ch, i) => { s += `<text x="${90 + i * 16}" y="24" text-anchor="middle" style="font-family:${MONO};font-size:13px;fill:${c.ink}">${ch}</text>`; });
    s += `<line x1="82" y1="34" x2="${98 + (g.length - 1) * 16}" y2="34" style="stroke:${c.ink};stroke-width:2"></line>`;
    const reads = [[0, 9, 0], [5, 9, 1], [11, 9, 0], [16, 9, 1], [21, 9, 0], [27, 9, 1], [31, 9, 2]];
    reads.forEach(([st, len, row]) => { s += `<rect x="${84 + st * 16}" y="${48 + row * 20}" width="${len * 16 - 4}" height="12" rx="4" style="fill:${c.lineSoft};stroke:${c.line};stroke-width:1.2"></rect>`; });
    s += `<text x="0" y="68" style="font-family:${MONO};font-size:11px;fill:${c.ink3}">reads</text>`;
    s += `<text x="90" y="134" style="font-family:${UI};font-size:12.5px;fill:${c.ink2}">Short, overlapping pieces in no order. The genome above is what you want back.</text>`;
    return s + '</svg>';
  },
  slider() {
    const r = 'ACGTTAGCAT', k = 4;
    let s = `<svg viewBox="0 0 740 250" width="100%" style="display:block">`;
    [...r].forEach((ch, i) => { s += `<rect x="${60 + i * 34}" y="14" width="30" height="34" rx="6" style="fill:${i < k ? c.selSoft : c.surface};stroke:${i < k ? c.sel : c.border2};stroke-width:1.5"></rect><text x="${75 + i * 34}" y="37" text-anchor="middle" style="font-family:${MONO};font-size:16px;font-weight:500;fill:${c.ink}">${ch}</text>`; });
    for (let j = 0; j <= r.length - k; j++) {
      const y = 62 + j * 20;
      s += `<rect x="${60 + j * 34}" y="${y}" width="${k * 34 - 4}" height="14" rx="4" style="fill:${j === 0 ? c.sel : c.lineSoft};stroke:${j === 0 ? c.sel : c.line};stroke-width:1"></rect>`;
      s += `<text x="${60 + (j + k) * 34 + 6}" y="${y + 11}" style="font-family:${MONO};font-size:11.5px;fill:${c.ink2}">${r.slice(j, j + k)}</text>`;
    }
    s += `<text x="480" y="30" style="font-family:${UI};font-size:13px;font-weight:600;fill:${c.ink}">k</text>`;
    s += `<line x1="500" y1="26" x2="700" y2="26" style="stroke:${c.border2};stroke-width:4;stroke-linecap:round"></line><line x1="500" y1="26" x2="566" y2="26" style="stroke:${c.sel};stroke-width:4;stroke-linecap:round"></line>`;
    [3, 4, 5, 6, 7].forEach((v, i) => { s += `<text x="${500 + i * 50}" y="48" text-anchor="middle" style="font-family:${MONO};font-size:11px;fill:${v === k ? c.sel : c.ink3}">${v}</text>`; });
    s += `<circle cx="550" cy="26" r="9" style="fill:${c.surface};stroke:${c.sel};stroke-width:3"></circle>`;
    s += `<text x="480" y="104" style="font-family:${MONO};font-size:15px;fill:${c.ink}">10 − 4 + 1 = <tspan style="font-weight:600">7 k-mers</tspan></text>`;
    s += `<text x="480" y="128" style="font-family:${UI};font-size:12.5px;fill:${c.ink2}">A read of length L has L − k + 1 k-mers.</text>`;
    s += `<text x="480" y="148" style="font-family:${UI};font-size:12.5px;fill:${c.ink2}">Drag k and watch the windows change.</text>`;
    return s + '</svg>';
  },
  conventions() {
    const nd = (x, y, t, w = 58) => `<rect x="${x}" y="${y}" width="${w}" height="30" rx="7" style="fill:${c.surface};stroke:${c.ink2};stroke-width:1.5"></rect><text x="${x + w / 2}" y="${y + 20}" text-anchor="middle" style="font-family:${MONO};font-size:13.5px;fill:${c.ink}">${t}</text>`;
    const ar = (x1, x2, y, lab) => `<path d="M${x1} ${y} H${x2 - 6}" style="stroke:${c.line};stroke-width:2"></path><path d="M${x2 - 8} ${y - 5} L${x2} ${y} L${x2 - 8} ${y + 5}" style="fill:none;stroke:${c.line};stroke-width:2"></path>${lab ? `<text x="${(x1 + x2) / 2}" y="${y - 8}" text-anchor="middle" style="font-family:${MONO};font-size:11.5px;font-weight:600;fill:${c.btn}">${lab}</text>` : ''}`;
    let s = `<svg viewBox="0 0 740 160" width="100%" style="display:block">`;
    s += `<text x="0" y="20" style="font-family:${UI};font-size:13px;font-weight:600;fill:${c.ink}">k-mers as nodes</text><text x="0" y="38" style="font-family:${UI};font-size:12px;fill:${c.ink3}">common in tools and teaching</text>`;
    ['ACG', 'CGT', 'GTT'].forEach((t, i) => { s += nd(10 + i * 110, 70, t); if (i < 2) s += ar(68 + i * 110, 120 + i * 110, 85); });
    s += `<line x1="370" y1="10" x2="370" y2="150" style="stroke:${c.border};stroke-width:1"></line>`;
    s += `<text x="395" y="20" style="font-family:${UI};font-size:13px;font-weight:600;fill:${c.ink}">k-mers as edges</text><text x="395" y="38" style="font-family:${UI};font-size:12px;fill:${c.ink3}">the formal definition · nodes are (k−1)-mers</text>`;
    ['AC', 'CG', 'GT', 'TT'].forEach((t, i) => { s += nd(400 + i * 88, 70, t, 46); if (i < 3) s += ar(446 + i * 88, 488 + i * 88, 85, ['ACG', 'CGT', 'GTT'][i]); });
    s += `<text x="0" y="140" style="font-family:${UI};font-size:12.5px;fill:${c.ink2}">Same reads, same information.</text><text x="395" y="140" style="font-family:${UI};font-size:12.5px;fill:${c.ink2}">A spelled sequence is a path through the edges.</text>`;
    return s + '</svg>';
  },
  bubble(labels = true) {
    const errA = labels ? c.open : c.ink2, errASoft = labels ? c.openSoft : c.surface, errB = labels ? c.measBar : c.ink2, errBSoft = labels ? c.measSoft : c.surface;
    const n = (x, y, t, o = {}) => `<rect x="${x}" y="${y}" width="56" height="28" rx="7" style="fill:${o.f || c.surface};stroke:${o.s || c.ink2};stroke-width:1.5;${o.d ? 'stroke-dasharray:4 3' : ''}"></rect><text x="${x + 28}" y="${y + 19}" text-anchor="middle" style="font-family:${MONO};font-size:13px;fill:${c.ink}">${t}</text>`;
    const l = (d, col, dash) => `<path d="${d}" style="fill:none;stroke:${col};stroke-width:2;${dash ? 'stroke-dasharray:5 4;' : ''}stroke-linejoin:round"></path>`;
    let s = `<svg viewBox="0 0 740 200" width="100%" style="display:block">`;
    s += l('M66 84 H110', c.line) + l('M166 84 H210', c.line) + l('M266 84 H330', c.line) + l('M386 84 H450', c.line) + l('M506 84 H550', c.line);
    s += l('M266 84 H290 V140 H330', errA, 1) + l('M386 140 H410 V84 H450', errA, 1);
    s += l('M166 84 H180 V30 H210', errB, 1);
    ['ACG', 'CGT', 'GTT', 'TTA', 'TAG', 'AGC'].forEach((t, i) => { s += n(10 + i * 110 + (i > 2 ? 10 : 0) + (i > 3 ? 10 : 0), 70, t); });
    s += n(330, 126, 'TCA', { s: errA, f: errASoft, d: 1 }) + n(210, 16, 'GTA', { s: errB, f: errBSoft, d: 1 });
    if (labels) {
      s += `<text x="400" y="178" text-anchor="middle" style="font-family:${UI};font-size:12.5px;font-weight:600;fill:${c.open}">bubble: a read with one wrong base rejoins the path</text>`;
      s += `<text x="270" y="22" style="font-family:${UI};font-size:12.5px;font-weight:600;fill:${c.meas}">tip: an error near a read’s end dead-ends</text>`;
    }
    return s + '</svg>';
  },
};
const blockTag = (s) => `<span style="display:{{ tags }};align-self:flex-start;align-items:center;gap:4px;padding:1px 7px;border-radius:5px;background:${c.ink};color:${c.bg};font-family:${MONO};font-size:10.5px">${s}</span>`;
const figureBlock = (tag, title, body, caption) => `<figure style="margin:0;display:flex;flex-direction:column;gap:8px">
  ${blockTag(tag)}
  <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:12px;padding:14px 18px 10px">${body}</div>
  <figcaption style="font-size:13px;color:${c.ink2};line-height:1.5"><b style="color:${c.ink};font-weight:600">${title}</b> ${caption}</figcaption></figure>`;

// ── L5 Node — one page, questions inline, a real problem ────────
function node() {
  const sup = (n) => `<sup style="font-family:${MONO};font-size:10px;color:${c.sel}">[${n}]</sup>`;
  const H2 = (s) => `<h2 style="margin:10px 0 0;font-size:23px;font-weight:600;letter-spacing:-.01em">${s}</h2>`;
  const qClosed = (n, q, meta, done) => `<div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% try %}')}<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;border:1px solid ${done ? c.border : c.border2};background:${done ? c.bg : c.surface}">
    <span style="width:26px;height:26px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:12px;${done ? `background:${c.lineSoft};color:${c.btn}` : `border:1.5px solid ${c.sel};color:${c.sel}`}">${done ? ic.check(c.btn) : n}</span>
    <div style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-size:14.5px;font-weight:500">${q}</span><span style="font-size:12px;color:${c.ink3}">${meta}</span></div>
    ${done ? `<span style="font-size:12.5px;color:${c.ink3}">Answered · back in review in 3 days</span>` : `<span style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:${c.sel}">Try it ${ic.chevron}</span>`}</div></div>`;
  const choice = (s, st) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;font-family:${MONO};font-size:14.5px;${st === 'right' ? `border:2px solid ${c.btn};background:${c.lineSoft}` : `border:1px solid ${c.border2};background:${c.surface};color:${c.ink3}`}">${st === 'right' ? ic.check(c.btn) : ''}${s}</div>`;
  const toc = ['Learn it', 'The problem it solves', 'From reads to k-mers', 'Building the graph', 'Formal definition', 'Two conventions', 'Errors and repeats', 'Worked example', 'Cost and choosing k', 'Problem', 'About this page'];
  const dataBox = (t, body) => `<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:600">${t}</span><pre style="margin:0;padding:12px 14px;border-radius:9px;background:${c.bg};border:1px solid ${c.border};font-family:${MONO};font-size:13px;line-height:1.7;color:${c.ink};overflow-x:auto">${body}</pre></div>`;
  const body = `${learnBar()}
  <div style="height:46px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 36px;border-bottom:1px solid ${c.border};background:${c.surface};font-size:13px;color:${c.ink2}">
    <span>On your route <b style="color:${c.ink};font-weight:600">Learn Salmon</b> · index line · unlocks <b style="color:${c.ink};font-weight:600">Salmon</b></span>
    <div style="display:flex;align-items:center;gap:10px"><span>2 of 5 questions · problem not solved</span><div style="display:flex;gap:3px">${[1, 1, 0, 0, 0].map(v => `<span style="width:22px;height:5px;border-radius:2px;background:${v ? c.line : c.border2}"></span>`).join('')}</div></div>
    <a style="font-weight:500">Back to the route</a>
  </div>
  <main style="flex:1;display:grid;grid-template-columns:200px minmax(0, 1fr) 290px;gap:40px;padding:30px 36px;min-height:0">
    <nav style="display:flex;flex-direction:column;gap:1px;padding-top:4px">
      <span style="${label(c)};padding-bottom:8px">On this page</span>
      ${toc.map((t, i) => `<span style="padding:5px 10px;border-left:2px solid ${i === 3 ? c.line : c.border};font-size:13px;color:${i === 3 ? c.ink : c.ink2};font-weight:${i === 3 ? 600 : 400}">${t}</span>`).join('')}
    </nav>
    <article style="display:flex;flex-direction:column;gap:20px;min-width:0;max-width:800px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <span style="font-size:13px;color:${c.ink3}">Algorithms › de Bruijn graphs</span>
        ${h1('de Bruijn graphs', 42)}
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">${levelTag('Intermediate')}<span style="font-size:13.5px;color:${c.ink2}">About 35 min with the questions · plus the problem</span></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% claim %}')}
        <div style="padding:16px 20px;border-radius:12px;border:1.5px solid ${c.ink};background:${c.surface}">
          <span style="${label(c)}">What you’ll be able to do</span>
          <p style="margin:6px 0 0;font-size:17px;font-weight:500;line-height:1.45">Build a de Bruijn graph from a set of reads, read sequences off it, recognise the marks errors leave in it, and explain why assemblers and indexes use it instead of comparing reads.</p>
        </div></div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px"><span style="font-size:13px;font-weight:600;margin-right:4px">Before this, all of:</span>
        ${['k-mers', 'Sequencing reads'].map(n => `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;border:1px solid ${c.border2};background:${c.surface};font-size:13px">${ic.check(c.ink2)}${n}</span>`).join('')}</div>
      <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:10px;background:${c.lineSoft}">
        <span style="font-size:14px;line-height:1.55;flex:1"><b style="font-weight:600">On your route to Salmon:</b> Salmon’s index stores every k-mer of the transcriptome in a compacted version of this graph, so a read’s k-mers can be looked up in one step.</span>${amberTag()}
      </div>

      ${H2('Learn it')}
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          ${p('Read our explanation below, or watch first. Each outside resource was picked by a reviewer for the part of this page it covers.', 'max-width:52ch')}
          ${seg(c, ['Read', 'Watch'], 1)}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% resource kind="video" display="embed" %}')}
        <div style="display:grid;grid-template-columns:minmax(0, 1.35fr) minmax(0, 1fr);gap:0;border-radius:14px;overflow:hidden;border:1px solid ${c.border};background:${c.surface}">
          <div style="position:relative;aspect-ratio:16/9;background:${c.ink};display:flex;align-items:center;justify-content:center">
            <div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 14px, transparent 14px 28px)"></div>
            <span style="position:relative;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center"><svg width="24" height="24" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" style="fill:#FFFFFF"></path></svg></span>
            <span style="position:absolute;left:14px;bottom:12px;font-family:${MONO};font-size:11.5px;color:rgba(255,255,255,.8)">plays 2:10–7:45 of 11:02</span>
            <span style="position:absolute;right:14px;bottom:12px;font-size:11.5px;color:rgba(255,255,255,.8)">[embedded player]</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;padding:16px 18px">
            <div style="display:flex;gap:6px;flex-wrap:wrap">${greyTag('Video')}${levelTag('Introductory')}</div>
            <span style="font-size:16px;font-weight:600;line-height:1.3">[Khan Academy video on genome assembly]</span>
            <span style="font-size:13px;line-height:1.5;color:${c.ink2}"><b style="color:${c.ink};font-weight:600">Covers:</b> why overlapping reads are assembled through their k-mers, drawn step by step. Stop at 7:45 — the rest is about sequencing chemistry.</span>
            <div style="margin-top:auto;display:flex;flex-direction:column;gap:4px;padding-top:10px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink3}">
              <span>Khan Academy · via YouTube embed · non-commercial use, attributed</span>
              <span>Chosen by [Reviewer A] · <a>Open on Khan Academy</a> · <a>Didn’t help</a></span>
            </div>
          </div>
        </div></div>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
          ${[['Reading', 'OpenStax Biology 2e · §17.1', 'The genome-sequencing section that sets up assembly', 'CC BY 4.0 · shown here', 'Foundations'], ['Tutorial', 'Galaxy Training · De Bruijn graph assembly', 'Assemble a small genome yourself, in Galaxy', 'CC BY 4.0 · link', 'Intermediate']].map(([k, t, cov, lic, lv]) => `<div style="display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:12px;border:1px solid ${c.border};background:${c.surface}">
            <div style="display:flex;justify-content:space-between;gap:8px"><span style="display:flex;gap:6px">${greyTag(k)}${levelTag(lv)}</span><span style="font-size:11.5px;color:${c.ink3}">${lic}</span></div>
            <span style="font-size:14px;font-weight:600">${t}</span><span style="font-size:12.5px;color:${c.ink2};line-height:1.45">${cov}</span></div>`).join('')}
        </div>
      </div>

      ${H2('The problem it solves')}
      ${p('A sequencer does not read a genome from end to end. It returns millions of short pieces — reads — sampled from random positions, overlapping each other, in no order. Putting them back together is assembly; finding where they came from is indexing. Both need a way to use overlaps without comparing every read with every other read, which grows with the square of the number of reads.')}
      ${figureBlock('{% figure component="read-tiling" %}', 'Figure 1.', F.tiling(), 'Reads tile a genome with overlaps. Drawn by the read-tiling component from a 40-base example.')}

      ${H2('From reads to k-mers')}
      ${p(`The trick is to stop treating reads as units. Slide a window of width <i>k</i> along each read and record every substring it covers: these are the read’s <b style="color:${c.ink};font-weight:600">k-mers</b>. Two reads that overlap share k-mers, so overlaps can be found by looking k-mers up in a table instead of aligning reads to each other.`)}
      ${figureBlock('{% figure component="kmer-window" interactive %}', 'Figure 2.', F.slider(), 'Interactive: change k and the windows update. The count is computed, not written.')}
      ${qClosed(1, 'How many 5-mers does a 100-base read contain?', '1 min · a count', true)}

      ${H2('Building the graph')}
      ${p(`Now connect the k-mers. Draw an arrow from one k-mer to another when the last <i>k</i>−1 letters of the first are the first <i>k</i>−1 letters of the second. Every read becomes a path, and reads that overlap share part of their path. Walking along the arrows spells sequence back out: each step adds one letter.${sup(1)}`)}
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% try figure="kmer-graph" %}')}
      <div style="display:flex;flex-direction:column;gap:14px;padding:18px 20px;border-radius:14px;border:2px solid ${c.sel};background:${c.surface}">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1.5px solid ${c.sel};color:${c.sel};font-family:${MONO};font-size:12px">2</span>
          <span style="font-size:16px;font-weight:600;flex:1">Follow the green path. What does it spell?</span>
          <span style="font-size:12px;color:${c.ink3}">2 min · interactive</span>
        </div>
        <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:10px;padding:10px 16px">${kmerFigure()}</div>
        <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">${choice('ACGTTAG', 'right')}${choice('ACGTCAG')}${choice('ACGGTTAG')}</div>
        <div style="display:flex;align-items:center;gap:10px;font-size:12.5px;color:${c.ink2}">
          <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;border:1px solid ${c.border2};background:${c.surface}">Hint 1 of 2 used</span>
          <span style="color:${c.ink3}">“Each step to the next k-mer adds exactly one letter.”</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:10px;background:${c.lineSoft}">
          <span style="font-size:14px;font-weight:600;color:${c.btn}">Right — ACGTTAG. <span style="font-weight:500;color:${c.ink2}">Why:</span></span>
          <span style="font-size:13.5px;line-height:1.55">Start with the first k-mer, then add the last letter of each next one: ACG + T + T + A + G. The branch to GTC belongs to another read.</span>
          <span style="font-size:12px;color:${c.ink3}">This question comes back in your review in 3 days.</span>
        </div>
      </div></div>

      ${H2('Formal definition')}
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% math %}')}
        <div style="padding:16px 20px;border-radius:12px;background:${c.surface};border:1px solid ${c.border};font-family:'Times New Roman', Georgia, serif;font-size:19px;line-height:1.9;color:${c.ink}">
          Given reads <i>R</i> and an integer <i>k</i>, the de Bruijn graph <i>G<sub>k</sub></i>(<i>R</i>) = (<i>V</i>, <i>E</i>) has<br>
          &nbsp;&nbsp;<i>V</i> = { (<i>k</i>−1)-mers of <i>R</i> },&nbsp;&nbsp; <i>E</i> = { <i>k</i>-mers of <i>R</i> },<br>
          &nbsp;&nbsp;and each <i>k</i>-mer <i>x</i><sub>1</sub>…<i>x</i><sub><i>k</i></sub> is an edge <i>x</i><sub>1</sub>…<i>x</i><sub><i>k</i>−1</sub> → <i>x</i><sub>2</sub>…<i>x</i><sub><i>k</i></sub>.
        </div></div>
      ${p(`A sequence consistent with the reads is a walk in <i>G<sub>k</sub></i>. A walk that uses every edge exactly once is an <b style="color:${c.ink};font-weight:600">Eulerian path</b>, which can be found in linear time — the reason this formulation displaced overlap-graph approaches that lead to the much harder Hamiltonian path problem.${sup(1)}`)}
      ${qClosed(3, 'In this definition, is a k-mer a node or an edge?', '1 min · concept')}

      ${H2('Two conventions')}
      ${p('Papers, tools and textbooks disagree on what a node is. Read a paper’s definition before comparing numbers across it and another.')}
      ${figureBlock('{% figure component="compare-graphs" %}', 'Figure 3.', F.conventions(), 'The same three k-mers under both conventions.')}

      ${H2('Errors and repeats')}
      ${p('Real reads contain sequencing errors. An error creates k-mers that exist in only one read, and they leave recognisable shapes: a <b style="color:' + c.ink + ';font-weight:600">bubble</b> when the wrong base is in the middle of a read and the path rejoins, a <b style="color:' + c.ink + ';font-weight:600">tip</b> when it is near an end and the path dead-ends. Assemblers remove both. Repeats longer than <i>k</i> do the opposite: they merge distinct parts of the genome into one path.')}
      ${figureBlock('{% figure component="graph-artifacts" %}', 'Figure 4.', F.bubble(), 'Coloured dashed nodes appear in only one read.')}
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% image asset="…" source="…" licence="…" %}')}
        <div style="display:grid;grid-template-columns:260px minmax(0, 1fr);gap:16px;align-items:center;padding:12px;border-radius:12px;border:1px solid ${c.border};background:${c.surface}">
          <div style="height:150px;border-radius:8px;background:repeating-linear-gradient(45deg, ${c.bg} 0 10px, ${c.surface} 10px 20px);border:1px dashed ${c.border2};display:flex;align-items:center;justify-content:center;font-size:12px;color:${c.ink3};text-align:center;padding:10px">[Image: a real assembly graph viewed in Bandage]</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.5;color:${c.ink2}">
            <span style="color:${c.ink}"><b style="font-weight:600">Figure 5.</b> What a bacterial assembly graph looks like in practice: long unbranched paths joined at repeats.</span>
            <span>Image: [author], [title], via Wikimedia Commons · [licence, e.g. CC BY 4.0] · <a>source</a></span>
            <span style="font-size:12px;color:${c.ink3}">Attached through the image search; author and licence are required to publish.</span>
          </div></div></div>
      ${qClosed(4, 'Why does an error near the end of a read make a tip rather than a bubble?', '2 min · reasoning')}

      ${H2('Worked example')}
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% example checked %}')}
      <pre style="margin:0;padding:16px 18px;border-radius:10px;background:${c.bg};border:1px solid ${c.border};font-family:${MONO};font-size:13.5px;line-height:1.8;color:${c.ink};overflow-x:auto">reads     ACGTT        CGTTA        GTTAG
3-mers    ACG CGT GTT  CGT GTT TTA  GTT TTA TAG
distinct  ACG CGT GTT TTA TAG
path      ACG → CGT → GTT → TTA → TAG
spells    ACGTTAG</pre></div>

      ${H2('Cost and choosing k')}
      ${p(`With a hash table, building the graph takes expected time linear in the total number of k-mers; memory is dominated by the number of distinct k-mers, which is why real tools compact unbranched paths into single nodes — the form Salmon’s index uses.${sup(2)} A larger <i>k</i> resolves more repeats but breaks the graph wherever coverage is low or reads contain errors; a smaller <i>k</i> keeps it connected but tangles repeats together.`)}
      ${qClosed(5, 'Coverage is low and reads are noisy. Should you raise or lower k?', '2 min · judgement')}

      ${H2('Problem')}
      <div style="display:flex;flex-direction:column;gap:6px">${blockTag('{% problem rung=3 %}')}
      <div style="display:flex;flex-direction:column;gap:16px;padding:22px 24px;border-radius:14px;border:1.5px solid ${c.ink};background:${c.surface}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
          <div style="display:flex;flex-direction:column;gap:4px"><span style="${label(c)}">Proves this node</span><span style="font-size:21px;font-weight:600">Construct a de Bruijn graph</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${greyTag('Rung 3 · a few lines of code')}${greyTag('Solved by 44%')}${greyTag('about 30 min')}</div>
        </div>
        ${p('Given a set of reads and an integer k, return the edges of the de Bruijn graph that uses k-mers as nodes: one line per pair of k-mers where the second follows the first, sorted alphabetically, with no duplicates.', 'max-width:none;color:' + c.ink)}
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:14px">
          ${dataBox('Given', 'k on the first line, then up to\n1,000 reads of up to 100 bases')}
          ${dataBox('Return', 'edges as "A -> B", one per line,\nsorted, no duplicates')}
          ${dataBox('Sample dataset', '3\nACGTT\nCGTTA\nGTTAG')}
          ${dataBox('Sample output', 'ACG -> CGT\nCGT -> GTT\nGTT -> TTA\nTTA -> TAG')}
        </div>
        <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:10px;background:${c.bg}">
          <div style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-size:14px;font-weight:600">Your dataset</span><span style="font-size:12.5px;color:${c.ink2}">${mono('dbg_your-reads.txt')} · 812 reads · generated for you — the answer is different for everyone</span></div>
          ${secondary(c, 'Download dataset')}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <span style="font-size:13px;font-weight:600">Your answer</span>
          <div style="height:92px;border-radius:10px;border:1.5px solid ${c.border2};background:${c.surface};padding:10px 12px;font-family:${MONO};font-size:13px;color:${c.ink3};line-height:1.6">AAC -> ACG<br>ACA -> CAT<br>…</div>
          <div style="display:flex;gap:10px;align-items:baseline;padding:10px 14px;border-radius:10px;background:${c.openSoft};font-size:13.5px;line-height:1.5">
            <span style="font-size:12px;font-weight:600;color:${c.open};flex:none">Not quite · attempt 1</span>
            <span>Your list has 1,946 lines; the answer has 1,803. Duplicate reads produce the same edge more than once — each edge should appear once.</span>
          </div>
          <div style="display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:10px;border:1.5px dashed ${c.sel};background:${c.selSoft}">
            <div style="display:flex;flex-direction:column;gap:2px;flex:1">
              <span style="font-size:13.5px;font-weight:600">This mistake usually means a gap in <span style="font-family:${MONO}">k-mers</span></span>
              <span style="font-size:12.5px;color:${c.ink2};line-height:1.45">A read of length L has L − k + 1 k-mers, and the same k-mer can come from many reads. A 10-minute step back, then you return to this problem.</span>
            </div>
            ${secondary(c, 'Show a hint')}${primary(c, 'Revisit k-mers first', '')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;color:${c.ink3}">Upload a file or paste. Only your final answer is sent — your code never leaves your computer.</span>${primary(c, 'Submit answer', '')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid ${c.border};font-size:13px;color:${c.ink2}">${ic.lock}<span><b style="color:${c.ink};font-weight:600">Solutions</b> · 214 posts from people who solved it · open after you solve it</span></div>
      </div></div>

      <div style="display:flex;flex-direction:column;gap:6px;padding:14px 16px;border-radius:10px;border:1px solid ${c.border};background:${c.surface};font-size:13px;line-height:1.6;color:${c.ink2}">
        <span style="font-size:13.5px;font-weight:600;color:${c.ink}">About this page</span>
        <span>Text drafted by AI from the cited sources, reviewed and approved by [Reviewer name] on [date]. Figures 1–4 are drawn by library components from the data shown; their counts and answers are computed. Figure 5 is a licensed image. The worked example and the problem’s answers are checked by computation. Outside resources were chosen by a reviewer and are linked or embedded under their own licences. The green route text is AI-written and not yet reviewed.</span>
      </div>
    </article>
    <aside style="display:flex;flex-direction:column;gap:22px">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:13px;font-weight:600;color:${c.ink3}">Around this node</span><span style="display:flex;padding:6px;color:${c.ink3}"><svg width="7" height="12" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round"></path></svg></span></div>
      ${[['Goes deeper', [['Compacted de Bruijn graphs', 'Advanced · 15 min'], ['Eulerian paths', 'Intermediate · 20 min'], ['Choosing k', 'Intermediate · 10 min']]], ['Related', [['Overlap graphs', 'Intermediate · 15 min'], ['Minimizers', 'Advanced · 15 min']]], ['Needed by', [['Salmon', 'your goal'], ['Assemble a genome', 'track'], ['Contigs', 'Intermediate · 10 min']]]].map(([t, items]) => `<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:600">${t}</span>${items.map(([n, m]) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid ${c.border};background:${c.surface};font-size:13px"><span>${n}</span><span style="color:${c.ink3};font-size:12px">${m}</span></div>`).join('')}</div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px"><span style="font-size:13px;font-weight:600">Sources</span>
        <div style="font-size:12.5px;line-height:1.5;color:${c.ink2};display:flex;flex-direction:column;gap:10px">
          <span><b style="font-family:${MONO};color:${c.sel};font-weight:500">[1]</b> Compeau, Pevzner &amp; Tesler (2011). How to apply de Bruijn graphs to genome assembly. <i>Nature Biotechnology</i> 29, 987–991. <span style="font-family:${MONO};font-size:11px">doi:10.1038/nbt.2023</span></span>
          <span><b style="font-family:${MONO};color:${c.sel};font-weight:500">[2]</b> Almodaresi et al. (2018). A space and time-efficient index for the compacted colored de Bruijn graph. <i>Bioinformatics</i>. <span style="font-family:${MONO};font-size:11px">doi:10.1093/bioinformatics/bty292</span></span>
        </div></div>
      ${card(`<span style="font-size:13.5px;font-weight:600">Already know this?</span><span style="font-size:12.5px;color:${c.ink2};line-height:1.5">Answer the five questions without reading, then solve the problem, to settle it.</span><div>${secondary(c, 'Test me out')}</div>`)}
    </aside>
  </main>`;
  return `${head(c)}
<div style="width:1440px;height:5420px;display:flex;flex-direction:column;background:${c.bg};color:${c.ink};font-family:${UI};overflow:hidden">
${body}
</div>
</x-dc>
<script data-dc-script data-props='{"showBlocks":{"editor":"boolean","default":true,"section":"Node page"}}'>
class Component extends DCLogic {
  renderVals() { return { tags: (this.props.showBlocks ?? true) ? 'inline-flex' : 'none' }; }
}
</script>
</body>
</html>
`;
}

// ── L12 Explore ─────────────────────────────────────────────────
function explore() {
  const facet = (title, opts) => `<div style="display:flex;flex-direction:column;gap:4px;padding:12px 0;border-top:1px solid ${c.border}">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13.5px;font-weight:600">${title}</span><span style="color:${c.ink3}">${ic.chevron}</span></div>
    ${opts.map(([n, k, on]) => `<div style="display:flex;align-items:center;gap:9px;padding:4px 0;font-size:13.5px;color:${k === 0 ? c.ink3 : c.ink}"><span style="width:16px;height:16px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;${on ? `background:${c.sel}` : `border:1.5px solid ${c.border2}`}">${on ? ic.check('#FFFFFF') : ''}</span><span style="flex:1">${n}</span><span style="font-size:12px;color:${c.ink3};font-variant-numeric:tabular-nums">${k}</span></div>`).join('')}</div>`;
  const applied = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 11px;border-radius:999px;background:${c.selSoft};color:${c.sel};font-size:12.5px;font-weight:500">${s}<span style="display:flex">${ic.close}</span></span>`;
  const row = (n, kind, regions, held, total, left, learners, mine) => `<div style="display:grid;grid-template-columns:minmax(0, 1.6fr) 150px 190px 110px 100px;align-items:center;gap:16px;padding:12px 16px;border-top:1px solid ${c.border};${mine ? `background:${c.lineSoft}` : ''}">
    <div style="display:flex;flex-direction:column;gap:3px;min-width:0"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14.5px;font-weight:600">${n}</span>${greyTag(kind)}</div><span style="font-size:12px;color:${c.ink3}">${regions}</span></div>
    <div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;gap:2px">${Array.from({ length: total }, (_, i) => `<span style="flex:1;height:5px;border-radius:2px;background:${i < held ? c.settled : c.border2}"></span>`).join('')}</div><span style="font-size:12px;color:${c.ink2}">You hold ${held} of ${total}</span></div>
    <span style="font-size:13px;color:${c.ink2}">${left}</span>
    <span style="font-size:12.5px;color:${c.ink3};font-variant-numeric:tabular-nums">${learners}</span>
    <div style="display:flex;justify-content:flex-end">${mine ? secondary(c, 'Continue') : `<a style="font-size:13px;font-weight:600">Start</a>`}</div></div>`;
  return page(1440, 1120, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;gap:18px;padding:26px 32px;min-height:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
      <div style="display:flex;flex-direction:column;gap:6px">${h1('Explore tracks', 32)}<span style="font-size:14px;color:${c.ink2}">64 reviewed tracks. Can’t find one? Ask for a goal and we’ll build a route.</span></div>
      <div style="display:flex;align-items:center;gap:10px;width:520px;height:44px;padding:0 16px;border-radius:12px;border:1.5px solid ${c.ink};background:${c.surface};font-size:15px;color:${c.ink3}">${ic.search}Search by tool, topic or goal — e.g. “variant calling”</div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:250px minmax(0, 1fr);gap:24px;min-height:0">
      <aside style="display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding-bottom:8px"><span style="font-size:15px;font-weight:600">Filters</span><a style="font-size:12.5px;font-weight:500">Clear all</a></div>
        ${facet('How much you hold', [['Most of it (over half)', 3], ['At least a third', 7, 1], ['Less than a third', 57]])}
        ${facet('Ends with', [['A pipeline in Labs', 7, 1], ['A concept', 0]])}
        ${facet('Region', [['Sequencing', 2], ['Alignment', 1], ['Quantification', 2], ['Variants', 1], ['Assembly', 1], ['Single-cell', 1], ['Statistics', 1]])}
        ${facet('Reaches down to', [['First steps', 2], ['Foundations', 4], ['Introductory', 1], ['Intermediate', 0]])}
        ${facet('Goal is a…', [['Tool', 5], ['Method', 2], ['Concept', 0]])}
        ${facet('Time left for you', [['Under 2 h', 3], ['2–5 h', 4], ['Over 5 h', 0]])}
      </aside>
      <section style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:14px;font-weight:600">7 of 64 tracks</span>${applied('At least a third held')}${applied('Ends with a pipeline in Labs')}</div>
          <div style="display:flex;align-items:center;gap:10px"><span style="font-size:13px;color:${c.ink3}">Sort</span><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9px;border:1px solid ${c.border2};background:${c.surface};font-size:13px">Most of it already held ${ic.chevron}</span>${seg(c, ['List', 'Network'], 0)}</div>
        </div>
        <div style="${panel(c)};overflow:hidden">
          <div style="display:grid;grid-template-columns:minmax(0, 1.6fr) 150px 190px 110px 100px;gap:16px;padding:9px 16px;font-size:12px;color:${c.ink3}"><span>Track</span><span>Your progress</span><span>Left for you</span><span>Learners</span><span></span></div>
          ${row('Quality control of a sequencing run', 'Method', 'Sequencing · Foundations → Intermediate', 5, 6, '1 node · about 15 min', '1,204')}
          ${row('Learn Salmon', 'Tool', 'Quantification · Algorithms · First steps → Advanced', 6, 13, '7 nodes · about 2 h 20 min', '412', true)}
          ${row('Learn STAR', 'Tool', 'Alignment · First steps → Advanced', 5, 11, '6 nodes · about 1 h 50 min', '318')}
          ${row('Differential expression with DESeq2', 'Tool', 'Statistics · Quantification · Foundations → Advanced', 6, 14, '8 nodes · about 3 h', '287')}
          ${row('Assemble a bacterial genome', 'Method', 'Assembly · Algorithms · Foundations → Advanced', 5, 13, '8 nodes · about 3 h 20 min', '96')}
          ${row('Call variants with GATK', 'Tool', 'Variants · Alignment · First steps → Advanced', 6, 16, '10 nodes · about 4 h', '203')}
          ${row('Single-cell RNA-seq basics', 'Method', 'Single-cell · Quantification · Foundations → Advanced', 5, 15, '10 nodes · about 4 h 30 min', '151')}
        </div>
        <span style="font-size:12px;color:${c.ink3}">Sample numbers. The Network view shows only the tracks that match your filters.</span>
      </section>
    </div>
  </main>`);
}

// ── L9 Your knowledge — separate islands, not one forced network ─
function miniLine(stops, name, w = 560) {
  const step = (w - 80) / (stops.length - 1);
  let s = `<svg viewBox="0 0 ${w} 96" width="100%" style="display:block"><line x1="30" y1="46" x2="${30 + step * (stops.length - 1)}" y2="46" style="stroke:${c.line};stroke-width:6;stroke-linecap:round"></line>`;
  stops.forEach(([n, st, big], i) => {
    const x = 30 + i * step;
    const f = { settled: c.settled, stale: c.measSoft, ready: c.selSoft, open: c.surface }[st];
    const k = { settled: big ? c.ink : c.settled, stale: c.measBar, ready: c.sel, open: big ? c.ink : c.ink3 }[st];
    s += `<circle cx="${x}" cy="46" r="${big ? 9 : 6.5}" style="fill:${f};stroke:${k};stroke-width:${big ? 3 : 2}"></circle>`;
    s += `<text x="${x}" y="${i % 2 ? 76 : 24}" text-anchor="middle" style="font-family:${UI};font-size:11px;font-weight:${big ? 700 : 500};fill:${c.ink}">${n}</text>`;
  });
  return s + '</svg>';
}
function knowledge() {
  const stat = (n, s, col) => `<div style="display:flex;flex-direction:column;gap:2px;padding:12px 16px;border-radius:10px;background:${c.surface};border:1px solid ${c.border};flex:1"><span style="font-size:24px;font-weight:600;color:${col || c.ink};font-variant-numeric:tabular-nums">${n}</span><span style="font-size:12.5px;color:${c.ink2}">${s}</span></div>`;
  const island = (title, sub, body, extra = '') => `<section style="${panel(c)};display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid ${c.border}"><div style="display:flex;align-items:baseline;gap:12px"><span style="font-size:15px;font-weight:600">${title}</span><span style="font-size:12.5px;color:${c.ink3}">${sub}</span></div>${extra}</div>
    <div style="padding:8px 16px;${gridBg(c)}">${body}</div></section>`;
  return page(1440, 1480, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;gap:18px;padding:26px 32px;min-height:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-end">
      <div style="display:flex;flex-direction:column;gap:6px">${h1('Your knowledge', 32)}<span style="font-size:14px;color:${c.ink2}">What you’ve settled, grouped by what connects. A measurement, not a score.</span></div>
      ${seg(c, ['By connection', 'List'], 0)}
    </div>
    <div style="display:flex;gap:12px">${stat(19, 'nodes settled')}${stat(2, 'due for review', c.meas)}${stat(5, 'ready now', c.sel)}${stat(4, 'problems solved')}${stat(3, 'routes')}${stat(3, 'separate areas')}</div>
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) 320px;gap:18px">
      <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
        ${island('Sequencing and quantification', '2 routes share 5 nodes · Learn Salmon, Learn STAR', `<div style="height:380px">${network()}</div>`, `<a style="font-size:13px;font-weight:500">Open in Explore</a>`)}
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px">
          ${island('Statistics for biologists', '1 route · no shared nodes yet', miniLine([['Probability', 'settled'], ['Distributions', 'settled'], ['Hypothesis tests', 'stale'], ['p-values', 'ready'], ['Multiple testing', 'open', 1]], ''))}
          ${island('Microscopy image analysis', '1 route · no shared nodes yet', miniLine([['Pixels and bit depth', 'settled'], ['Thresholding', 'settled'], ['Segmentation', 'ready', 1], ['Counting cells', 'open']], ''))}
        </div>
        <div style="padding:12px 16px;border-radius:10px;border:1px dashed ${c.border2};font-size:13px;color:${c.ink2};line-height:1.5">Areas that share no nodes are drawn separately. They join into one map automatically when a route passes through both — for example, <b style="color:${c.ink};font-weight:500">Differential expression</b> would link the first two.</div>
      </div>
      <aside style="display:flex;flex-direction:column;gap:14px">
        ${card(`<span style="font-size:15px;font-weight:600">Due for review</span>
          ${[['Gene expression', 'Sequencing and quantification'], ['Hypothesis tests', 'Statistics for biologists']].map(([n, m]) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid ${c.border}">${dot('stale')}<div style="display:flex;flex-direction:column"><span style="font-size:14px">${n}</span><span style="font-size:12px;color:${c.ink3}">${m}</span></div></div>`).join('')}
          <div>${secondary(c, 'Review these now')}</div>`)}
        ${card(`<span style="font-size:15px;font-weight:600">Problems solved</span>
          ${[['Count k-mers in a read set', 'rung 2'], ['Parse a FASTQ record', 'rung 1'], ['Threshold a nucleus image', 'rung 2'], ['Reads per transcript', 'weekly · week 36']].map(([n, m]) => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid ${c.border};font-size:13.5px"><span>${n}</span><span style="font-size:12px;color:${c.ink3}">${m}</span></div>`).join('')}`)}
        ${card(`<span style="font-size:15px;font-weight:600">Placement history</span><span style="font-size:13px;color:${c.ink2};line-height:1.5">Learn Salmon · 3 Sep · tested out of 3 nodes<br>Statistics for biologists · 28 Aug · tested out of 2</span><a style="font-size:13px;font-weight:500">Re-take for one area</a>`)}
      </aside>
    </div>
  </main>`);
}
// ── account menu ────────────────────────────────────────────────
function account() {
  const item = (s, extra = '') => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:8px;font-size:14px">${s}${extra}</div>`;
  return `${head(c)}
<div style="width:320px;height:420px;background:${c.bg};padding:16px;font-family:${UI};color:${c.ink}">
  <div style="${panel(c)};box-shadow:${c.float};padding:8px;display:flex;flex-direction:column">
    <div style="padding:10px 14px 12px;border-bottom:1px solid ${c.border};display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">[Learner name]</span><span style="font-size:12.5px;color:${c.ink3}">[email]</span></div>
    ${item('Your knowledge')}${item('Solved problems')}${item('Your routes')}
    <div style="height:1px;background:${c.border};margin:4px 0"></div>
    ${item('Theme', `<span style="font-size:12.5px;color:${c.ink3}">Follow system</span>`)}${item('Settings')}
    <div style="height:1px;background:${c.border};margin:4px 0"></div>
    ${item('Open Studio', `<span style="font-size:11.5px;color:${c.ink3}">team only</span>`)}${item('Sign out')}
  </div>
</div>
${foot}`;
}

// ── Studio shell ────────────────────────────────────────────────
const NAV_ICON = {
  Inbox: 'M2.5 9.5h3l1 2h3l1-2h3M3.5 3.5h9l1 6v3h-11v-3z',
  Requests: 'M4 14V2.5M4 3h8l-2 3 2 3H4',
  Implementing: 'M3 13l7-7M9 3l4 4-2 2-4-4zM2.5 13.5l1.5-1.5',
  Review: 'M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13zM5 8l2 2 4-4',
  Graph: 'M4 4.5a1.5 1.5 0 1 0 0-.01M12 4.5a1.5 1.5 0 1 0 0-.01M8 12.5a1.5 1.5 0 1 0 0-.01M5.3 4h5.4M4.8 5.3l2.4 5.4M11.2 5.3l-2.4 5.4',
  Tracks: 'M2 8h12M4 8a1.8 1.8 0 1 0 0-.01M12 8a1.8 1.8 0 1 0 0-.01M8 8a1.8 1.8 0 1 0 0-.01',
  Weekly: 'M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3',
  Skeletons: 'M3 2.5h10M3 6h6M3 9.5h8M3 13h5M12.5 9l1.5 1.5-3 3H9.5V12z',
  Quality: 'M3 13.5V9M8 13.5V4M13 13.5V7M2 13.5h12',
  Assistant: 'M2.5 3h11v7.5h-6l-3.2 2.7v-2.7H2.5zM5.5 6.8h5',
  AI: 'M2.5 11.5a5.5 5.5 0 1 1 11 0M8 11.5l2.8-3.2M2.5 11.5h1.5M12 11.5h1.5',
  Library: 'M3 2.5h7a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2zM3 11.5a2 2 0 0 1 2-2h7',
  Team: 'M6 7a2.3 2.3 0 1 0 0-.01M1.8 13.5c.6-2.3 2.2-3.5 4.2-3.5s3.6 1.2 4.2 3.5M11 6.5a2 2 0 1 0 0-.01M11.5 9.8c1.4.2 2.4 1.3 2.8 3.2',
};
const navIcon = (n, col) => `<svg width="18" height="18" viewBox="0 0 16 16"><path d="${NAV_ICON[n]}" style="fill:none;stroke:${col};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"></path></svg>`;
function studio(active, inner, w = 1440, h = 900, { collapsed = false } = {}) {
  const groups = [['Work', [['Inbox', 6], ['Assistant'], ['Requests', 4], ['Implementing', 5], ['Review', 3]]], ['Content', [['Graph'], ['Skeletons', 12], ['Tracks', 2], ['Weekly']]], ['Insight', [['Quality', 3]]]];
  const it = (n, count) => `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;font-size:14px;${n === active ? `background:${c.surface};border:1px solid ${c.border};font-weight:600` : `border:1px solid transparent;color:${c.ink2}`}">${navIcon(n, n === active ? c.ink : c.ink3)}<span style="flex:1">${n}</span>${count ? `<span style="font-size:11.5px;padding:0 7px;border-radius:999px;background:${n === active ? c.selSoft : c.bg};color:${n === active ? c.sel : c.ink3}">${count}</span>` : ''}</div>`;
  const icn = (n, count) => `<div title="${n}" style="position:relative;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;${n === active ? `background:${c.surface};border:1px solid ${c.border}` : 'border:1px solid transparent'}">${navIcon(n, n === active ? c.ink : c.ink3)}${count ? `<span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:${c.sel};border:2px solid ${c.bg}"></span>` : ''}</div>`;
  const toggle = (dir) => `<span title="${dir === 'in' ? 'Collapse' : 'Expand'} the menu · [" style="width:28px;height:28px;border-radius:8px;border:1px solid ${c.border};background:${c.surface};display:flex;align-items:center;justify-content:center;color:${c.ink2}"><svg width="14" height="14" viewBox="0 0 16 16"><path d="${dir === 'in' ? 'M10 3.5L5.5 8 10 12.5' : 'M6 3.5L10.5 8 6 12.5'}" style="fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"></path></svg></span>`;
  const nav = collapsed
    ? `<nav style="width:64px;flex:none;display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0;border-right:1px solid ${c.border}">
      ${toggle('out')}
      ${groups.map(([, items], gi) => `${gi ? `<span style="width:24px;height:1px;background:${c.border}"></span>` : ''}<div style="display:flex;flex-direction:column;gap:4px">${items.map(([n, k]) => icn(n, k)).join('')}</div>`).join('')}
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:4px">${icn('AI')}${icn('Library')}${icn('Team')}</div>
    </nav>`
    : `<nav style="width:210px;flex:none;display:flex;flex-direction:column;gap:16px;padding:14px 14px 18px;border-right:1px solid ${c.border}">
      <div style="display:flex;justify-content:flex-end">${toggle('in')}</div>
      ${groups.map(([g, items]) => `<div style="display:flex;flex-direction:column;gap:2px"><span style="${label(c)};padding:0 10px 6px">${g}</span>${items.map(([n, k]) => it(n, k)).join('')}</div>`).join('')}
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:2px">${it('AI')}${it('Library')}${it('Team')}</div>
    </nav>`;
  return `${head(c)}
<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;background:${c.bg};color:${c.ink};font-family:${UI};overflow:hidden">
  <header style="height:60px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid ${c.border}">
    <div style="display:flex;align-items:center;gap:12px">${logo(c, 'Comeni Code')}<span style="padding:2px 10px;border-radius:6px;background:${c.ink};color:${c.bg};font-size:12px;font-weight:600">Studio</span></div>
    <div style="display:flex;align-items:center;gap:10px;width:420px;height:36px;padding:0 14px;border-radius:10px;border:1px solid ${c.border2};background:${c.surface};color:${c.ink3};font-size:13.5px">${ic.search}Find a node, request or track</div>
    <div style="display:flex;align-items:center;gap:12px">${secondary(c, 'Back to Learn')}${avatar}</div>
  </header>
  <div style="flex:1;display:flex;min-height:0">
    ${nav}
    <main style="flex:1;display:flex;flex-direction:column;gap:16px;padding:22px 26px;min-width:0;min-height:0">${inner}</main>
  </div>
</div>
${foot}`;
}
const btnRow = (...b) => `<div style="display:flex;gap:8px;flex-wrap:wrap">${b.join('')}</div>`;
const titleRow = (t, sub, right = '') => `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px"><div style="display:flex;flex-direction:column;gap:4px">${h1(t, 26)}<span style="font-size:13.5px;color:${c.ink2}">${sub}</span></div>${right}</div>`;

// ── shared: queue building blocks (facets, views, dense rows, bulk bar) ──
const qFacet = (title, opts, open = true) => `<div style="display:flex;flex-direction:column;gap:2px;padding:10px 0;border-top:1px solid ${c.border}">
  <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">${title}</span><span style="color:${c.ink3}">${ic.chevron}</span></div>
  ${open ? opts.map(([n, k, on]) => `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px"><span style="width:15px;height:15px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;${on ? `background:${c.sel}` : `border:1.5px solid ${c.border2}`}">${on ? ic.check('#FFFFFF') : ''}</span><span style="flex:1">${n}</span><span style="font-size:11.5px;color:${c.ink3};font-variant-numeric:tabular-nums">${k}</span></div>`).join('') : ''}</div>`;
const qViews = (items) => `<div style="display:flex;gap:2px;border-bottom:1px solid ${c.border}">${items.map(([n, k, on]) => `<span style="display:flex;align-items:center;gap:7px;padding:9px 14px;font-size:13.5px;${on ? `color:${c.ink};font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${n}<span style="font-size:11.5px;padding:0 7px;border-radius:999px;background:${on ? c.ink : c.bg};color:${on ? c.bg : c.ink3};font-variant-numeric:tabular-nums">${k}</span></span>`).join('')}<span style="display:flex;align-items:center;padding:9px 12px;font-size:13px;color:${c.sel}">+ Save view</span></div>`;
const qChip = (s) => `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 5px 3px 10px;border-radius:999px;background:${c.selSoft};color:${c.sel};font-size:12px;font-weight:500">${s}<span style="display:flex">${ic.close}</span></span>`;
const qBox = (on) => `<span style="width:15px;height:15px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;${on ? `background:${c.sel}` : `border:1.5px solid ${c.border2}`}">${on ? ic.check('#FFFFFF') : ''}</span>`;
const qSearch = (ph, w = 300) => `<div style="display:flex;align-items:center;gap:8px;width:${w}px;height:34px;padding:0 12px;border-radius:9px;border:1px solid ${c.border2};background:${c.surface};font-size:13px;color:${c.ink3}">${ic.search}${ph}</div>`;
const qSort = (s) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;border:1px solid ${c.border2};background:${c.surface};font-size:12.5px"><span style="color:${c.ink3}">Sort</span>${s}${ic.chevron}</span>`;
const kbd = (k) => `<span style="font-family:${MONO};font-size:11px;padding:1px 6px;border-radius:5px;border:1px solid ${c.border2};background:${c.bg};color:${c.ink2}">${k}</span>`;
const bulkBar = (n, actions) => `<div style="position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:10px 12px 10px 18px;border-radius:12px;background:${c.ink};color:${c.bg};box-shadow:${c.float};white-space:nowrap">
  <span style="font-size:13.5px;font-weight:600">${n} selected</span><span style="width:1px;height:20px;background:rgba(255,255,255,.25)"></span>
  ${actions.map(([a, k]) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:8px;background:rgba(255,255,255,.1);font-size:13px">${a}${k ? `<span style="font-family:${MONO};font-size:10.5px;opacity:.7">${k}</span>` : ''}</span>`).join('')}
  <span style="font-size:12.5px;opacity:.7;padding:0 4px">Clear</span></div>`;

// ── S7 Requests — a triage queue ────────────────────────────────
function requests() {
  const cols = '26px 20px minmax(0, 1.25fr) minmax(0, 1.35fr) 110px 62px 62px 48px';
  const typeIcon = (t) => t === 'goal'
    ? `<span title="Goal" style="width:18px;height:18px;border-radius:50%;border:2px solid ${c.ink2};display:flex;align-items:center;justify-content:center"><span style="width:6px;height:6px;border-radius:50%;background:${c.ink2}"></span></span>`
    : `<span title="Missing node" style="width:18px;height:18px;border-radius:50%;border:2px dashed ${c.ink3}"></span>`;
  const rows = [
    ['node', 'Selective alignment', 'New node · needs Sequence alignment, k-mers', 'Quantification', 23, 3, '4 d', { focus: 1 }],
    ['group', 'Annotation files (GTF/GFF)', 'One new node · 4 requests grouped', 'Reference', 11, 4, '2 d', { sel: 1, group: '“GTF files” +3 similar' }],
    ['node', 'Unique molecular identifiers', 'New node · needs Sequencing reads', 'Single-cell', 9, 2, '3 d', { sel: 1 }],
    ['group', 'Expression units: TPM and counts', 'One new node · 3 requests grouped', 'Quantification', 5, 2, '6 d', { group: '“TPM” +2 similar' }],
    ['node', 'Batch effects', 'Merge into Experimental design?', 'Statistics', 7, 1, '12 d', { merge: 1 }],
    ['node', 'Phasing', 'New node · needs Calling variants', 'Variants', 4, 1, '9 d', { sel: 1 }],
    ['goal', '“learn DESeq2”', 'Already a track · Differential expression with DESeq2', 'Statistics', 14, 0, '1 h', { existing: 1 }],
    ['goal', '“kallisto”', 'New target node · similar to Salmon', 'Quantification', 12, 0, '2 d'],
    ['goal', '“why do my reads not map”', 'Weave from existing · Sequence alignment + Quality and trimming', 'Alignment', 8, 0, '1 d', { existing: 1 }],
    ['goal', '“nanopore basecalling”', 'New target node · no region yet', '—', 6, 0, '5 h'],
    ['goal', '“CRISPR screen analysis”', 'Needs 6 new nodes · propose as a set', '—', 3, 0, '3 d'],
    ['node', 'Soft clipping', 'Merge into BAM and CIGAR?', 'Alignment', 2, 0, '20 d', { merge: 1 }],
    ['node', 'Mapping quality', 'New node · needs Sequence alignment', 'Alignment', 2, 0, '8 d'],
  ];
  const row = ([t, title, prop, region, asked, blocks, age, o = {}]) => `<div style="display:grid;grid-template-columns:${cols};align-items:center;gap:10px;padding:0 14px;height:44px;border-top:1px solid ${c.border};font-size:13px;${o.focus ? `background:${c.selSoft};box-shadow:inset 3px 0 0 ${c.sel}` : o.sel ? `background:${c.bg}` : ''}">
    ${qBox(o.sel)}${typeIcon(t === 'group' ? 'node' : t)}
    <div style="display:flex;flex-direction:column;min-width:0"><span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>${o.group ? `<span style="font-size:11.5px;color:${c.ink3}">${o.group}</span>` : ''}</div>
    <span style="color:${o.merge ? c.meas : o.existing ? c.btn : c.ink2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prop}</span>
    <span style="color:${c.ink2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${region}</span>
    <span style="text-align:right;font-variant-numeric:tabular-nums">${asked}</span>
    <span style="text-align:right;font-variant-numeric:tabular-nums;${blocks ? `color:${c.ink};font-weight:600` : `color:${c.ink3}`}">${blocks || '—'}</span>
    <span style="text-align:right;color:${c.ink3};font-variant-numeric:tabular-nums">${age}</span></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('Requests', 26)}<span style="font-size:13px;color:${c.ink2}">Nothing moves to Implementing until a person decides. The model only suggests and groups.</span></div>
      ${qSearch('Search requests, nodes, learners’ words')}
    </div>
    ${qViews([['Needs triage', 47, 1], ['Blocking routes', 21], ['Duplicates to merge', 9], ['Snoozed', 5], ['Decided this week', 18]])}
    <div style="flex:1;display:grid;grid-template-columns:200px minmax(0, 1fr) 340px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;justify-content:space-between;padding-bottom:6px"><span style="font-size:13.5px;font-weight:600">Filters</span><a style="font-size:12px;font-weight:500">Clear</a></div>
        ${qFacet('Type', [['Missing node', 29], ['Goal', 18]])}
        ${qFacet('Blocks a route', [['Yes', 21], ['No', 26]])}
        ${qFacet('Asked by', [['10 or more', 6], ['3–9 learners', 17], ['1–2 learners', 24]])}
        ${qFacet('Model suggests', [['A new node', 30], ['Existing nodes', 8], ['A merge', 9]])}
        ${qFacet('Region', [['Quantification', 11], ['Alignment', 8], ['Variants', 6], ['Single-cell', 5], ['Statistics', 5], ['+ 3 more', '']])}
        ${qFacet('Waiting', [['Under a week', 19], ['Over a week', 28]], false)}
      </aside>
      <section style="position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:600">47 requests</span><span style="font-size:12.5px;color:${c.ink3}">no filters</span></div>
          <div style="display:flex;gap:8px;align-items:center">${qSort('Routes unblocked, then learners')}${seg(c, ['Flat', 'Group by region'], 0)}</div>
        </div>
        <div style="${panel(c)};overflow:hidden;flex:1;min-height:0">
          <div style="display:grid;grid-template-columns:${cols};gap:10px;padding:9px 14px;font-size:11.5px;color:${c.ink3}">
            ${qBox(false)}<span></span><span>Request</span><span>Model suggests</span><span>Region</span><span style="text-align:right">Asked</span><span style="text-align:right">Blocks</span><span style="text-align:right">Wait</span></div>
          ${rows.map(row).join('')}
          <div style="padding:10px 14px;border-top:1px solid ${c.border};font-size:12.5px;color:${c.ink3}">34 more · keep scrolling</div>
        </div>
        ${bulkBar(3, [['Accept', '1'], ['Merge into…', '2'], ['Decline…', '3'], ['Snooze', 'H'], ['Assign region', '']])}
      </section>
      <aside style="${panel(c)};padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center">${greyTag('Missing node')}<span style="font-size:12px;color:${c.ink3}">waiting 4 days</span></div>
        <span style="font-size:19px;font-weight:600">Selective alignment</span>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px">
          <div style="padding:8px 10px;border-radius:8px;background:${c.bg}"><span style="font-size:18px;font-weight:600">3</span><span style="display:block;font-size:11.5px;color:${c.ink2}">routes blocked</span></div>
          <div style="padding:8px 10px;border-radius:8px;background:${c.bg}"><span style="font-size:18px;font-weight:600">23</span><span style="display:block;font-size:11.5px;color:${c.ink2}">learners waiting</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:9px;border:1px solid ${c.border}">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:600">Model suggests</span>${amberTag('unchecked')}</div>
          <span style="font-size:13px;line-height:1.5;color:${c.ink2}">Claim: <i>“Explain how Salmon places a read on the transcripts it could come from without a full alignment.”</i></span>
          <span style="font-size:13px;color:${c.ink2}">Needs, all of: ${mono('Sequence alignment')}, ${mono('k-mers')}</span>
          <span style="font-size:12.5px;color:${c.ink3}">No similar node found.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px"><span style="font-size:12.5px;font-weight:600">Blocked routes</span>
          ${['Learn Salmon · 41 learners', 'Quantify my RNA-seq · 9', 'Single-cell basics · 6'].map(r => `<span style="font-size:12.5px;color:${c.ink2};padding:5px 9px;border-radius:7px;background:${c.bg}">${r}</span>`).join('')}</div>
        <div style="display:flex;flex-direction:column;gap:5px"><span style="font-size:12.5px;font-weight:600">Note for the record</span>
          <div style="height:54px;border-radius:8px;border:1px solid ${c.border2};padding:8px;font-size:12.5px;color:${c.ink3}">Why — shown to learners if declined</div></div>
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">${primary(c, 'Accept')}${secondary(c, 'Merge…')}${secondary(c, 'Decline…')}${secondary(c, 'Snooze')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:${c.ink3}"><span>${kbd('1')} accept</span><span>${kbd('2')} merge</span><span>${kbd('3')} decline</span><span>${kbd('H')} snooze</span><span>${kbd('J')} ${kbd('K')} next / previous</span></div>
        </div>
      </aside>
    </div>`;
  return studio('Requests', inner, 1680, 1000);
}

// ── S8 Implementing — grouped by stage, built for dozens ────────
function implementing() {
  const cols = '26px minmax(0, 1.4fr) 120px 70px 62px 150px 130px 110px';
  const av = (n) => n ? `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:22px;border-radius:50%;background:${c.selSoft};color:${c.sel};font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center">${n.replace(/[^A-Z]/g, '')}</span>[${n}]</span>` : `<span style="color:${c.open};font-weight:500">Unassigned</span>`;
  const row = ([n, region, unb, asked, who, last, next, o = {}]) => `<div style="display:grid;grid-template-columns:${cols};align-items:center;gap:10px;padding:0 14px;height:42px;border-top:1px solid ${c.border};font-size:13px;${o.sel ? `background:${c.bg}` : ''}">
    ${qBox(o.sel)}
    <div style="display:flex;align-items:center;gap:8px;min-width:0"><span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span>${o.stalled ? amberTag('No change in 16 d') : ''}</div>
    <span style="color:${c.ink2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${region}</span>
    <span style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${unb}</span>
    <span style="text-align:right;color:${c.ink2};font-variant-numeric:tabular-nums">${asked}</span>
    <span style="font-size:12.5px;white-space:nowrap">${av(who)}</span>
    <span style="color:${c.ink3};font-size:12.5px">${last}</span>
    <span style="display:flex;justify-content:flex-end">${next}</span></div>`;
  const group = (name, count, rows, more, open = true) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-top:1px solid ${c.border};background:${c.bg}">
    <span style="color:${c.ink3};display:flex;${open ? '' : 'transform:rotate(-90deg)'}">${ic.chevron}</span><span style="font-size:13px;font-weight:600">${name}</span><span style="font-size:12px;color:${c.ink3}">${count}</span></div>
    ${open ? rows.map(row).join('') + (more ? `<div style="padding:8px 14px 8px 50px;border-top:1px solid ${c.border};font-size:12.5px;color:${c.sel}">Show ${more} more</div>` : '') : ''}`;
  const load = (n, writing, review, note) => `<div style="display:flex;flex-direction:column;gap:5px;padding:9px 0;border-top:1px solid ${c.border}">
    <div style="display:flex;justify-content:space-between;font-size:13px"><span style="font-weight:500">[${n}]</span><span style="color:${note ? c.meas : c.ink3};font-size:12px">${note || `${writing + review} active`}</span></div>
    <div style="display:flex;gap:2px">${Array.from({ length: 6 }, (_, i) => `<span style="flex:1;height:6px;border-radius:2px;background:${i < writing ? c.sel : i < writing + review ? c.line : c.border2}"></span>`).join('')}</div></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('Implementing', 26)}<span style="font-size:13px;color:${c.ink2}">Accepted requests until they land. Ordered by what unblocks most — no due dates.</span></div>
      ${qSearch('Search nodes, people')}
    </div>
    ${qViews([['All', 38, 1], ['Unassigned', 9], ['Mine', 6], ['Waiting for review', 7], ['Stalled', 4]])}
    <div style="flex:1;display:grid;grid-template-columns:200px minmax(0, 1fr) 280px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;justify-content:space-between;padding-bottom:6px"><span style="font-size:13.5px;font-weight:600">Filters</span><a style="font-size:12px;font-weight:500">Clear</a></div>
        ${qFacet('Stage', [['Accepted', 9], ['Writing', 14], ['In review', 7], ['Ready to land', 4], ['Landed (7 d)', 4]])}
        ${qFacet('Who', [['Unassigned', 9], ['[Author A]', 6], ['[Author B]', 5], ['[Author C]', 8], ['+ 2 more', '']])}
        ${qFacet('Blocks routes', [['3 or more', 6], ['1–2', 19], ['None', 13]])}
        ${qFacet('Region', [['Quantification', 9], ['Alignment', 7], ['Variants', 6], ['+ 5 more', '']])}
        ${qFacet('Activity', [['Stalled (14 d+)', 4], ['Changed this week', 22]], false)}
      </aside>
      <section style="position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <span style="font-size:13.5px;font-weight:600">38 nodes</span>
          <div style="display:flex;gap:8px;align-items:center">${qSort('Routes unblocked')}${seg(c, ['Group by stage', 'Flat'], 0)}</div>
        </div>
        <div style="${panel(c)};overflow:hidden;flex:1;min-height:0">
          <div style="display:grid;grid-template-columns:${cols};gap:10px;padding:9px 14px;font-size:11.5px;color:${c.ink3}">${qBox(false)}<span>Node</span><span>Region</span><span style="text-align:right">Unblocks</span><span style="text-align:right">Asked</span><span>Who</span><span>Last change</span><span></span></div>
          ${group('Accepted · needs someone', 9, [
            ['Annotation files (GTF/GFF)', 'Reference', 4, 11, '', 'accepted 2 d ago', secondary(c, 'Assign'), { sel: 1 }],
            ['Selective alignment', 'Quantification', 3, 23, '', 'accepted today', secondary(c, 'Assign'), { sel: 1 }],
            ['Unique molecular identifiers', 'Single-cell', 2, 9, '', 'accepted 1 d ago', secondary(c, 'Assign')],
          ], 6)}
          ${group('Writing', 14, [
            ['Expression units: TPM and counts', 'Quantification', 2, 5, 'Author A', 'explanation drafted · 1 d', secondary(c, 'Open')],
            ['Phasing', 'Variants', 1, 4, 'Author C', 'claim approved · 16 d', secondary(c, 'Open'), { stalled: 1 }],
            ['kallisto', 'Quantification', 1, 12, 'Author B', 'figure checks · 3 h', secondary(c, 'Open')],
          ], 11)}
          ${group('In review', 7, [
            ['Splice junctions', 'Alignment', 4, 3, 'Author A', 'with [Reviewer B] · 3 d', secondary(c, 'Review', c.sel)],
            ['Mapping quality', 'Alignment', 1, 2, 'Author D', 'with [Reviewer A] · 1 d', secondary(c, 'Review', c.sel)],
          ], 5)}
          ${group('Ready to land', 4, [], 0, false)}
          ${group('Landed in the last 7 days', 4, [], 0, false)}
        </div>
        ${bulkBar(2, [['Assign to…', 'A'], ['Move to region…', ''], ['Back to Requests', '']])}
      </section>
      <aside style="display:flex;flex-direction:column;gap:14px">
        ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:14.5px;font-weight:600">Team load</span><span style="font-size:11.5px;color:${c.ink3}">writing · reviewing</span></div>
          ${load('Author A', 3, 2)}${load('Author B', 2, 1)}${load('Author C', 5, 1, 'busiest')}${load('Author D', 1, 0)}${load('Reviewer A', 0, 3)}${load('Reviewer B', 0, 1, 'has room')}
          <span style="font-size:12px;color:${c.ink3};line-height:1.45">Assigning suggests people with room and matching expertise. Nobody reviews their own node.</span>`)}
        ${card(`<span style="font-size:14.5px;font-weight:600">This week</span>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px">
            <div><span style="font-size:20px;font-weight:600">4</span><span style="display:block;font-size:12px;color:${c.ink2}">landed</span></div>
            <div><span style="font-size:20px;font-weight:600">7</span><span style="display:block;font-size:12px;color:${c.ink2}">routes unblocked</span></div>
          </div>`)}
      </aside>
    </div>`;
  return studio('Implementing', inner, 1680, 1000);
}
// ── S9 Weave review — texts pinned where learners will read them ─
function weaveReview() {
  const pins = [
    [1, 210, 222, 'ok'], [2, 205, 290, 'ok'], [3, 430, 290, 'ok'], [4, 390, 150, 'wait'], [5, 430, 212, 'wait'], [6, 598, 113, 'flag'],
    [7, 390, 430, 'sel'], [8, 432, 366, 'wait'], [9, 615, 150, 'wait'], [10, 610, 290, 'wait'], [11, 830, 290, 'wait'],
  ];
  const pin = ([n, x, y, st]) => {
    if (st === 'sel') return `<circle cx="${x}" cy="${y}" r="21" style="fill:none;stroke:${c.sel};stroke-width:2;stroke-dasharray:3 3"></circle><circle cx="${x}" cy="${y}" r="14" style="fill:${c.sel}"></circle><text x="${x}" y="${y + 5}" text-anchor="middle" style="font-family:${MONO};font-size:13px;font-weight:600;fill:#FFFFFF">${n}</text>`;
    const f = st === 'ok' ? c.line : st === 'flag' ? c.measBar : c.surface;
    const s = st === 'ok' ? c.line : st === 'flag' ? c.measBar : c.sel;
    const t = st === 'wait' ? c.sel : '#FFFFFF';
    return `<circle cx="${x}" cy="${y}" r="11" style="fill:${f};stroke:${s};stroke-width:2"></circle><text x="${x}" y="${y + 4}" text-anchor="middle" style="font-family:${MONO};font-size:11px;font-weight:600;fill:${t}">${st === 'ok' ? '✓' : n}</text>`;
  };
  const map = routeMetro({ sel: null }).replace(/<\/svg>$/, pins.map(pin).join('') + '</svg>');
  const chipRow = (label, items) => `<div style="display:flex;align-items:center;gap:10px"><span style="width:112px;flex:none;font-size:12.5px;font-weight:600">${label}</span><div style="display:flex;gap:5px;flex-wrap:wrap">${items.map(([t, st]) => {
    const sty = st === 'ok' ? `background:${c.line};color:#FFFFFF` : st === 'flag' ? `background:${c.measBar};color:#FFFFFF` : st === 'sel' ? `background:${c.sel};color:#FFFFFF;box-shadow:0 0 0 3px ${c.selSoft}` : `border:1.5px solid ${c.border2};color:${c.ink2}`;
    return `<span style="min-width:26px;height:26px;padding:0 6px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:11.5px;font-weight:600;${sty}">${st === 'ok' ? '✓' : t}</span>`;
  }).join('')}</div></div>`;
  const claimCard = (k, n, s) => `<div style="flex:1;display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:9px;background:${c.bg};border:1px solid ${c.border}"><span style="font-size:11px;color:${c.ink3}">${k}</span><span style="font-size:13.5px;font-weight:600">${n}</span><span style="font-size:12.5px;color:${c.ink2};line-height:1.45">${s}</span></div>`;
  const check = (ok, t, d) => `<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 10px;border-radius:8px;${ok ? '' : `background:${c.measSoft}`}"><span style="margin-top:1px;color:${ok ? c.ink2 : c.meas}">${ok ? ic.check(c.ink2) : ic.close}</span><div style="display:flex;flex-direction:column"><span style="font-size:13px;font-weight:600;color:${ok ? c.ink : c.meas}">${t}</span>${d ? `<span style="font-size:12px;color:${c.ink2}">${d}</span>` : ''}</div></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:center;gap:14px">
        ${h1('Weave review', 26)}
        <span style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9px;border:1px solid ${c.border2};background:${c.surface};font-size:14px;font-weight:600">Learn Salmon ${ic.chevron}</span>
        <span style="font-size:13px;color:${c.ink2}">41 learners on this route · 2 more routes waiting</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <div style="display:flex;flex-direction:column;gap:4px;width:220px"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="font-weight:600">6 of 24 checked</span><span style="color:${c.meas}">1 flagged</span></div>
          <div style="display:flex;gap:2px">${Array.from({ length: 24 }, (_, i) => `<span style="flex:1;height:6px;border-radius:2px;background:${i < 6 ? c.line : i === 6 ? c.measBar : c.border2}"></span>`).join('')}</div></div>
        <span title="Check every text first" style="padding:9px 16px;border-radius:10px;background:${c.border};color:${c.ink3};font-size:13.5px;font-weight:600">Publish as a named track</span>
      </div>
    </div>
    <div style="padding:10px 14px;border-radius:10px;background:${c.bg};font-size:13px;color:${c.ink2};line-height:1.5">
      <b style="color:${c.ink};font-weight:600">What you’re checking:</b> the short texts the AI wrote to connect this route’s pages. Each number sits where learners read it. A text may only use the claims of the pages it joins and the learner’s goal — the pages themselves were reviewed already.
    </div>
    <div style="flex:1;display:grid;grid-template-columns:minmax(0, 1fr) 470px;gap:18px;min-height:0">
      <section style="display:flex;flex-direction:column;gap:12px;min-width:0">
        <div style="${panel(c)};display:flex;flex-direction:column;min-height:0">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid ${c.border}">
            <span style="font-size:14px;font-weight:600">As the learner sees it</span>
            <div style="display:flex;gap:10px;align-items:center">${seg(c, ['Route map', 'Route page', 'A node’s top band'], 0)}</div>
          </div>
          <div style="padding:8px 16px;${gridBg(c)}">${map}</div>
          <div style="display:flex;gap:16px;padding:8px 16px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink2}">
            <span style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:50%;background:${c.line}"></span>Approved</span>
            <span style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:50%;border:2px solid ${c.sel}"></span>To check</span>
            <span style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:50%;background:${c.measBar}"></span>Flagged by a check</span>
            <span>Numbers on a line are bridges; the introduction and each page’s band are listed below.</span>
          </div>
        </div>
        <div style="${panel(c)};padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          ${chipRow('Introduction', [['I', 'ok']])}
          ${chipRow('Bridges', [[1, 'ok'], [2, 'ok'], [3, 'ok'], [4], [5], [6, 'flag'], [7, 'sel'], [8], [9], [10], [11]])}
          ${chipRow('Page bands', [[1, 'ok'], [2, 'ok'], [3], [4], [5], [6], [7], [8], [9], [10], [11], [12]])}
        </div>
      </section>
      <aside style="${panel(c)};padding:18px;display:flex;flex-direction:column;gap:14px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="${label(c)}">Bridge 7 of 11</span>
          <div style="display:flex;gap:6px;align-items:center;font-size:12px;color:${c.ink3}">${kbd('K')} previous ${kbd('J')} next</div>
        </div>
        <span style="font-size:13px;color:${c.ink2}">Shown on the route between these two stops, and at the top of <b style="color:${c.ink};font-weight:600">de Bruijn graphs</b> for learners arriving from k-mers.</span>
        <div style="display:flex;gap:8px;align-items:stretch">${claimCard('From', 'k-mers', 'Break a sequence into its k-mers and count them.')}<span style="align-self:center;color:${c.ink3}">${ic.arrow}</span>${claimCard('To', 'de Bruijn graphs', 'Build a de Bruijn graph from reads and read a sequence off it.')}</div>
        <span style="font-size:12px;color:${c.ink3}">Goal: ${mono('Salmon')} · the text may use only these</span>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">The text</span><span style="font-size:11.5px;color:${c.ink3}">AI draft · prompt route.bridge@v2</span></div>
          <div style="padding:12px 14px;border-radius:10px;border:1.5px solid ${c.border2};font-size:15px;line-height:1.6">You can now split any read into k-mers. Join the k-mers that overlap by k−1 letters and <span style="background:${c.measSoft};border-bottom:2px dotted ${c.measBar}">most modern assemblers</span> get their graph — that graph is the next stop.</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          ${check(false, 'Uses only the two claims and the goal', '“most modern assemblers” isn’t in either claim — cut it or cite it on the page')}
          ${check(true, 'Says what you have and what comes next')}
          ${check(true, 'Short enough', '31 words · limit 45')}
          ${check(true, 'Makes sense without the route around it')}
        </div>
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid ${c.border}">
          <div style="display:flex;gap:8px;flex-wrap:wrap">${primary(c, 'Approve')}${secondary(c, 'Suggest an edit')}${secondary(c, 'Ask for a rewrite')}</div>
          <div style="display:flex;gap:12px;font-size:11.5px;color:${c.ink3}"><span>${kbd('A')} approve</span><span>${kbd('E')} edit</span><span>${kbd('R')} rewrite</span><span>Approving a flagged text needs a note.</span></div>
        </div>
      </aside>
    </div>`;
  return studio('Tracks', inner, 1680, 1040, { collapsed: true });
}

// ── S3 Node workbench — CMS editing: outline · blocks · side panels ─
function workbench() {
  const outline = [['claim', 'What you’ll be able to do', 'ok', 0, '4.6'], ['resource', 'Video · genome assembly', 'draft', 0, '4.1'], ['text', 'The problem it solves', 'ok', 0, '4.4'], ['figure', 'read-tiling', 'ok', 0, '4.8'], ['text', 'From reads to k-mers', 'warn', 1, '2.9'], ['figure', 'kmer-window', 'bad', 0, '—'], ['try', 'How many 5-mers…', 'draft', 0, '3.8'], ['text', 'Building the graph', 'ok', 0, '4.3'], ['try', 'Follow the green path', 'ok', 0, '4.5'], ['math', 'Formal definition', 'ok', 0, '4.7'], ['text', 'Two conventions', 'ok', 0, '4.2'], ['figure', 'compare-graphs', 'ok', 0, '4.6'], ['image', 'Assembly graph (Bandage)', 'warn', 0, '—'], ['example', 'Worked example', 'ok', 0, '4.9'], ['callout', 'Common mix-up', 'ok', 0, '4.0'], ['problem', 'Construct a de Bruijn graph', 'draft', 0, '3.4']];
  const scoreCol = (v) => v === '—' ? c.ink3 : parseFloat(v) < 3 ? c.open : parseFloat(v) < 4 ? c.meas : c.ink2;
  const stDot = (s) => `<span style="width:8px;height:8px;border-radius:50%;flex:none;${s === 'ok' ? `background:${c.ink3}` : s === 'warn' ? `background:${c.measBar}` : s === 'bad' ? `background:${c.open}` : `border:1.5px solid ${c.ink3}`}"></span>`;
  const blockHead = (type, title, state, open) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;${open ? `border-bottom:1px solid ${c.border}` : ''}">
    <span style="color:${c.ink3};font-size:13px;letter-spacing:-2px">⋮⋮</span>
    <span style="font-family:${MONO};font-size:11px;padding:1px 7px;border-radius:5px;background:${c.bg};border:1px solid ${c.border};color:${c.ink2}">${type}</span>
    <span style="font-size:13.5px;font-weight:${open ? 600 : 500};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span>${state}
    <span style="color:${c.ink3};display:flex;${open ? 'transform:rotate(180deg)' : ''}">${ic.chevron}</span></div>`;
  const collapsed = (type, title, state) => `<div style="border-radius:10px;border:1px solid ${c.border};background:${c.surface}">${blockHead(type, title, state)}</div>`;
  const adder = `<div style="display:flex;align-items:center;gap:8px;height:14px"><span style="flex:1;height:1px;background:${c.border}"></span><span style="width:20px;height:20px;border-radius:6px;border:1px solid ${c.border2};background:${c.surface};color:${c.sel};display:flex;align-items:center;justify-content:center;font-size:14px">+</span><span style="flex:1;height:1px;background:${c.border}"></span></div>`;
  const unsup = (s) => `<span style="background:${c.openSoft};border-bottom:2px dotted ${c.open}">${s}</span>`;
  const sup = (n) => `<sup style="font-family:${MONO};font-size:10px;color:${c.sel}">[${n}]</sup>`;
  const tb = (s) => `<span style="padding:3px 8px;border-radius:6px;font-size:12.5px;color:${c.ink2}">${s}</span>`;

  // live preview (learner renderer, scaled)
  const preview = `<div style="border-radius:10px;border:1px solid ${c.border};background:${c.bg};overflow:hidden">
    <div style="height:30px;display:flex;align-items:center;gap:6px;padding:0 10px;border-bottom:1px solid ${c.border};background:${c.surface}">${logo(c, '')}<span style="font-size:11px;color:${c.ink3}">de Bruijn graphs · preview of your draft</span></div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">
      <span style="font-size:24px;font-weight:600;letter-spacing:-.02em">de Bruijn graphs</span>
      <div style="padding:10px 12px;border-radius:9px;border:1.5px solid ${c.ink};background:${c.surface};font-size:12.5px;line-height:1.45">Build a de Bruijn graph from a set of reads, read sequences off it…</div>
      <span style="font-size:15px;font-weight:600">From reads to k-mers</span>
      <div style="position:relative;padding:8px 10px;margin:0 -10px;border-radius:8px;outline:2px dashed ${c.sel};background:${c.surface}">
        <span style="position:absolute;top:-10px;right:8px;padding:1px 7px;border-radius:5px;background:${c.sel};color:#FFFFFF;font-size:10.5px;font-weight:600">editing</span>
        <span style="font-size:12.5px;line-height:1.6;color:${c.ink2}">The trick is to stop treating reads as units. Slide a window of width k along each read and record every substring it covers… ${unsup('Every assembler since 2008 works this way.')}</span>
      </div>
      <div style="position:relative;border-radius:8px;border:1px solid ${c.border};background:${c.surface};padding:6px 10px;outline:1px dashed transparent">
        <span style="position:absolute;top:6px;right:8px;font-size:10.5px;color:${c.ink3}">click to edit</span>
        ${F.slider()}
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid ${c.border2};background:${c.surface};font-size:12.5px"><span style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${c.sel};color:${c.sel};font-family:${MONO};font-size:10px;display:flex;align-items:center;justify-content:center">1</span>How many 5-mers does a 100-base read contain?</div>
    </div></div>`;

  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;gap:4px">
        <span style="font-size:12.5px;color:${c.ink3}">Graph › Algorithms › de Bruijn graphs</span>
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:24px;font-weight:600">de Bruijn graphs</span>
          ${blueTag('Draft')}${levelTag('Intermediate')}<a style="font-size:12.5px">writing guide</a>
          <span style="font-size:12.5px;color:${c.ink3}">Saved 2 min ago · live version from 3 Sep</span>
          <span style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:${c.ink2}"><span style="width:22px;height:22px;border-radius:50%;background:${c.lineSoft};color:${c.btn};font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center">RB</span>[Reviewer B] is viewing</span>
        </div>
      </div>
      <div style="position:relative;display:flex;align-items:center;gap:8px">
        ${secondary(c, 'Open preview in a new tab')}
        <span style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;background:${c.btn};color:${c.btnInk};font-size:14px;font-weight:600;box-shadow:0 3px 0 ${c.btnSh}">Submit for review ${ic.chevron}</span>
        <div style="position:absolute;right:0;top:52px;z-index:2;width:340px;${panel(c)};box-shadow:${c.float};padding:14px;display:flex;flex-direction:column;gap:8px">
          <span style="font-size:13.5px;font-weight:600">Before you submit</span>
          ${[[1, 'Claim and needs approved'], [0, '1 sentence without a source', 'From reads to k-mers'], [0, 'Figure check failed', 'kmer-window · readable at phone width'], [0, 'Image needs a licence', 'Assembly graph (Bandage)'], [1, 'Every figure and image has alt text'], [1, 'Worked example recomputed']].map(([ok, t, d]) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px"><span style="margin-top:1px;color:${ok ? c.ink2 : c.open}">${ok ? ic.check(c.ink2) : ic.close}</span><div style="display:flex;flex-direction:column"><span style="font-weight:${ok ? 400 : 600};color:${ok ? c.ink2 : c.ink}">${t}</span>${d ? `<a style="font-size:12px">${d}</a>` : ''}</div></div>`).join('')}
          <span style="padding:8px 12px;border-radius:9px;background:${c.border};color:${c.ink3};font-size:13px;font-weight:600;text-align:center">Fix 3 items to submit</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:2px;border-bottom:1px solid ${c.border}">${[['Content', 1], ['Resources'], ['Exam pool'], ['Links'], ['Problem'], ['Settings']].map(([t, on]) => `<span style="padding:8px 16px;font-size:13.5px;${on ? `font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${t}</span>`).join('')}</div>
    <div style="flex:1;display:grid;grid-template-columns:230px minmax(0, 1fr) 520px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;gap:2px;min-height:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px"><span style="font-size:13px;font-weight:600">Outline</span><span style="font-size:11.5px;color:${c.ink3}">16 blocks · score</span></div>
        ${outline.map(([t, n, s, on, sc]) => `<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:7px;${on ? `background:${c.selSoft}` : ''}">${stDot(s)}<span style="font-family:${MONO};font-size:10.5px;color:${c.ink3};width:52px;flex:none">${t}</span><span style="font-size:12.5px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${on ? 600 : 400}">${n}</span><span style="font-family:${MONO};font-size:11px;color:${scoreCol(sc)};font-variant-numeric:tabular-nums">${sc}</span></div>`).join('')}
        <div style="display:flex;flex-direction:column;gap:4px;padding-top:10px;margin-top:6px;border-top:1px solid ${c.border};font-size:11.5px;color:${c.ink2}">
          <span style="display:flex;align-items:center;gap:6px">${stDot('ok')}checked</span><span style="display:flex;align-items:center;gap:6px">${stDot('draft')}draft</span>
          <span style="display:flex;align-items:center;gap:6px">${stDot('warn')}needs attention</span><span style="display:flex;align-items:center;gap:6px">${stDot('bad')}check failed</span>
          <span style="color:${c.ink3};line-height:1.4;padding-top:4px">Score: the judge model’s 1–5 rating, Studio only. — means a check failed, so it wasn’t scored.</span></div>
      </aside>

      <section style="display:flex;flex-direction:column;gap:6px;min-width:0;min-height:0;overflow:hidden">
        ${collapsed('text', 'The problem it solves', stDot('ok'))}
        ${adder}
        ${collapsed('figure', 'read-tiling · Figure 1', stDot('ok'))}
        ${adder}
        <div style="border-radius:10px;border:2px solid ${c.sel};background:${c.surface};box-shadow:0 0 0 4px ${c.selSoft}">
          ${blockHead('text', 'From reads to k-mers', `<span style="display:flex;gap:6px">${amberTag('1 unsourced sentence')}${redTag('Score 2.9 · redrafted once')}</span>`, true)}
          <div style="display:flex;align-items:center;gap:2px;padding:6px 10px;border-bottom:1px solid ${c.border}">
            ${tb('<b>B</b>')}${tb('<i>I</i>')}${tb('Link')}${tb('Cite')}${tb('Math')}${tb('Term')}
            <span style="margin-left:auto;display:flex;align-items:center;gap:8px"><span style="font-family:${MONO};font-size:11px;color:${c.ink3}">node.explanation@v3</span>${secondary(c, 'Redraft with AI')}</span>
          </div>
          <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;font-size:14.5px;line-height:1.7">
            <p style="margin:0">The trick is to stop treating reads as units. Slide a window of width <i>k</i> along each read and record every substring it covers: these are the read’s <b>k-mers</b>.${sup(1)}</p>
            <p style="margin:0">Two reads that overlap share k-mers, so overlaps can be found by looking k-mers up in a table instead of aligning reads to each other.${sup(1)} ${unsup('Every assembler since 2008 works this way.')}</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;padding:8px 14px;border-top:1px solid ${c.border};background:${c.openSoft};font-size:12.5px">
            <span style="color:${c.open};font-weight:600">No source for the highlighted sentence.</span><a>Add a citation</a><a>Cut it</a>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;padding:10px 14px;border-top:1px solid ${c.border};background:${c.bg}">
            ${[['Accurate to sources', '2 / 5', 'The last sentence has no source and overstates: not every assembler is k-mer based.', c.open], ['Clear at this level', '4 / 5', 'Defines k-mers before using them.', c.ink2], ['Serves the claim', '3 / 5', 'Doesn’t yet say why lookups beat alignment.', c.meas]].map(([k, v, why, col]) => `<div style="display:flex;flex-direction:column;gap:3px"><div style="display:flex;justify-content:space-between;font-size:11.5px"><span style="font-weight:600">${k}</span><span style="font-family:${MONO};color:${col}">${v}</span></div><span style="font-size:11.5px;line-height:1.4;color:${c.ink2}">${why}</span></div>`).join('')}
          </div>
          <div style="display:flex;gap:14px;padding:8px 14px;border-top:1px solid ${c.border};font-size:11.5px;color:${c.ink3}">
            <span>Judge: [model, another family] · rubric text@v2</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c.selSoft};border:1px solid ${c.sel}"></span> your edits · 4</span>
            <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c.bg};border:1px solid ${c.border2}"></span> model text · 2 passages</span>
            <span style="margin-left:auto">Redrafting replays your 4 edits</span>
          </div>
        </div>
        ${adder.replace(`<span style="width:20px`, `<span style="position:relative;width:20px`)}
        <div style="display:flex;gap:6px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;border:1px dashed ${c.border2};background:${c.surface}">
          <span style="font-size:12px;color:${c.ink3};padding:4px 4px 4px 0">Add a block</span>
          ${['text', 'figure', 'image', 'resource', 'math', 'example', 'try', 'callout', 'problem'].map(t => `<span style="font-family:${MONO};font-size:11.5px;padding:3px 9px;border-radius:6px;border:1px solid ${c.border2};${t === 'figure' ? `background:${c.selSoft};color:${c.sel};border-color:${c.sel}` : ''}">${t}</span>`).join('')}
        </div>
        ${collapsed('figure', 'kmer-window · Figure 2', redTag('1 check failed'))}
        ${adder}
        ${collapsed('try', 'How many 5-mers does a 100-base read contain?', greyTag('draft'))}
        ${adder}
        ${collapsed('text', 'Building the graph', stDot('ok'))}
      </section>

      <aside style="${panel(c)};display:flex;flex-direction:column;min-height:0;overflow:hidden">
        <div style="display:flex;border-bottom:1px solid ${c.border}">${[['Preview', 0, 1], ['Checks', 3], ['Score', 0], ['Sources', 2], ['History'], ['Comments', 1]].map(([t, n, on]) => `<span style="display:flex;align-items:center;gap:6px;padding:10px 14px;font-size:13px;${on ? `font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${t}${n ? `<span style="font-size:11px;padding:0 6px;border-radius:999px;background:${t === 'Checks' ? c.openSoft : c.bg};color:${t === 'Checks' ? c.open : c.ink3}">${n}</span>` : ''}</span>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px">
          ${seg(c, ['Desktop', 'Phone'], 0)}
          <span style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:${c.ink2}"><span style="width:30px;height:18px;border-radius:9px;background:${c.sel};position:relative"><span style="position:absolute;right:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#FFFFFF"></span></span>Click to edit</span>
        </div>
        <div style="padding:0 14px 14px;overflow:hidden">${preview}</div>
        <div style="margin-top:auto;padding:10px 14px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink3};line-height:1.45">Updates as you type. Clicking a block in the preview opens it in the editor. <b style="color:${c.ink2};font-weight:500">History</b> compares this draft with the live version; <b style="color:${c.ink2};font-weight:500">Sources</b> shows which links resolve.</div>
      </aside>
    </div>`;
  return studio('Graph', inner, 1680, 1060, { collapsed: true });
}
// ── S4 Figure composer — choose · data · interaction · describe ─
function composer() {
  const steps = [['Choose', 'done'], ['Data', 'on'], ['Interaction', ''], ['Describe', 'warn']];
  const stepper = `<div style="display:flex;align-items:center;gap:6px">${steps.map(([n, st], i) => `${i ? `<span style="width:28px;height:1px;background:${c.border2}"></span>` : ''}<span style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:13px;${st === 'on' ? `background:${c.ink};color:${c.bg};font-weight:600` : st === 'done' ? `background:${c.lineSoft};color:${c.btn}` : st === 'warn' ? `background:${c.measSoft};color:${c.meas}` : `border:1px solid ${c.border2};color:${c.ink2}`}"><span style="font-family:${MONO};font-size:11px">${st === 'done' ? '✓' : i + 1}</span>${n}</span>`).join('')}</div>`;
  const cell = (v, o = {}) => `<div style="padding:7px 10px;border-right:1px solid ${c.border};font-family:${o.mono === false ? UI : MONO};font-size:13px;${o.sel ? `outline:2px solid ${c.sel};outline-offset:-2px;background:${c.selSoft}` : ''}${o.muted ? `color:${c.ink3}` : ''}">${v}</div>`;
  const sheet = (head, rows, widths) => `<div style="border:1px solid ${c.border2};border-radius:9px;overflow:hidden;background:${c.surface}">
    <div style="display:grid;grid-template-columns:${widths};background:${c.bg};font-size:11.5px;color:${c.ink3};border-bottom:1px solid ${c.border2}">${head.map(h => `<div style="padding:6px 10px;border-right:1px solid ${c.border}">${h}</div>`).join('')}</div>
    ${rows.map(r => `<div style="display:grid;grid-template-columns:${widths};border-bottom:1px solid ${c.border}">${r.join('')}</div>`).join('')}</div>`;
  const field = (lab, ctl, hint = '') => `<div style="display:flex;flex-direction:column;gap:5px"><span style="font-size:12.5px;font-weight:600">${lab}</span>${ctl}${hint ? `<span style="font-size:11.5px;color:${c.ink3}">${hint}</span>` : ''}</div>`;
  const stateThumb = (t, on) => `<div style="flex:1;display:flex;flex-direction:column;gap:4px"><div style="height:54px;border-radius:7px;border:${on ? `2px solid ${c.sel}` : `1px solid ${c.border}`};background:${c.surface};display:flex;align-items:center;justify-content:center;gap:4px">${[0, 1, 2, 3, 4].map(i => `<span style="width:14px;height:9px;border-radius:2px;background:${t === 'answered' || (t === 'midway' && i < 3) ? c.line : c.border2}"></span>`).join('')}</div><span style="font-size:11.5px;color:${on ? c.ink : c.ink2};text-align:center">${t}</span></div>`;
  const check = (ok, n, d, fix) => `<div style="display:flex;gap:9px;align-items:flex-start;padding:7px 9px;border-radius:8px;${ok ? '' : `background:${ok === 0 ? c.openSoft : c.measSoft}`}"><span style="margin-top:1px;color:${ok ? c.ink2 : c.open}">${ok ? ic.check(c.ink2) : ic.close}</span><div style="display:flex;flex-direction:column;gap:1px"><span style="font-size:13px;font-weight:600;color:${ok ? c.ink : c.open}">${n}</span><span style="font-size:12px;color:${c.ink2}">${d}</span>${fix ? `<a style="font-size:12px;font-weight:500">${fix}</a>` : ''}</div></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;gap:3px">
        <span style="font-size:12.5px;color:${c.ink3}">de Bruijn graphs › Try it 2 › figure</span>
        <span style="font-size:22px;font-weight:600">Figure composer</span>
      </div>
      ${stepper}
      <div style="display:flex;gap:8px">${secondary(c, 'Cancel')}${primary(c, 'Save to the page')}</div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:420px minmax(0, 1fr) 320px;gap:18px;min-height:0">
      <section style="${panel(c)};padding:16px;display:flex;flex-direction:column;gap:14px;min-height:0;overflow:hidden">
        <div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;background:${c.bg}">
          <div style="width:74px;height:46px;border-radius:7px;border:1px solid ${c.border};background:${c.surface};display:flex;align-items:center;justify-content:center;gap:3px">${[0, 1, 2].map(() => `<span style="width:16px;height:10px;border-radius:2px;border:1.5px solid ${c.line}"></span>`).join('')}</div>
          <div style="display:flex;flex-direction:column;flex:1"><span style="font-family:${MONO};font-size:13px;font-weight:500">kmer-graph</span><span style="font-size:12px;color:${c.ink2}">k-mers joined by overlap · v1.3 · in 9 nodes</span></div>
          <a style="font-size:12.5px;font-weight:500">Change</a>
        </div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:1.5px solid ${c.border2}">
          ${navIcon('Assistant', c.btn)}<span style="font-size:13px;color:${c.ink3};flex:1">Describe a change — e.g. “add a read that makes a bubble”</span>${secondary(c, 'Ask')}
        </div>
        ${field('Reads', sheet(['#', 'sequence', 'note'], [
          [cell('1', { muted: 1 }), cell('ACGTT'), cell('', { mono: false })],
          [cell('2', { muted: 1 }), cell('CGTTA'), cell('', { mono: false })],
          [cell('3', { muted: 1 }), cell('GTTAG', { sel: 1 }), cell('', { mono: false })],
          [cell('4', { muted: 1 }), cell('CGTCA'), cell('another read — a branch', { mono: false })],
          [cell('+', { muted: 1 }), cell('paste or type', { muted: 1 }), cell('', { mono: false })],
        ], '34px 1fr 1.3fr'), 'Paste from a FASTA or a spreadsheet. Only A, C, G, T are accepted.')}
        ${field('k', `<div style="display:flex;align-items:center;gap:10px">${seg(c, ['2', '3', '4', '5'], 1)}<span style="font-size:12px;color:${c.ink3}">must be shorter than the shortest read</span></div>`)}
        ${field('Highlight', `<div style="display:flex;gap:6px;flex-wrap:wrap"><span style="padding:4px 10px;border-radius:8px;background:${c.lineSoft};color:${c.btn};font-size:12.5px;font-weight:500">path of read 1–3</span><span style="padding:4px 10px;border-radius:8px;border:1px solid ${c.border2};font-size:12.5px">branches</span><span style="padding:4px 10px;border-radius:8px;border:1px solid ${c.border2};font-size:12.5px">nothing</span></div>`)}
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid ${c.border};font-size:12.5px;color:${c.ink2}"><span>Edit as YAML ${ic.chevron}</span><span style="color:${c.ink3}">5 derived values are computed</span></div>
      </section>

      <section style="display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0">
        <div style="${panel(c)};padding:12px 16px;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:600">Preview</span>${seg(c, ['Desktop', 'Phone', 'Dark'], 0)}</div>
          <div style="flex:1;${gridBg(c)};border:1px solid ${c.border};border-radius:10px;padding:18px 24px;display:flex;align-items:center">${kmerFigure()}</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">Interaction states</span><span style="font-size:12px;color:${c.ink3}">what the learner sees, step by step</span></div>
            <div style="display:flex;gap:10px">${stateThumb('start', 1)}${stateThumb('midway')}${stateThumb('wrong answer')}${stateThumb('answered')}</div>
          </div>
        </div>
        <div style="${panel(c)};padding:12px 16px;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13.5px;font-weight:600">Describe</span>${amberTag('alt text missing')}</div>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
            <div style="padding:8px 10px;border-radius:8px;border:1px solid ${c.border2};font-size:12.5px;color:${c.ink2}"><b style="color:${c.ink};font-weight:600">Caption</b> · Overlapping reads chain their k-mers; the branch comes from another read.</div>
            <div style="padding:8px 10px;border-radius:8px;border:1.5px dashed ${c.measBar};font-size:12.5px;color:${c.ink3}"><b style="color:${c.ink};font-weight:600">Alt text</b> · figure type, what it shows, why it’s here</div>
          </div>
          <span style="font-size:12px;color:${c.ink3}">Data source: written for this page · no licence needed</span>
        </div>
      </section>

      <aside style="display:flex;flex-direction:column;gap:14px;min-height:0">
        <div style="${panel(c)};padding:14px;display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:4px"><span style="font-size:14px;font-weight:600">Checks</span>${redTag('2 to fix')}</div>
          ${check(1, 'Data fits the component', 'reads, k and highlight are valid')}
          ${check(1, 'Values are computed', 'path spells ACGTTAG')}
          ${check(1, 'Biologically valid', 'only A, C, G, T')}
          ${check(1, 'One right answer', 'one path spells a full read')}
          ${check(1, 'Every state draws', '4 of 4')}
          ${check(0, 'Readable on a phone', 'at 390 px the note covers GTC', 'Shorten the note in row 4')}
          ${check(0, 'Described', 'alt text is empty', 'Write alt text')}
        </div>
        ${card(`<span style="font-size:14px;font-weight:600">This component</span>
          <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">${mono('kmer-graph')} v1.3 is pinned for this figure. v1.4 is available — changes arrow spacing.</span>
          <div style="display:flex;gap:8px">${secondary(c, 'Try v1.4')}<a style="font-size:12.5px;font-weight:500;align-self:center">Used in 9 nodes</a></div>`)}
      </aside>
    </div>`;
  return studio('Graph', inner, 1680, 1060, { collapsed: true });
}

// ── S2 Graph — search, a neighbourhood, a table; impact before saving ─
function graph() {
  const nodeBox = (x, y, n, o = {}) => {
    const w = o.w || 170, h = 44;
    const sty = o.center ? `fill:${c.surface};stroke:${c.ink};stroke-width:2.5` : o.proposed ? `fill:${c.selSoft};stroke:${c.sel};stroke-width:1.5;stroke-dasharray:5 4` : o.faded ? `fill:${c.bg};stroke:${c.border2};stroke-width:1` : `fill:${c.surface};stroke:${c.border2};stroke-width:1.2`;
    return `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" rx="9" style="${sty}"></rect><text x="${x + 12}" y="${y - 2}" style="font-family:${UI};font-size:${o.center ? 14.5 : 13}px;font-weight:${o.center ? 700 : 500};fill:${o.faded ? c.ink3 : c.ink}">${n}</text><text x="${x + 12}" y="${y + 14}" style="font-family:${UI};font-size:10.5px;fill:${o.proposed ? c.sel : c.ink3}">${o.meta || ''}</text>`;
  };
  const E = (d, kind) => {
    const st = { needs: `stroke:${c.line};stroke-width:2`, deeper: `stroke:${c.ink2};stroke-width:1.5;stroke-dasharray:6 4`, related: `stroke:${c.ink3};stroke-width:1.5;stroke-dasharray:1.5 4;stroke-linecap:round`, faded: `stroke:${c.border2};stroke-width:1.5`, proposed: `stroke:${c.sel};stroke-width:2;stroke-dasharray:5 4` }[kind];
    return `<path d="${d}" style="fill:none;${st};stroke-linejoin:round"></path>`;
  };
  const colLabel = (x, t) => `<text x="${x}" y="22" style="font-family:${UI};font-size:11.5px;font-weight:600;fill:${c.ink3}">${t}</text>`;
  let ego = `<svg viewBox="0 0 960 540" width="100%" style="display:block">`;
  ego += colLabel(20, 'Two steps back') + colLabel(240, 'Needs') + colLabel(490, 'This node') + colLabel(740, 'Needed by');
  ego += `<rect x="226" y="150" width="202" height="286" rx="12" style="fill:${c.lineSoft};stroke:${c.line};stroke-width:1.5"></rect>`;
  ego += `<text x="238" y="170" style="font-family:${UI};font-size:11.5px;font-weight:700;fill:${c.btn}">ALL OF</text>`;
  ego += `<text x="238" y="428" style="font-family:${UI};font-size:11px;font-style:italic;fill:${c.ink2}">Overlaps are found through shared k-mers.</text>`;
  ego += E('M190 290 H210 Q216 290 216 284 V222 Q216 216 222 216 H242', 'faded') + E('M190 290 H242 ', 'faded');
  ego += E('M412 216 H440 Q446 216 446 222 V284 Q446 290 452 290 H486', 'needs') + E('M412 290 H486', 'needs') + E('M412 380 H440 Q446 380 446 374 V296', 'proposed');
  ego += E('M666 290 H700 Q706 290 706 284 V176 Q706 170 712 170 H736', 'needs') + E('M666 290 H736', 'needs') + E('M666 290 H700 Q706 290 706 296 V404 Q706 410 712 410 H736', 'needs');
  ego += E('M576 312 V470', 'deeper') + E('M600 312 V450 H760 V470', 'deeper');
  ego += E('M576 268 V104', 'related') + E('M600 268 V130 H760 V104', 'related');
  ego += nodeBox(20, 290, 'DNA and genes', { faded: 1, meta: 'needed by both' });
  ego += nodeBox(242, 216, 'k-mers', { meta: 'approved' }) + nodeBox(242, 290, 'Sequencing reads', { meta: 'approved' }) + nodeBox(242, 380, 'Sequencing errors', { proposed: 1, meta: 'proposed · not written yet' });
  ego += nodeBox(486, 290, 'de Bruijn graphs', { center: 1, meta: 'Algorithms · threshold: no', w: 180 });
  ego += nodeBox(736, 170, 'Salmon', { meta: 'goal of 3 routes' }) + nodeBox(736, 290, 'Contigs', { meta: '12 min' }) + nodeBox(736, 410, 'Assemble a genome', { meta: 'track goal' });
  ego += nodeBox(486, 492, 'Compacted dBG', { meta: 'goes deeper' }) + nodeBox(676, 492, 'Eulerian paths', { meta: 'goes deeper' });
  ego += nodeBox(486, 82, 'Overlap graphs', { meta: 'related' }) + nodeBox(676, 82, 'Minimizers', { meta: 'related' });
  ego += `</svg>`;

  const tree = [['Biology', 14], ['Sequencing', 22], ['Alignment', 18], ['Algorithms', 16, 1], ['Quantification', 11], ['Variants', 13], ['Statistics', 9], ['Single-cell', 7]];
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:center;gap:14px">${h1('Graph', 24)}<span style="font-size:13px;color:${c.ink2}">110 nodes · 214 links</span>${greenTag('No cycles')}${redTag('2 orphans')}${amberTag('3 nodes no route reaches')}${amberTag('1 level jump')}</div>
      <div style="display:flex;gap:8px">${secondary(c, '+ Node')}${secondary(c, 'Split')}${secondary(c, 'Merge')}${secondary(c, 'Preview a goal')}</div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:240px minmax(0, 1fr) 380px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;gap:8px;min-height:0;overflow:hidden">
        ${qSearch('Find a node', 240)}
        <span style="${label(c)};padding-top:6px">By region</span>
        ${tree.map(([n, k, on]) => `<div style="display:flex;flex-direction:column"><div style="display:flex;align-items:center;gap:6px;padding:5px 6px;border-radius:7px;font-size:13px"><span style="color:${c.ink3};display:flex;${on ? '' : 'transform:rotate(-90deg)'}">${ic.chevron}</span><span style="flex:1;font-weight:${on ? 600 : 400}">${n}</span><span style="font-size:11.5px;color:${c.ink3}">${k}</span></div>
          ${on ? ['k-mers', 'de Bruijn graphs', 'Compacted dBG', 'Eulerian paths', 'Minimizers', 'Overlap graphs', 'Suffix arrays'].map(x => `<span style="padding:4px 8px 4px 30px;border-radius:7px;font-size:12.5px;${x === 'de Bruijn graphs' ? `background:${c.selSoft};font-weight:600` : `color:${c.ink2}`}">${x}</span>`).join('') : ''}</div>`).join('')}
      </aside>
      <section style="${panel(c)};display:flex;flex-direction:column;min-width:0;min-height:0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid ${c.border}">
          <div style="display:flex;gap:12px;align-items:center"><div style="display:{{ segE }};padding:3px;border-radius:10px;background:${c.bg};border:1px solid ${c.border}"><span onClick="{{ toEdit }}" style="cursor:pointer;padding:5px 13px;border-radius:7px;font-size:12.5px;background:${c.surface};color:${c.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)">Editing view</span><span onClick="{{ toLearner }}" style="cursor:pointer;padding:5px 13px;border-radius:7px;font-size:12.5px;color:${c.ink2}">Learner view</span></div><div style="display:{{ segL }};padding:3px;border-radius:10px;background:${c.bg};border:1px solid ${c.border}"><span onClick="{{ toEdit }}" style="cursor:pointer;padding:5px 13px;border-radius:7px;font-size:12.5px;color:${c.ink2}">Editing view</span><span onClick="{{ toLearner }}" style="cursor:pointer;padding:5px 13px;border-radius:7px;font-size:12.5px;background:${c.surface};color:${c.ink};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)">Learner view</span></div><span style="display:{{ ev }}">${seg(c, ['Neighbourhood', 'Table', 'Whole network'], 0)}</span></div>
          <div style="display:{{ evf }};gap:14px;align-items:center;font-size:12px;color:${c.ink2}">
            <span style="display:flex;align-items:center;gap:6px"><svg width="26" height="8"><path d="M0 4H26" style="stroke:${c.line};stroke-width:2"></path></svg>needs</span>
            <span style="display:flex;align-items:center;gap:6px"><svg width="26" height="8"><path d="M0 4H26" style="stroke:${c.ink2};stroke-width:1.5;stroke-dasharray:6 4"></path></svg>goes deeper</span>
            <span style="display:flex;align-items:center;gap:6px"><svg width="26" height="8"><path d="M1 4H26" style="stroke:${c.ink3};stroke-width:1.5;stroke-dasharray:1.5 4;stroke-linecap:round"></path></svg>related</span>
            ${seg(c, ['1 step', '2 steps'], 1)}
          </div>
        </div>
        <div style="display:{{ ev }};flex:1;padding:12px 18px;${gridBg(c)};min-height:0">${ego}</div>
        <div style="display:{{ lv }};flex:1;padding:12px 18px;${gridBg(c)};min-height:0">
          <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px"><span style="font-size:13px;font-weight:600">How learners see de Bruijn graphs on their maps</span>${seg(c, ['Current', 'With your change'], 1)}</div>
          ${network({ sel: 7 })}
          <div style="display:flex;gap:10px;align-items:center;padding:8px 12px;margin-top:6px;border-radius:9px;background:${c.selSoft};font-size:12.5px;line-height:1.5"><span style="font-weight:600;color:${c.sel};flex:none">With your change</span><span>Learn Salmon gains one stop before de Bruijn graphs — <b style="font-weight:600">Sequencing errors</b>, shown as not written yet.</span></div>
        </div>
        <div style="display:{{ ev }};padding:9px 16px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink3}">Click a node to centre it · double-click to open its page in the workbench · the whole network is for looking, this view is for editing.</div>
        <div style="display:{{ lv }};padding:9px 16px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink3}">Learners only ever see this metro style — on Home, routes, Explore and Your knowledge. The editing view is for the team.</div>
      </section>
      <aside style="display:flex;flex-direction:column;gap:14px;min-height:0;overflow:hidden">
        <div style="${panel(c)};padding:14px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14.5px;font-weight:600">Needs of de Bruijn graphs</span>${seg(c, ['All of', 'Any of'], 0)}</div>
          ${[['k-mers', 'approved'], ['Sequencing reads', 'approved']].map(([n, s]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;border:1px solid ${c.border}"><span style="font-size:13px">${n}</span><span style="font-size:11.5px;color:${c.ink3}">${s}</span></div>`).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;border:1.5px dashed ${c.sel};background:${c.selSoft}"><span style="font-size:13px;font-weight:600">+ Sequencing errors</span><span style="font-size:11.5px;color:${c.sel}">your change</span></div>
          <div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:600">Why it’s needed</span><div style="padding:8px 10px;border-radius:8px;border:1px solid ${c.border2};font-size:12.5px;line-height:1.45">Tips and bubbles only make sense once you know how sequencing errors look.</div></div>
        </div>
        <div style="${panel(c)};padding:14px;display:flex;flex-direction:column;gap:8px;border-color:${c.measBar}">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:600">If you make this change</span>${amberTag('checked before saving')}</div>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px">
            <div style="padding:8px 10px;border-radius:8px;background:${c.bg}"><span style="font-size:18px;font-weight:600">14</span><span style="display:block;font-size:11.5px;color:${c.ink2}">routes get 1 more node</span></div>
            <div style="padding:8px 10px;border-radius:8px;background:${c.bg}"><span style="font-size:18px;font-weight:600">+15 min</span><span style="display:block;font-size:11.5px;color:${c.ink2}">on each of them</span></div>
          </div>
          <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">Learn Salmon, Assemble a genome, Quantify my RNA-seq and 11 more. <b style="color:${c.ink};font-weight:600">Sequencing errors</b> isn’t written yet, so those routes will show it as missing and it goes to Requests.</span>
          <span style="font-size:12px;color:${c.ink3}">No cycle created. 2 connecting texts on Learn Salmon will need re-review.</span>
          <div style="display:flex;gap:8px">${primary(c, 'Propose this change')}${secondary(c, 'Cancel')}</div>
          <span style="font-size:11.5px;color:${c.ink3}">A “needs” change is reviewed on its own before it reaches any route.</span>
        </div>
        ${card(`<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:600">Levels</span>${levelTag('this node · Intermediate')}</div>
          <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">Its needs are Introductory — fine. Elsewhere: <b style="color:${c.ink};font-weight:600">Codons</b> (First steps) needs <b style="color:${c.ink};font-weight:600">Translation</b> (Intermediate), two levels up. Usually a wrong link or a mis-levelled page.</span>`)}
        ${card(`<span style="font-size:14px;font-weight:600">History of this node’s links</span>
          ${[['Needs group approved', '[Reviewer A] · 3 Sep'], ['“Minimizers” added as related', '[Author B] · 1 Sep'], ['Split from “Assembly graphs”', '[Author A] · 22 Aug']].map(([a, b]) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid ${c.border};font-size:12.5px"><span>${a}</span><span style="color:${c.ink3};white-space:nowrap">${b}</span></div>`).join('')}`)}
      </aside>
    </div>`;
  return studio('Graph', inner, 1680, 1060, { collapsed: true }).replace('</x-dc>', `</x-dc>
<script data-dc-script data-props='{"view":{"editor":"enum","options":["Editing","Learner"],"default":"Editing","section":"Graph"}}'>
class Component extends DCLogic {
  renderVals() {
    const v = (this.state && this.state.view) || this.props.view || 'Editing';
    const ed = v === 'Editing';
    return {
      ev: ed ? 'block' : 'none', evf: ed ? 'flex' : 'none', lv: ed ? 'none' : 'block',
      segE: ed ? 'flex' : 'none', segL: ed ? 'none' : 'flex',
      toEdit: () => this.setState({ view: 'Editing' }),
      toLearner: () => this.setState({ view: 'Learner' }),
    };
  }
}
</script>`);
}
// ── S15 Assistant — chat that acts only through the content API ─
function assistant() {
  const msgUser = (t) => `<div style="align-self:flex-end;max-width:70%;padding:10px 14px;border-radius:12px 12px 4px 12px;background:${c.ink};color:${c.bg};font-size:14px;line-height:1.55">${t}</div>`;
  const msgAi = (t) => `<div style="display:flex;gap:10px;max-width:86%"><span style="width:26px;height:26px;border-radius:8px;flex:none;background:${c.lineSoft};color:${c.btn};display:flex;align-items:center;justify-content:center">${navIcon('Assistant', c.btn)}</span><div style="font-size:14px;line-height:1.6;padding-top:2px">${t}</div></div>`;
  const tool = (call, result, body = '', state = '') => `<div style="margin-left:36px;border-radius:12px;border:1px solid ${state === 'pending' ? c.sel : c.border};background:${c.surface};overflow:hidden">
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${c.bg};border-bottom:${body ? `1px solid ${c.border}` : '0'}">
      <span style="font-family:${MONO};font-size:12px;color:${c.ink}">${call}</span>
      <span style="font-size:12px;color:${c.ink3}">${result}</span>
      <span style="margin-left:auto">${state === 'kept' ? greenTag('Kept as draft') : state === 'pending' ? blueTag('Waiting for you') : ''}</span>
    </div>${body}</div>`;
  const conv = (t, ctx, meta, on) => `<div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:10px;${on ? `background:${c.surface};border:1px solid ${c.border}` : 'border:1px solid transparent'}">
    <span style="font-size:13.5px;font-weight:${on ? 600 : 500}">${t}</span>
    <div style="display:flex;justify-content:space-between;gap:6px"><span style="font-size:11.5px;color:${c.ink2};font-family:${MONO}">${ctx}</span><span style="font-size:11.5px;color:${c.ink3}">${meta}</span></div></div>`;
  const img = (lic, ok) => `<div style="flex:1;display:flex;flex-direction:column;gap:6px"><div style="height:76px;border-radius:8px;background:repeating-linear-gradient(45deg, ${c.bg} 0 8px, ${c.surface} 8px 16px);border:1px dashed ${c.border2};display:flex;align-items:center;justify-content:center;font-size:11px;color:${c.ink3}">[result]</div><span style="font-size:11.5px;color:${ok ? c.ink2 : c.open}">${lic}</span>${ok ? secondary(c, 'Attach') : `<span style="font-size:11.5px;color:${c.ink3}">Can’t attach</span>`}</div>`;
  const inner = `
    <div style="flex:1;display:grid;grid-template-columns:260px minmax(0, 1fr) 340px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;gap:6px;min-height:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px">${h1('Assistant', 22)}${secondary(c, '+ New')}</div>
        <span style="font-size:12px;color:${c.ink3};padding:0 2px 6px">Every chat is tied to something you’re working on.</span>
        ${conv('Add error figures', 'node · de Bruijn graphs', 'now', 1)}
        ${conv('Draft the GTF node', 'request · Annotation files', '1 h')}
        ${conv('Tighten Salmon bridges', 'route · Learn Salmon', 'yesterday')}
        ${conv('Why does N differ from D?', 'no context', '2 d')}
        ${conv('Problem for k-mer counting', 'node · k-mers', '4 d')}
      </aside>

      <section style="${panel(c)};display:flex;flex-direction:column;min-height:0;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid ${c.border}">
          <div style="display:flex;align-items:center;gap:10px"><span style="font-size:15px;font-weight:600">Add error figures</span>${greyTag('de Bruijn graphs · draft')}</div>
          <a style="font-size:13px;font-weight:500">Open the node in the workbench</a>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:14px;padding:18px;min-height:0;overflow:hidden">
          ${msgUser('The page doesn’t show what sequencing errors do to the graph. Add a figure and a question about it, after “Errors and repeats”.')}
          ${msgAi('I’ll use the <b>graph-artifacts</b> component and add a question that uses it. Checking what the component accepts first.')}
          ${tool('list_components(match: "graph")', '3 found · graph-artifacts fits')}
          ${tool('insert_block(after: "Errors and repeats", type: figure)', 'checks 6 of 6 passed',
            `<div style="display:grid;grid-template-columns:minmax(0, 1fr) 260px;gap:14px;padding:12px">
              <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:8px;padding:6px 10px">${F.bubble()}</div>
              <pre style="margin:0;padding:10px 12px;border-radius:8px;background:${c.bg};font-family:${MONO};font-size:11.5px;line-height:1.6;color:${c.ink}">figure: graph-artifacts
props:
  path: [ACG, CGT, GTT,
         TTA, TAG, AGC]
  bubble: { at: GTT, kmer: TCA }
  tip: { at: CGT, kmer: GTA }</pre></div>
            <div style="display:flex;gap:8px;padding:0 12px 12px">${secondary(c, 'Kept')}</div>`, 'kept')}
          ${tool('insert_block(after: figure, type: try)', 'one accepted answer ✓',
            `<div style="display:flex;align-items:center;gap:12px;padding:12px">
              <span style="font-size:14px;flex:1">“Why does an error near the end of a read make a tip rather than a bubble?”</span>
              ${primary(c, 'Keep')}${secondary(c, 'Discard')}${secondary(c, 'Edit')}</div>`, 'pending')}
          ${tool('search_images("assembly graph Bandage")', '3 results',
            `<div style="display:flex;gap:12px;padding:12px">${img('CC BY-SA 4.0 · [author]', 1)}${img('CC0 · [author]', 1)}${img('No licence stated', 0)}</div>`)}
          ${msgAi('Which image should go under Figure 4? The third can’t be used — its licence isn’t stated.')}
        </div>
        <div style="padding:12px 18px;border-top:1px solid ${c.border};display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:10px;height:48px;padding:0 8px 0 14px;border-radius:12px;border:1.5px solid ${c.border2};background:${c.surface}">
            <span style="font-size:14px;color:${c.ink3};flex:1">Reply, or ask for a change…</span>
            ${primary(c, 'Send')}
          </div>
          <div style="display:flex;gap:10px;align-items:center;font-size:12px;color:${c.ink3}">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid ${c.border2};color:${c.ink2}">${mono('claude-sonnet-5', 'font-size:11.5px')} · hosted ${ic.chevron}</span>
            <span>Answers cite the node’s sources; anything else is marked as unsourced.</span>
          </div>
        </div>
      </section>

      <aside style="display:flex;flex-direction:column;gap:14px;min-height:0">
        ${card(`<span style="font-size:14.5px;font-weight:600">Changes from this chat</span>
          ${[['figure · graph-artifacts', 'kept', 1], ['try · tip vs bubble', 'waiting', 0], ['image · Figure 5', 'not chosen', 0]].map(([n, s, ok]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-top:1px solid ${c.border};font-size:13px"><span style="font-family:${MONO};font-size:12px">${n}</span><span style="color:${ok ? c.btn : c.ink3}">${s}</span></div>`).join('')}
          <span style="font-size:12px;color:${c.ink3};line-height:1.5">Kept changes become drafts in the workbench. They still go through checks and review — nothing is published from a chat.</span>`)}
        ${card(`<span style="font-size:14.5px;font-weight:600">What the assistant can do</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${['read nodes', 'list components', 'add / edit blocks', 'search images', 'propose links', 'run checks', 'preview'].map(t => `<span style="font-size:11.5px;padding:2px 8px;border-radius:6px;background:${c.bg};border:1px solid ${c.border}">${t}</span>`).join('')}</div>
          <span style="font-size:12.5px;font-weight:600;padding-top:4px">What it can’t</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${['approve', 'publish', 'land', 'move requests', 'attach unlicensed media'].map(t => `<span style="font-size:11.5px;padding:2px 8px;border-radius:6px;border:1px dashed ${c.border2};color:${c.ink3}">${t}</span>`).join('')}</div>`)}
        ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:14.5px;font-weight:600">This chat</span><span style="font-size:12px;color:${c.ink3}">sample</span></div>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px">
            <div><span style="font-size:18px;font-weight:600;font-variant-numeric:tabular-nums">18.2k</span><span style="display:block;font-size:12px;color:${c.ink2}">tokens</span></div>
            <div><span style="font-size:18px;font-weight:600;font-variant-numeric:tabular-nums">$0.09</span><span style="display:block;font-size:12px;color:${c.ink2}">cost</span></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:12px"><span>Your month</span><span style="color:${c.ink2}">$14.20 of $40</span></div>
          <div style="height:6px;border-radius:3px;background:${c.border2}"><div style="width:35%;height:6px;border-radius:3px;background:${c.ink2}"></div></div></div>`)}
      </aside>
    </div>`;
  return studio('Assistant', inner, 1680, 1060, { collapsed: true });
}

// ── S16 AI usage ────────────────────────────────────────────────
const SERIES = [['Page drafting', '#4a3aa7'], ['Figures and problems', '#eb6834'], ['Connecting text', '#2a78d6'], ['Goal suggestions (learners)', '#e87ba4']];
function usageChart() {
  const W = 1000, H = 250, L = 46, B = 26, days = 30, max = 300;
  const bw = 20, step = (W - L - 10) / days;
  const val = (d, k) => [60 + ((d * 37) % 70), 25 + ((d * 53) % 40), 20 + ((d * 29) % 35), 30 + ((d * 17) % 45) + (d > 22 ? 25 : 0)][k] * ((d % 7 === 5 || d % 7 === 6) ? 0.45 : 1);
  const y = (v) => H - B - (v / max) * (H - B - 14);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">`;
  [0, 100, 200, 300].forEach(t => { s += `<line x1="${L}" y1="${y(t)}" x2="${W}" y2="${y(t)}" style="stroke:${c.border};stroke-width:1"></line><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" style="font-family:${MONO};font-size:10.5px;fill:${c.ink3}">${t}k</text>`; });
  for (let d = 0; d < days; d++) {
    const x = L + 6 + d * step;
    let acc = 0;
    SERIES.forEach(([, col], k) => {
      const v = val(d, k), y0 = y(acc), y1 = y(acc + v);
      const top = k === SERIES.length - 1;
      const hgt = Math.max(0, y0 - y1 - 2);
      s += top ? `<path d="M${x} ${y0 - 2} V${y1 + 4} Q${x} ${y1} ${x + 4} ${y1} H${x + bw - 4} Q${x + bw} ${y1} ${x + bw} ${y1 + 4} V${y0 - 2} Z" style="fill:${col}"></path>`
        : `<rect x="${x}" y="${y1}" width="${bw}" height="${hgt}" style="fill:${col}"></rect>`;
      acc += v;
    });
    if (d % 5 === 0) s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" style="font-family:${MONO};font-size:10.5px;fill:${c.ink3}">${['17 Aug', '22 Aug', '27 Aug', '1 Sep', '6 Sep', '11 Sep'][d / 5]}</text>`;
  }
  // hover state on one bar
  const hd = 23, hx = L + 6 + hd * step;
  s += `<rect x="${hx - 4}" y="10" width="${bw + 8}" height="${H - B - 8}" rx="4" style="fill:${c.ink};opacity:.05"></rect>`;
  const tx = hx - 250, ty = 16;
  s += `<rect x="${tx}" y="${ty}" width="232" height="118" rx="8" style="fill:${c.surface};stroke:${c.border2};stroke-width:1"></rect>`;
  s += `<text x="${tx + 12}" y="${ty + 20}" style="font-family:${UI};font-size:12px;font-weight:600;fill:${c.ink}">9 Sep · ${Math.round(SERIES.reduce((a, _, k) => a + val(hd, k), 0))}k tokens</text>`;
  SERIES.forEach(([n, col], k) => {
    s += `<rect x="${tx + 12}" y="${ty + 34 + k * 20}" width="10" height="10" rx="2" style="fill:${col}"></rect><text x="${tx + 28}" y="${ty + 43 + k * 20}" style="font-family:${UI};font-size:11.5px;fill:${c.ink2}">${n}</text><text x="${tx + 220}" y="${ty + 43 + k * 20}" text-anchor="end" style="font-family:${MONO};font-size:11.5px;fill:${c.ink}">${Math.round(val(hd, k))}k</text>`;
  });
  return s + '</svg>';
}
const aiTabs = (on) => `<div style="display:flex;gap:2px;border-bottom:1px solid ${c.border}">${['Usage', 'Models', 'Budgets'].map(t => `<span style="padding:8px 16px;font-size:13.5px;${t === on ? `font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${t}</span>`).join('')}</div>`;
function usage() {
  const kpi = (v, l, extra = '') => `<div style="flex:1;display:flex;flex-direction:column;gap:3px;padding:14px 16px;border-radius:12px;background:${c.surface};border:1px solid ${c.border}"><span style="font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums">${v}</span><span style="font-size:12.5px;color:${c.ink2}">${l}</span>${extra}</div>`;
  const tbl = (title, head, rows) => `<div style="${panel(c)};overflow:hidden"><div style="padding:11px 14px;font-size:14px;font-weight:600;border-bottom:1px solid ${c.border}">${title}</div>
    <div style="display:grid;grid-template-columns:minmax(0, 1fr) repeat(${head.length - 1}, 76px);gap:8px;padding:7px 14px;font-size:11.5px;color:${c.ink3}">${head.map((h, i) => `<span style="${i ? 'text-align:right' : ''}">${h}</span>`).join('')}</div>
    ${rows.map(r => `<div style="display:grid;grid-template-columns:minmax(0, 1fr) repeat(${head.length - 1}, 76px);gap:8px;align-items:center;padding:8px 14px;border-top:1px solid ${c.border};font-size:13px">${r.map((v, i) => `<span style="${i ? 'text-align:right;font-variant-numeric:tabular-nums' : 'display:flex;align-items:center;gap:8px;min-width:0'}">${v}</span>`).join('')}</div>`).join('')}</div>`;
  const sw = (col) => `<span style="width:10px;height:10px;border-radius:2px;flex:none;background:${col}"></span>`;
  const meter = (pct) => `<div style="height:6px;border-radius:3px;background:${c.border2};margin-top:6px"><div style="width:${pct}%;height:6px;border-radius:3px;background:${pct > 80 ? c.measBar : c.ink2}"></div></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('AI', 26)}<span style="font-size:13px;color:${c.ink2}">Every model call Code makes, through one LiteLLM gateway. Sample numbers.</span></div>
      <div style="display:flex;gap:10px;align-items:center">${seg(c, ['7 days', '30 days', '90 days'], 1)}${secondary(c, 'Export CSV')}</div>
    </div>
    ${aiTabs('Usage')}
    <div style="display:flex;gap:12px">
      ${kpi('4.82 M', 'tokens · 30 days')}
      ${kpi('$186.40', 'cost · 30 days')}
      ${kpi('2,914', 'calls · 11 fell back to the local model')}
      ${kpi('62%', 'of the $300 monthly budget', meter(62))}
    </div>
    <section style="${panel(c)};padding:14px 18px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:15px;font-weight:600">Tokens per day, by task</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:${c.ink2}">${SERIES.map(([n, col]) => `<span style="display:flex;align-items:center;gap:6px">${sw(col)}${n}</span>`).join('')}</div>
      </div>
      ${usageChart()}
    </section>
    <div style="display:grid;grid-template-columns:minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr);gap:16px">
      ${tbl('By task · assistant chats count toward the task they change', ['Task', 'Tokens', 'Cost', 'Calls'], [
        [`${sw(SERIES[0][1])}Page drafting`, '1.94 M', '$112.30', '612'],
        [`${sw(SERIES[1][1])}Figures and problems`, '1.01 M', '$51.80', '388'],
        [`${sw(SERIES[2][1])}Connecting text`, '0.81 M', '$9.70', '941'],
        [`${sw(SERIES[3][1])}Goal suggestions`, '1.06 M', '$12.60', '973'],
      ])}
      ${tbl('By person', ['Person', 'Tokens', 'Cost', 'Budget'], [
        ['[Author A]', '1.21 M', '$38.90', '97%'], ['[Author C]', '0.96 M', '$31.40', '79%'], ['[Author B]', '0.62 M', '$20.10', '50%'], ['[Reviewer A]', '0.18 M', '$6.30', '16%'], ['Learners (goal suggestions)', '1.06 M', '$12.60', '—'],
      ])}
      ${tbl('By model', ['Model', 'Tokens', 'Cost', 'Calls'], [
        [mono('claude-sonnet-5', 'font-size:12px'), '2.61 M', '$158.30', '861'], [mono('claude-haiku-4-5', 'font-size:12px'), '1.63 M', '$28.10', '1,901'], [`${mono('[local model]', 'font-size:12px')}`, '0.58 M', '$0.00', '152'],
      ])}
    </div>
    <div style="display:flex;gap:12px">
      <div style="flex:1;display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;background:${c.measSoft};font-size:13px;line-height:1.5"><span style="font-weight:600;color:${c.meas};flex:none">Goal suggestions at 81% of today’s cap</span><span>When it’s reached, learners get plain search results instead of suggested targets until midnight.</span></div>
      <div style="flex:1;display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:10px;background:${c.measSoft};font-size:13px;line-height:1.5"><span style="font-weight:600;color:${c.meas};flex:none">[Author A] at 97% of their budget</span><span>Their drafting falls back to the local model at 100%.</span></div>
    </div>`;
  return studio('AI', inner, 1680, 1180);
}

// ── S17 Models & budgets ────────────────────────────────────────
function models() {
  const lane = (title, sub, status, on, body) => `<div style="flex:1;display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:12px;background:${c.surface};border:${on ? `1.5px solid ${c.line}` : `1px solid ${c.border}`}">
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:600">${title}</span>${status}</div>
    <span style="font-size:13px;color:${c.ink2};line-height:1.5">${sub}</span>${body}</div>`;
  const cols = 'minmax(0, 1.3fr) 110px minmax(0, 1fr) minmax(0, 1fr) 150px';
  const row = (task, where, model, fb, cap) => `<div style="display:grid;grid-template-columns:${cols};gap:12px;align-items:center;padding:10px 14px;border-top:1px solid ${c.border};font-size:13px">
    <span style="font-weight:600">${task}</span><span style="color:${c.ink2}">${where}</span>
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:8px;border:1px solid ${c.border2};justify-self:start">${mono(model, 'font-size:12px')}${ic.chevron}</span>
    <span style="color:${c.ink2}">${fb}</span><span style="color:${c.ink2}">${cap}</span></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('AI', 26)}<span style="font-size:13px;color:${c.ink2}">Where models come from, and which one each task uses.</span></div>
      ${primary(c, 'Save changes')}
    </div>
    ${aiTabs('Models')}
    <div style="display:flex;gap:14px">
      ${lane('No AI', 'Always on. Every page still works: routes are computed without a model, and learners get search instead of suggestions.', greyTag('always available'), false, '')}
      ${lane('Self-hosted', 'Any OpenAI-compatible endpoint you run — Ollama, vLLM or OpenLLM.', greenTag('connected'), true,
        `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:8px;background:${c.bg};font-family:${MONO};font-size:12px">http://[host]:11434/v1 · [local model]</div>`)}
      ${lane('Hosted keys', 'Provider keys held by the gateway — never by the browser or a learner.', greenTag('2 providers'), true,
        `<div style="display:flex;gap:6px;flex-wrap:wrap">${['Anthropic · key …7f2a', '[provider] · key …19c0'].map(k => `<span style="font-size:12px;padding:3px 9px;border-radius:6px;background:${c.bg};border:1px solid ${c.border};font-family:${MONO}">${k}</span>`).join('')}${secondary(c, '+ Add key')}</div>`)}
    </div>
    <div style="${panel(c)};overflow:hidden;flex:none">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid ${c.border}">
        <span style="font-size:15px;font-weight:600">Where Code calls a model</span>
        <span style="font-size:12.5px;color:${c.ink3}">This list is fixed. Adding a place is a reviewed code change, as in Labs.</span>
      </div>
      <div style="display:grid;grid-template-columns:${cols};gap:12px;padding:8px 14px;font-size:11.5px;color:${c.ink3}"><span>Task</span><span>Who triggers it</span><span>Model</span><span>If it fails or runs out</span><span>Cap</span></div>
      ${row('Goal suggestions', 'learners', 'claude-haiku-4-5', 'plain search', '$5 a day')}
      ${row('Page drafting', 'authors', 'claude-sonnet-5', '[local model]', 'per-person budget')}
      ${row('Figure data and problems', 'authors', 'claude-sonnet-5', 'stop and say so', 'per-person budget')}
      ${row('Connecting text', 'weaving', 'claude-haiku-4-5', '[local model]', '$2 a route')}
      ${row('Request grouping', 'new requests', '[local model]', 'leave ungrouped', 'none')}
      ${row('Assistant chats', 'team', 'claude-sonnet-5', 'claude-haiku-4-5', 'per-person budget')}
      ${row('Skeleton drafting', 'authors', 'claude-sonnet-5', '[local model]', '$10 an outline')}
      ${row('Resource suggestion', 'authors', 'claude-haiku-4-5', 'none — search by hand', 'per-person budget')}
      ${row('Block evaluation (judge)', 'every draft', '[model, another family]', 'leave unscored', '$3 a node')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:16px">
      ${card(`<span style="font-size:15px;font-weight:600">Budgets</span>
        ${[['Team, per month', '$300'], ['Each person, per month', '$40'], ['Learner goal suggestions, per day', '$5']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid ${c.border};font-size:13.5px"><span>${k}</span><span style="padding:4px 12px;border-radius:8px;border:1px solid ${c.border2};font-family:${MONO};font-size:12.5px">${v}</span></div>`).join('')}
        <span style="font-size:12.5px;color:${c.ink2}">When a cap is reached: ${seg(c, ['Use the fallback', 'Stop', 'Ask an operator'], 0)}</span>`)}
      ${card(`<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:600">Scoring</span>${greyTag('tutor spec T8')}</div>
        ${[['Redraft automatically below', '3.0'], ['Most redrafts per block', '2'], ['Judge model family', 'must differ from the drafter']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid ${c.border};font-size:13.5px"><span>${k}</span><span style="padding:4px 12px;border-radius:8px;border:1px solid ${c.border2};font-family:${MONO};font-size:12.5px">${v}</span></div>`).join('')}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:${c.bg};font-size:13px"><span style="display:flex;align-items:center;gap:8px">${ic.lock}<span><b style="font-weight:600">Deploy automatically above</b> — locked until judge–human agreement is measured (see Quality)</span></span></div>`)}
      ${card(`<span style="font-size:15px;font-weight:600">What’s recorded for every call</span>
        <span style="font-size:13px;color:${c.ink2};line-height:1.55">Task, person, model, prompt id, tokens in and out, cost, and whether it fell back — kept by the gateway, and attached to the draft it produced as provenance (§5.4). Learner calls record no identity beyond an anonymous session.</span>`)}
    </div>`;
  return studio('AI', inner, 1440, 1260);
}

// ── L2 Placement — the first station of the tutor loop ─────────
function placement() {
  const cand = [['Living things carry instructions', 'known'], ['DNA and genes', 'known'], ['Gene expression', 'known'], ['Sequencing reads', 'now'], ['FASTQ on disk', 'wait'], ['RNA-seq experiments', 'wait'], ['k-mers', 'wait'], ['Reference transcriptome', 'wait'], ['Sequence alignment', 'wait'], ['Expectation–maximisation', 'learn']];
  const candRow = ([n, st]) => {
    const tag = st === 'known' ? `<span style="font-size:12px;color:${c.ink2}">you know this · dropped</span>` : st === 'learn' ? `<span style="font-size:12px;color:${c.sel}">stays on your route</span>` : st === 'now' ? blueTag('asking now') : `<span style="font-size:12px;color:${c.ink3}">not asked yet</span>`;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid ${c.border}">${dot(st === 'known' ? 'settled' : st === 'now' || st === 'learn' ? 'next' : 'open')}<span style="font-size:13.5px;flex:1;${st === 'known' ? `text-decoration:line-through;color:${c.ink3}` : ''}">${n}</span>${tag}</div>`;
  };
  const opt = (s, on) => `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;font-size:15px;${on ? `border:2px solid ${c.sel};background:${c.selSoft}` : `border:1px solid ${c.border2};background:${c.surface}`}"><span style="width:18px;height:18px;border-radius:50%;flex:none;${on ? `border:5px solid ${c.sel};background:${c.surface}` : `border:1.5px solid ${c.border2}`}"></span>${s}</div>`;
  return page(1440, 800, `${focusBar('Placement · Learn Salmon', progress(3, 3, 10), `<span style="font-size:13px;color:${c.ink2}">about 3 min left</span>`)}
  <main style="flex:1;display:grid;grid-template-columns:minmax(0, 1fr) 380px;gap:36px;padding:40px 56px;min-height:0">
    <section style="display:flex;flex-direction:column;gap:20px;max-width:760px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="${label(c)}">Checking: Sequencing reads</span>
        ${h1('A sequencer returns 20 million reads of 150 bases from one RNA sample. What is each read?', 28)}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${opt('A copy of one whole transcript')}
        ${opt('A short piece copied from a random position of some transcript', true)}
        ${opt('The expression level of one gene')}
        ${opt('A k-mer from the reference transcriptome')}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding-top:6px">
        <span style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:1px dashed ${c.border2};font-size:14px;color:${c.ink2}">I don’t know this yet</span>
        ${primary(c, 'Check', '')}
      </div>
      <div style="display:flex;gap:12px;padding:14px 16px;border-radius:12px;background:${c.bg};font-size:13px;line-height:1.55;color:${c.ink2}">
        <span style="flex:1">One question per stop, no hints, no score. A right answer drops the stop and everything only it needed; “I don’t know this yet” keeps it on your route. You can always come back and test out later.</span>
      </div>
    </section>
    <aside style="${panel(c)};padding:18px 20px;display:flex;flex-direction:column;gap:10px;align-self:start">
      <span style="${label(c)}">Your route so far</span>
      <div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:30px;font-weight:600;letter-spacing:-.02em">10 stops</span><span style="font-size:14px;color:${c.ink3};text-decoration:line-through">13</span></div>
      <span style="font-size:13px;color:${c.ink2}">about 2 h 40 min · shorter as you answer</span>
      <div style="display:flex;flex-direction:column;margin-top:6px">${cand.map(candRow).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;margin-top:6px;border-radius:9px;background:${c.bg};font-size:12.5px;line-height:1.45;color:${c.ink2}"><span style="font-weight:600;color:${c.ink}">You told us: a biology degree</span><span>So we ask about First steps and Foundations pages first, expecting you to know them. A hint never marks a page known — you still answer.</span></div>
      <span style="font-size:12px;color:${c.ink3};line-height:1.45;padding-top:6px">This route spans First steps → Advanced. Salmon, Selective alignment and de Bruijn graphs aren’t asked: nobody tests out of the goal itself.</span>
    </aside>
  </main>`);
}

// ── S6 Review — approve blocks, sorted by the judge's score ────
function reviewStudio() {
  const cols = '26px minmax(0, 1.2fr) 82px 60px 70px';
  const sc = (v) => `<span style="font-family:${MONO};font-size:12.5px;font-weight:600;color:${v < 3 ? c.open : v < 4 ? c.meas : c.ink2};font-variant-numeric:tabular-nums">${v.toFixed(1)}</span>`;
  const rows = [
    ['From reads to k-mers', 'de Bruijn graphs', 'text', 2.9, 'disagree?', { focus: 1 }],
    ['Construct a de Bruijn graph', 'de Bruijn graphs', 'problem', 3.4, ''],
    ['Isoform switching', 'Alternative splicing', 'callout', 3.5, ''],
    ['How many 5-mers…', 'de Bruijn graphs', 'try', 3.8, ''],
    ['Video · genome assembly', 'de Bruijn graphs', 'resource', 4.1, ''],
    ['Why TPM, not counts', 'Expression units', 'text', 4.2, ''],
    ['Bridge: k-mers → graphs', 'Learn Salmon', 'connecting', 4.4, ''],
    ['Transcription start', 'Gene expression', 'text', 4.6, ''],
    ['codon-table data', 'The genetic code', 'figure', 4.8, ''],
  ];
  const row = ([t, n, k, v, note, o = {}]) => `<div style="display:grid;grid-template-columns:${cols};align-items:center;gap:10px;padding:0 12px;height:48px;border-top:1px solid ${c.border};font-size:13px;${o.focus ? `background:${c.selSoft};box-shadow:inset 3px 0 0 ${c.sel}` : ''}">
    ${qBox(false)}<div style="display:flex;flex-direction:column;min-width:0"><span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span><span style="font-size:11.5px;color:${c.ink3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span></div>
    <span style="font-family:${MONO};font-size:11.5px;color:${c.ink2}">${k}</span>${sc(v)}<span style="font-size:11.5px;color:${c.ink3}">${note}</span></div>`;
  const part = (k, v, why, col) => `<div style="display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:9px;background:${c.bg}"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span style="font-weight:600">${k}</span><span style="font-family:${MONO};color:${col}">${v}</span></div><span style="font-size:12.5px;line-height:1.45;color:${c.ink2}">${why}</span></div>`;
  const cond = (ok, t) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px"><span style="margin-top:1px;color:${ok ? c.ink2 : c.open}">${ok ? ic.check(c.ink2) : ic.close}</span><span style="color:${ok ? c.ink2 : c.ink};font-weight:${ok ? 400 : 600}">${t}</span></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('Review', 26)}<span style="font-size:13px;color:${c.ink2}">Lowest scores first. The score helps you choose where to look; only you approve.</span></div>
      ${qSearch('Search blocks, nodes')}
    </div>
    ${qViews([['Assigned to me', 9, 1], ['Low score (under 3.5)', 3], ['Judge unsure', 2], ['Stuck after redrafts', 1], ['Approved this week', 26]])}
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:12.5px;color:${c.ink3}">Filter</span>${qChip('Score under 4')}<span style="font-size:12.5px;color:${c.sel}">+ Block type</span><span style="font-size:12.5px;color:${c.sel}">+ Redrafted</span><span style="font-size:12.5px;color:${c.sel}">+ Region</span><span style="margin-left:auto">${qSort('score, lowest first')}</span></div>
    <div style="flex:1;display:grid;grid-template-columns:400px minmax(0, 1fr) 290px;gap:16px;min-height:0">
      <section style="${panel(c)};overflow:hidden;display:flex;flex-direction:column;min-height:0">
        <div style="display:grid;grid-template-columns:${cols};gap:10px;padding:9px 12px;font-size:11.5px;color:${c.ink3}">${qBox(false)}<span>Block · node</span><span>Type</span><span>Score</span><span></span></div>
        ${rows.map(row).join('')}
        <div style="margin-top:auto;padding:10px 12px;border-top:1px solid ${c.border};font-size:12px;color:${c.ink3}">9 blocks · 5 more at 4.0 and above hidden by the filter</div>
      </section>
      <section style="${panel(c)};padding:18px 20px;display:flex;flex-direction:column;gap:14px;min-width:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:12px;color:${c.ink3}">de Bruijn graphs · text block · drafted by AI, edited by [Author A]</span><span style="font-size:19px;font-weight:600">From reads to k-mers</span></div>
          ${seg(c, ['Standalone', 'With sources', 'Changes'], 1)}
        </div>
        <div style="display:grid;grid-template-columns:minmax(0, 1fr) minmax(0, 1fr);gap:14px">
          <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.65">
            <p style="margin:0">The trick is to stop treating reads as units. Slide a window of width <i>k</i> along each read and record every substring it covers: these are the read’s <b>k-mers</b>.<sup style="font-family:${MONO};font-size:10px;color:${c.sel}">[1]</sup></p>
            <p style="margin:0">Two reads that overlap share k-mers, so overlaps can be found by looking k-mers up in a table.<sup style="font-family:${MONO};font-size:10px;color:${c.sel}">[1]</sup> <span style="background:${c.openSoft};border-bottom:2px dotted ${c.open}">Every assembler since 2008 works this way.</span></p>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:10px;background:${c.bg};font-size:12.5px;line-height:1.5;color:${c.ink2}">
            <span style="font-weight:600;color:${c.ink}">[1] Compeau, Pevzner &amp; Tesler (2011)</span>
            <span>“…breaking reads into k-mers and forming a de Bruijn graph…” — p. 987</span>
            <span style="padding-top:6px;border-top:1px solid ${c.border};color:${c.open}">No source for the highlighted sentence.</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:600">Judge’s score · 2.9</span><span style="font-size:12px;color:${c.ink3}">[model, another family] · rubric text@v2 · redrafted once</span></div>
          <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">
            ${part('Accurate to sources', '2 / 5', 'Last sentence is unsourced and too strong: overlap-graph assemblers exist.', c.open)}
            ${part('Clear at this level', '4 / 5', 'Defines k-mers before using them; one idea per sentence.', c.ink2)}
            ${part('Serves the claim', '3 / 5', 'Says what k-mers are, not yet why lookups beat alignment.', c.meas)}
          </div>
          <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:9px;border:1px solid ${c.border};font-size:12.5px;color:${c.ink2}"><span style="font-weight:600;color:${c.ink}">Redraft history</span><span>v1 · 2.3 (no citation) → v2 · 2.9 (cited, one sentence left)</span></div>
        </div>
      </section>
      <aside style="${panel(c)};padding:16px;display:flex;flex-direction:column;gap:12px">
        <span style="font-size:14px;font-weight:600">Your decision</span>
        <div style="display:flex;flex-direction:column;gap:7px">${cond(true, 'Read standalone')}${cond(true, 'Sources opened')}${cond(false, 'Every unsourced sentence marked (1 left)')}${cond(true, 'You didn’t draft or edit it')}</div>
        <span style="padding:9px 12px;border-radius:9px;background:${c.border};color:${c.ink3};font-size:13px;font-weight:600;text-align:center">Approve · mark 1 sentence first</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${secondary(c, 'Request changes')}${secondary(c, 'Ask AI to redraft')}</div>
        <div style="display:flex;flex-direction:column;gap:6px;padding-top:12px;border-top:1px solid ${c.border}">
          <span style="font-size:13px;font-weight:600">Was the score right?</span>
          <span style="font-size:12px;color:${c.ink2};line-height:1.45">Your answer is how Quality measures the judge. It is needed before any block type could ever deploy without a person.</span>
          ${seg(c, ['Too high', 'About right', 'Too low'], 1)}
        </div>
        <div style="margin-top:auto;display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:${c.ink3}"><span>${kbd('A')} approve</span><span>${kbd('R')} request</span><span>${kbd('J')} ${kbd('K')} next / previous</span></div>
      </aside>
    </div>`;
  return studio('Review', inner, 1680, 1000);
}

// ── S18 Skeletons — draft nodes from a public outline ──────────
function skeletons() {
  const cols = '26px minmax(0, 1fr) minmax(0, 1.25fr) 128px 58px';
  const map = (m) => m === 'existing' ? greyTag('matches existing') : m === 'merge' ? amberTag('merge?') : blueTag('new node');
  const sc = (v) => `<span style="font-family:${MONO};font-size:12.5px;font-weight:600;color:${v < 3 ? c.open : v < 4 ? c.meas : c.ink2}">${v.toFixed(1)}</span>`;
  const rows = [
    ['6.1 DNA and RNA structure', 'DNA and genes', 'existing', 4.7, {}],
    ['6.2 Replication', 'DNA replication', 'new', 4.2, { sel: 1, needs: 'DNA and genes' }],
    ['6.3 Transcription and RNA processing', 'Transcription and splicing', 'new', 4.4, { sel: 1, focus: 1, needs: 'DNA and genes · Gene expression' }],
    ['6.4 Translation', 'Translation', 'new', 4.5, { sel: 1, needs: 'Transcription and splicing' }],
    ['6.5 Regulation of gene expression', 'Gene expression', 'merge', 3.6, { needs: '' }],
    ['6.6 Gene expression and specialization', 'Cell-type expression', 'new', 3.1, { needs: 'Gene expression' }],
    ['6.7 Mutations', 'Mutations and variants', 'new', 4.0, { needs: 'DNA replication' }],
    ['6.8 Biotechnology', 'Sequencing reads', 'existing', 3.9, {}],
  ];
  const row = ([item, stub, m, v, o]) => `<div style="display:grid;grid-template-columns:${cols};align-items:center;gap:10px;padding:0 14px;height:50px;border-top:1px solid ${c.border};font-size:13px;${o.focus ? `background:${c.selSoft};box-shadow:inset 3px 0 0 ${c.sel}` : o.sel ? `background:${c.bg}` : ''}">
    ${qBox(o.sel)}<span style="color:${c.ink2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item}</span>
    <div style="display:flex;flex-direction:column;min-width:0"><span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stub}</span>${o.needs ? `<span style="font-size:11.5px;color:${c.ink3};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">needs ${o.needs}</span>` : ''}</div>
    <span>${map(m)}</span>${sc(v)}</div>`;
  const step = (n, t, st) => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;${st === 'on' ? 'font-weight:600' : `color:${c.ink2}`}"><span style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:11px;${st === 'done' ? `background:${c.lineSoft};color:${c.btn}` : st === 'on' ? `background:${c.ink};color:${c.bg}` : `border:1.5px solid ${c.border2}`}">${st === 'done' ? '✓' : n}</span>${t}</div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('Skeletons', 26)}<span style="font-size:13px;color:${c.ink2}">Draft nodes and needs links from a public outline. A skeleton is never a track — accepted stubs go to Requests.</span></div>
      ${secondary(c, '+ Import an outline')}
    </div>
    <div style="${panel(c)};padding:14px 18px;display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:300px"><span style="${label(c)}">Outline</span><span style="font-size:15px;font-weight:600">AP Biology · Unit 6: Gene expression and regulation</span><span style="font-size:12px;color:${c.ink3}">College Board course description · public framework · imported 17 Sep</span></div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">${step(1, 'Import', 'done')}${step(2, 'AI proposes stubs and needs', 'done')}${step(3, 'Map to the graph', 'on')}${step(4, 'Send to Requests', '')}${step(5, 'Check coverage', '')}</div>
    </div>
    <div style="flex:1;display:grid;grid-template-columns:minmax(0, 1fr) 380px;gap:18px;min-height:0">
      <section style="position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13.5px;font-weight:600">8 topics → 6 new nodes, 2 existing, 1 merge</span></div>
          <div style="display:flex;gap:8px;align-items:center">${qSort('Outline order')}${seg(c, ['Table', 'Graph preview'], 0)}</div>
        </div>
        <div style="${panel(c)};overflow:hidden;flex:1;min-height:0">
          <div style="display:grid;grid-template-columns:${cols};gap:10px;padding:9px 14px;font-size:11.5px;color:${c.ink3}">${qBox(false)}<span>Outline topic</span><span>Proposed node · needs</span><span>In the graph</span><span>Score</span></div>
          ${rows.map(row).join('')}
        </div>
        ${bulkBar(3, [['Send to Requests', 'S'], ['Redraft', ''], ['Discard', '']])}
      </section>
      <aside style="display:flex;flex-direction:column;gap:14px;min-height:0">
        ${card(`<div style="display:flex;justify-content:space-between;align-items:center">${blueTag('New node')}<span style="font-size:12px;color:${c.ink3}">score 4.4</span></div>
          <span style="font-size:18px;font-weight:600">Transcription and splicing</span>
          <span style="font-size:13px;line-height:1.5;color:${c.ink2}"><b style="color:${c.ink};font-weight:600">Claim:</b> explain how a gene is copied into RNA and how introns are removed, so that one gene can give several transcripts.</span>
          <div style="display:flex;flex-direction:column;gap:6px">
            <span style="font-size:12.5px;font-weight:600">Needs, all of — with reasons</span>
            ${[['DNA and genes', 'transcription copies a gene’s sequence'], ['Gene expression', 'splicing changes what is expressed']].map(([n, r]) => `<div style="display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:8px;background:${c.bg}"><span style="font-family:${MONO};font-size:12.5px">${n}</span><span style="font-size:12px;color:${c.ink2}">${r}</span></div>`).join('')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${levelTag('Foundations · from the outline’s stage')}${greyTag('region: Biology')}${greyTag('on the Salmon route')}</div>
          <span style="font-size:12px;color:${c.ink3};line-height:1.45">Also needed by: Reference transcriptome (existing) — the proposed link is shown for review.</span>`)}
        ${card(`<span style="font-size:14.5px;font-weight:600">Coverage check · by a person</span>
          <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">Compare these nodes with reference courses and record gaps as requests. Khan Academy is read here by people, never fed to the model.</span>
          ${[['Khan Academy · AP Biology, gene expression unit', 'checked by [Reviewer A] · 2 gaps recorded'], ['OpenStax Biology 2e · ch. 15–16', 'not checked yet']].map(([t, st]) => `<div style="display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:8px;border:1px solid ${c.border}"><span style="font-size:13px">${t}</span><span style="font-size:11.5px;color:${c.ink3}">${st}</span></div>`).join('')}`)}
        ${card(`<span style="font-size:14.5px;font-weight:600">Sources the model may use</span>
          <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">College Board course descriptions · OpenStax (CC BY) · Galaxy Training (CC BY) · the Carpentries (CC BY). Sites whose terms forbid it are not on this list.</span>`)}
      </aside>
    </div>`;
  return studio('Skeletons', inner, 1680, 1060);
}

// ── S11 Quality — is the tutor teaching? is the judge right? ───
function quality() {
  const kpi = (v, t, sub) => `<div style="flex:1;display:flex;flex-direction:column;gap:3px;padding:14px 16px;${panel(c)}"><span style="font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums">${v}</span><span style="font-size:13px;font-weight:600">${t}</span><span style="font-size:12px;color:${c.ink2};line-height:1.4">${sub}</span></div>`;
  const agree = [['resource description', 91, 412, 'could be considered'], ['connecting text', 84, 236, 'more reviews needed'], ['text', 72, 518, 'no'], ['try · hints', 69, 190, 'no'], ['problem', 58, 64, 'never first'], ['figure data', 81, 88, 'never first']];
  const bar = ([t, v, n, st]) => `<div style="display:grid;grid-template-columns:150px minmax(0, 1fr) 44px 60px 150px;align-items:center;gap:12px;padding:8px 0;border-top:1px solid ${c.border};font-size:13px">
    <span style="font-family:${MONO};font-size:12px">${t}</span>
    <div style="position:relative;height:10px;border-radius:5px;background:${c.bg}"><div style="position:absolute;left:0;top:0;bottom:0;width:${v}%;border-radius:5px;background:${c.sel}"></div><div style="position:absolute;left:90%;top:-4px;bottom:-4px;width:2px;background:${c.ink}"></div></div>
    <span style="font-family:${MONO};font-variant-numeric:tabular-nums;text-align:right">${v}%</span>
    <span style="font-size:12px;color:${c.ink3};font-variant-numeric:tabular-nums">${n} rev.</span>
    <span style="display:flex;align-items:center;gap:6px;font-size:12px;color:${st === 'could be considered' ? c.ink : c.ink3}">${ic.lock}${st === 'could be considered' ? 'eligible for a spec' : st}</span></div>`;
  const fix = (kind, t, sub, action) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid ${c.border}">${kind}<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:13.5px;font-weight:600">${t}</span><span style="font-size:12px;color:${c.ink2}">${sub}</span></div>${secondary(c, action)}</div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:baseline;gap:14px">${h1('Quality', 26)}<span style="font-size:13px;color:${c.ink2}">Is the tutor teaching, and is the judge right? Aggregates only — never one learner.</span></div>
      ${seg(c, ['7 days', '30 days', 'All'], 1)}
    </div>
    <div style="display:flex;gap:14px">
      ${kpi('71%', 'Right on the next try after a step back', 'up from 48% on the first try · 1,204 step backs')}
      ${kpi('63%', 'Right after one hint', 'hints used on 22% of checks')}
      ${kpi('38%', 'Routes finished', 'of routes started 30+ days ago')}
      ${kpi('4', 'Resources marked “didn’t help”', 'by 5+ learners each · 1 link broken')}
    </div>
    <div style="flex:1;display:grid;grid-template-columns:minmax(0, 1.1fr) minmax(0, 1fr);gap:18px;min-height:0">
      ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600">Does the judge agree with reviewers?</span><span style="font-size:12px;color:${c.ink3}">line = 90%, the bar a spec would ask for</span></div>
        <span style="font-size:12.5px;color:${c.ink2};line-height:1.5">From every “Was the score right?” answer in Review. Automatic deployment stays locked for every type; a type above the line with enough reviews only becomes eligible for its own spec.</span>
        ${agree.map(bar).join('')}
        <span style="font-size:12px;color:${c.ink3}">Rubric versions: text@v2, try@v1, resource@v1, connecting@v3 · judge: [model, another family]</span>`, 'min-height:0')}
      ${card(`<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:15px;font-weight:600">Fix these</span><span style="font-size:12px;color:${c.ink3}">each row opens the place to act</span></div>
        ${fix(redTag('step back'), 'Selective alignment → k-mers', 'Most step backs lead here, but only 52% get the next try right. The k-mers page may not cover what this question needs.', 'Open node')}
        ${fix(amberTag('resource'), '[Khan Academy] Genome assembly · 2:10–7:45', 'Marked “didn’t help” by 9 learners on the Salmon route — the part may be too long.', 'Edit resource')}
        ${fix(redTag('broken link'), 'Galaxy Training · Mapping tutorial', 'Hidden from learners since 15 Sep; the page moved.', 'Replace link')}
        ${fix(greyTag('check'), 'How many 5-mers…', 'Everyone answers right without reading — it may not test anything.', 'Open check')}
        ${fix(greyTag('exam pool'), 'FASTQ on disk · question 3', 'Learners who know the page get it wrong as often as those who don’t — it doesn’t separate them.', 'Open pool')}
        ${fix(greyTag('route'), 'Learn Salmon · Expectation–maximisation', 'Where most learners stop. Time on page is 3× the estimate.', 'Open node')}`, 'min-height:0')}
    </div>`;
  return studio('Quality', inner, 1680, 880);
}

// ── L13 Exam — self-tests from node exam pools (tutor spec T7.1) ──
function examSetup() {
  const scope = (t, sub, n, on) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;${on ? `border:2px solid ${c.sel};background:${c.selSoft}` : `border:1px solid ${c.border2};background:${c.surface}`}">
    <span style="width:18px;height:18px;border-radius:50%;flex:none;${on ? `border:5px solid ${c.sel};background:${c.surface}` : `border:1.5px solid ${c.border2}`}"></span>
    <div style="display:flex;flex-direction:column;gap:2px;flex:1"><span style="font-size:14.5px;font-weight:600">${t}</span><span style="font-size:12.5px;color:${c.ink2}">${sub}</span></div>
    <span style="font-family:${MONO};font-size:12px;color:${c.ink3}">${n}</span></div>`;
  const opt = (s, st) => `<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:12px;font-size:15px;${st ? `border:2px solid ${c.sel};background:${c.selSoft}` : `border:1px solid ${c.border2};background:${c.surface}`}"><span style="width:18px;height:18px;border-radius:50%;flex:none;${st ? `border:5px solid ${c.sel};background:${c.surface}` : `border:1.5px solid ${c.border2}`}"></span>${s}</div>`;
  return page(1440, 860, `${learnBar()}
  <main style="flex:1;display:grid;grid-template-columns:520px minmax(0, 1fr);gap:28px;padding:28px 36px;min-height:0">
    <section style="${panel(c)};padding:22px 24px;display:flex;flex-direction:column;gap:18px;align-self:start">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="${label(c)}">Learn Salmon · Test yourself</span>
        ${h1('Check what you know', 28)}
        <span style="font-size:13.5px;color:${c.ink2};line-height:1.5">Built from each page’s exam questions, graded automatically. Results are per page, on your route — no grade, nothing shared.</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span style="font-size:13.5px;font-weight:600">What to cover</span>
        ${scope('What I’ve done so far', 'the 5 pages you know or started on this route', '5 pages', true)}
        ${scope('The whole route', '12 of 13 pages — also a way to test out of everything', '12 pages')}
        ${scope('One line', 'Data · Reads · Index', '')}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span style="font-size:13.5px;font-weight:600">How long</span>
        ${seg(c, ['About 15 min · 12 questions', '30 min · 24', '60 min · 45'], 0)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;padding:12px 14px;border-radius:10px;background:${c.bg};font-size:12.5px;line-height:1.5;color:${c.ink2}">
        <span>Questions are mixed across pages and weighted toward what you tested longest ago. Numbers and sequences change each time.</span>
        <span>No hints and no answers until the end. You can stop and come back.</span>
        <span style="color:${c.ink3}">Selective alignment isn’t included: its exam questions aren’t reviewed yet.</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;color:${c.ink3}">Last test on this route: 9 days ago</span>${primary(c, 'Start the test', '')}</div>
    </section>

    <section style="display:flex;flex-direction:column;gap:0;border-radius:14px;overflow:hidden;border:1px solid ${c.border};background:${c.bg}">
      <div style="padding:8px 14px;font-size:12px;color:${c.ink3};border-bottom:1px solid ${c.border};background:${c.surface}">In progress — what the test looks like</div>
      ${focusBar('Test · Learn Salmon', progress(4, 4, 12), `<span style="font-size:13px;color:${c.ink2}">Stop and save</span>`)}
      <div style="display:flex;flex-direction:column;gap:18px;padding:32px 40px">
        <span style="${label(c)}">Question 5 of 12 · no hints in a test</span>
        ${h1('A FASTQ record’s quality line reads <span style="font-family:' + MONO + '">II5+#</span>. Which base is the least reliable?', 26)}
        <pre style="margin:0;padding:14px 16px;border-radius:10px;background:${c.surface};border:1px solid ${c.border};font-family:${MONO};font-size:14px;line-height:1.7;color:${c.ink}">@read_812
GATTA
+
II5+#</pre>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
          ${opt('Base 1 · G')}${opt('Base 3 · T')}${opt('Base 4 · T')}${opt('Base 5 · A', true)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12.5px;color:${c.ink3}">The page this question comes from is shown with your results.</span>
          ${primary(c, 'Next question', '')}
        </div>
      </div>
    </section>
  </main>`);
}

function examResults() {
  const res = { dna: 'confirmed', expr: 'shaky', reads: 'confirmed', rnaseq: 'confirmed', fastq: 'notyet' };
  const pill = (x, y, st) => {
    const [txt, bg, fg, w] = st === 'confirmed' ? ['confirmed', c.surface, c.ink2, 78] : st === 'shaky' ? ['shaky', c.measSoft, c.meas, 52] : ['not yet', c.openSoft, c.open, 60];
    return `<rect x="${x - w / 2}" y="${y}" width="${w}" height="20" rx="10" style="fill:${bg};stroke:${st === 'confirmed' ? c.border2 : bg};stroke-width:1"></rect><text x="${x}" y="${y + 14}" text-anchor="middle" style="font-family:${UI};font-size:11.5px;font-weight:600;fill:${fg}">${txt}</text>`;
  };
  const marks = Object.entries(res).map(([k, st]) => { const [, x, y] = MS[k]; return pill(x, y + 14, st); }).join('');
  const map = routeMetro({ sel: null }).replace(/<\/svg>$/, marks + '</svg>');
  const nodeRow = (n, st, got, why, action) => `<div style="display:grid;grid-template-columns:minmax(0, 1fr) 90px 70px minmax(0, 1.4fr) 170px;align-items:center;gap:14px;padding:12px 16px;border-top:1px solid ${c.border};font-size:13.5px">
    <span style="font-weight:600">${n}</span>
    <span>${st === 'confirmed' ? greyTag('confirmed') : st === 'shaky' ? amberTag('shaky') : redTag('not yet')}</span>
    <span style="font-family:${MONO};font-size:12.5px;color:${c.ink2}">${got}</span>
    <span style="font-size:12.5px;color:${c.ink2};line-height:1.45">${why}</span>
    <span style="display:flex;justify-content:flex-end">${action}</span></div>`;
  return page(1440, 1320, `${learnBar()}
  <main style="flex:1;display:flex;flex-direction:column;gap:18px;padding:24px 36px 32px;min-height:0">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:13px;color:${c.ink3}">Learn Salmon › Test yourself › Results</span>
        ${h1('What the test showed', 32)}
        <span style="font-size:14.5px;color:${c.ink2}">What you’ve done so far · 12 questions · 16 min · 9 of 12 answered right</span>
      </div>
      <div style="display:flex;gap:8px">${secondary(c, 'Review the answers')}${secondary(c, 'Test again')}${primary(c, 'Back to the route', '')}</div>
    </div>
    <div style="display:flex;gap:14px">
      ${[['3 pages confirmed', 'they stay known on your route', c.ink], ['1 page shaky', 'added to your next review', c.meas], ['1 page not yet', 'back on your route, with a step back offered', c.open]].map(([t, sub, col]) => `<div style="flex:1;display:flex;flex-direction:column;gap:2px;padding:14px 18px;${panel(c)}"><span style="font-size:18px;font-weight:600;color:${col}">${t}</span><span style="font-size:12.5px;color:${c.ink2}">${sub}</span></div>`).join('')}
    </div>
    <section style="${panel(c)};padding:14px 18px 10px;display:flex;flex-direction:column;gap:6px">
      ${map}
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;font-size:12px;color:${c.ink2}">
        <span>Only the pages in this test are marked. Confirmed spends no colour; shaky is amber; not yet is red.</span>
      </div>
    </section>
    <section style="${panel(c)};overflow:hidden">
      <div style="display:grid;grid-template-columns:minmax(0, 1fr) 90px 70px minmax(0, 1.4fr) 170px;gap:14px;padding:10px 16px;font-size:11.5px;color:${c.ink3}"><span>Page</span><span>Result</span><span>Right</span><span>What the wrong answers point at</span><span></span></div>
      ${nodeRow('FASTQ on disk', 'notyet', '0 of 2', 'Both answers read quality characters as numbers. The step back goes to <b style="color:' + c.ink + ';font-weight:600">Sequencing reads</b> → base quality.', primary(c, 'Step back', ''))}
      ${nodeRow('Gene expression', 'shaky', '2 of 3', 'Mixed up transcripts and genes once. Added to review in 1 day.', secondary(c, 'Open page'))}
      ${nodeRow('DNA and genes', 'confirmed', '2 of 2', '—', '')}
      ${nodeRow('Sequencing reads', 'confirmed', '3 of 3', '—', '')}
      ${nodeRow('RNA-seq experiments', 'confirmed', '2 of 2', '—', '')}
    </section>
    <span style="font-size:12.5px;color:${c.ink3}">A self-test isn’t a certificate and has no overall grade. Your answers are kept as evidence for what the route shows you.</span>
  </main>`);
}

// ── S3 Exam pool — a question built from blocks, like a page (tutor spec T7.1) ──
function questionBuilder() {
  const mini = (kind) => {
    const n = (x, y, f = c.surface, s = c.ink2, d = 0) => `<circle cx="${x}" cy="${y}" r="6" style="fill:${f};stroke:${s};stroke-width:1.8;${d ? 'stroke-dasharray:3 2' : ''}"></circle>`;
    const l = (d, col = c.line, dash = 0) => `<path d="${d}" style="fill:none;stroke:${col};stroke-width:2;${dash ? 'stroke-dasharray:4 3;' : ''}stroke-linejoin:round"></path>`;
    let s = `<svg viewBox="0 0 160 60" width="160" height="60" style="display:block">`;
    if (kind === 'bubble') s += l('M14 36 H146') + l('M58 36 Q80 8 102 36', c.open, 1) + [14, 58, 102, 146].map(x => n(x, 36)).join('') + n(80, 16, c.openSoft, c.open, 1);
    if (kind === 'tip') s += l('M14 36 H146') + l('M102 36 L132 12', c.measBar, 1) + [14, 58, 102, 146].map(x => n(x, 36)).join('') + n(132, 12, c.measSoft, c.measBar, 1);
    if (kind === 'repeat') s += l('M14 16 L80 36 L14 56') + l('M80 36 L146 16 M80 36 L146 56') + [[14, 16], [14, 56], [146, 16], [146, 56]].map(([x, y]) => n(x, y)).join('') + n(80, 36, c.surface, c.ink, 0);
    if (kind === 'clean') s += l('M14 36 H146') + [14, 50, 86, 122, 146].map(x => n(x, 36)).join('');
    return s + '</svg>';
  };
  const qRow = (n, t, type, st, sc, on) => `<div style="display:flex;flex-direction:column;gap:3px;padding:9px 10px;border-radius:9px;${on ? `background:${c.selSoft};box-shadow:inset 3px 0 0 ${c.sel}` : `border:1px solid ${c.border};background:${c.surface}`}">
    <div style="display:flex;justify-content:space-between;gap:6px"><span style="font-family:${MONO};font-size:11px;color:${c.ink3}">Q${n} · ${type}</span><span style="font-family:${MONO};font-size:11px;color:${sc === '—' ? c.ink3 : parseFloat(sc) < 4 ? c.meas : c.ink2}">${sc}</span></div>
    <span style="font-size:12.5px;font-weight:${on ? 600 : 500};line-height:1.35">${t}</span>
    <span style="font-size:11px;color:${st === 'approved' ? c.ink3 : st === 'draft' ? c.sel : c.meas}">${st}</span></div>`;
  const opt = (letter, kind, label, mis, right) => `<div style="display:grid;grid-template-columns:26px 170px minmax(0, 1fr) auto;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;${right ? `border:2px solid ${c.btn};background:${c.lineSoft}` : `border:1px solid ${c.border};background:${c.surface}`}">
    <span style="width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:${MONO};font-size:12px;font-weight:600;${right ? `background:${c.btn};color:#FFFFFF` : `border:1.5px solid ${c.border2};color:${c.ink2}`}">${letter}</span>
    <div style="border-radius:8px;border:1px solid ${c.border};background:${c.bg};padding:2px 4px">${mini(kind)}</div>
    <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-family:${MONO};font-size:10.5px;color:${c.ink3}">figure="graph-artifacts" · alt text set</span><span style="font-size:13px;font-weight:500">${label}</span><span style="font-size:12px;color:${right ? c.btn : c.ink2}">${right ? 'Correct answer' : `Misconception: ${mis}`}</span></div>
    <span style="font-size:12px;color:${c.sel}">Edit</span></div>`;
  const check = (ok, t) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px"><span style="margin-top:1px;color:${ok ? c.ink2 : c.open}">${ok ? ic.check(c.ink2) : ic.close}</span><span style="color:${ok ? c.ink2 : c.ink};font-weight:${ok ? 400 : 600}">${t}</span></div>`;
  const inner = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;gap:4px">
        <span style="font-size:12.5px;color:${c.ink3}">Graph › Algorithms › de Bruijn graphs</span>
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:24px;font-weight:600">de Bruijn graphs</span>${blueTag('Exam pool · 5 of 6 approved')}</div>
      </div>
      <div style="display:flex;gap:8px">${secondary(c, 'Draft a question with AI')}${primary(c, 'Submit Q6 for review', '')}</div>
    </div>
    <div style="display:flex;gap:2px;border-bottom:1px solid ${c.border}">${[['Content'], ['Resources'], ['Exam pool', 1], ['Links'], ['Problem'], ['Settings']].map(([t, on]) => `<span style="padding:8px 16px;font-size:13.5px;${on ? `font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${t}</span>`).join('')}</div>
    <div style="flex:1;display:grid;grid-template-columns:230px minmax(0, 1fr) 460px;gap:18px;min-height:0">
      <aside style="display:flex;flex-direction:column;gap:8px;min-height:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600">Questions</span><span style="font-size:12px;color:${c.sel}">+ New</span></div>
        ${qRow(1, 'Count the edges from 4 reads, k = 3', 'number · seeded', 'approved', '4.6')}
        ${qRow(2, 'Spell the sequence along a path', 'sequence · seeded', 'approved', '4.4')}
        ${qRow(3, 'Is a k-mer a node or an edge here?', 'choice', 'approved', '4.2')}
        ${qRow(4, 'Put the assembly steps in order', 'order', 'approved', '4.0')}
        ${qRow(5, 'Click the tip in this graph', 'figure interaction', 'approved', '4.5')}
        ${qRow(6, 'Which mark does a mid-read error leave?', 'choice with figures', 'draft', '3.8', true)}
        <span style="font-size:11.5px;color:${c.ink3};line-height:1.45;padding-top:4px">A node needs at least 4 approved questions to be included in tests. No hints in exam questions.</span>
      </aside>

      <section style="display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:15px;font-weight:600">Q6 · Which mark does a mid-read error leave?</span><span style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:${c.ink3}">tests the claim: recognise the marks errors leave</span>${levelTag('Intermediate')}</span></div>
        <div style="${panel(c)};display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid ${c.border}"><span style="font-size:12.5px;font-weight:600">Stem</span><span style="font-size:12px;color:${c.ink3}">blocks, as on a page</span></div>
          <div style="display:flex;flex-direction:column;gap:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;border:1px solid ${c.border}"><span style="font-family:${MONO};font-size:11px;padding:1px 7px;border-radius:5px;background:${c.bg};border:1px solid ${c.border};color:${c.ink2}">text</span><span style="font-size:13.5px">This graph was built from reads with k = 3. One read has a single wrong base in its middle. Which kind of mark did that read leave?</span></div>
            <div style="display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-radius:9px;border:2px solid ${c.sel};background:${c.surface}">
              <div style="display:flex;align-items:center;gap:10px"><span style="font-family:${MONO};font-size:11px;padding:1px 7px;border-radius:5px;background:${c.selSoft};border:1px solid ${c.sel};color:${c.sel}">figure</span><span style="font-size:13px;font-weight:600">graph-artifacts</span><span style="font-size:12px;color:${c.ink3}">data from seed · labels off, so it doesn’t give the answer · alt text set</span><span style="margin-left:auto;font-size:12px;color:${c.sel}">Open in figure composer</span></div>
              <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:8px;padding:6px 10px">${F.bubble(false)}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;padding:6px 8px;border-radius:9px;border:1px dashed ${c.border2}"><span style="font-size:12px;color:${c.ink3};padding:3px 4px 3px 0">Add to stem</span>${['text', 'figure', 'image', 'math', 'table', 'code', 'sequence'].map(t => `<span style="font-family:${MONO};font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid ${c.border2}">${t}</span>`).join('')}</div>
          </div>
        </div>
        <div style="${panel(c)};display:flex;flex-direction:column">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid ${c.border}"><span style="font-size:12.5px;font-weight:600">Answer</span>${seg(c, ['Choice', 'Number', 'Sequence', 'Figure interaction', 'Order'], 0)}</div>
          <div style="display:flex;flex-direction:column;gap:8px;padding:12px">
            ${opt('A', 'bubble', 'A bubble: the path splits and rejoins', '', true)}
            ${opt('B', 'tip', 'A tip: a short dead end', 'confuses an error mid-read with one near the end')}
            ${opt('C', 'repeat', 'Paths merging at a shared node', 'reads a repeat as an error')}
            ${opt('D', 'clean', 'A single unbranched path', 'thinks errors leave no mark')}
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:${c.ink2}"><span>Options are shuffled per learner. Each option is its own block and can hold text, a figure or an image.</span><span style="color:${c.sel}">+ Option</span></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px">
          ${card(`<span style="font-size:12.5px;font-weight:600">Variants</span><span style="font-size:12px;color:${c.ink2};line-height:1.45">Seeded: the component draws a new graph and error position per learner.</span><div style="display:flex;gap:5px">${['#1', '#2', '#3', '#4', '… 20'].map((s, i) => `<span style="font-family:${MONO};font-size:11.5px;padding:3px 8px;border-radius:6px;${i === 0 ? `background:${c.ink};color:${c.bg}` : `border:1px solid ${c.border2};color:${c.ink2}`}">${s}</span>`).join('')}</div>`)}
          ${card(`<span style="font-size:12.5px;font-weight:600">Rationale · shown only in results</span><span style="font-size:12px;color:${c.ink2};line-height:1.45">A wrong base in the middle creates k-mers found in one read only; the path leaves and rejoins the true path — a bubble.</span>`)}
        </div>
      </section>

      <aside style="${panel(c)};display:flex;flex-direction:column;min-height:0;overflow:hidden">
        <div style="display:flex;border-bottom:1px solid ${c.border}">${[['Preview as in a test', 1], ['Checks', 0, 1], ['Score'], ['History']].map(([t, on, n]) => `<span style="display:flex;align-items:center;gap:6px;padding:10px 12px;font-size:13px;${on ? `font-weight:600;box-shadow:inset 0 -2px 0 ${c.ink}` : `color:${c.ink2}`}">${t}${n ? `<span style="font-size:11px;padding:0 6px;border-radius:999px;background:${c.openSoft};color:${c.open}">${n}</span>` : ''}</span>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px">${seg(c, ['Desktop', 'Phone', 'Dark'], 0)}<span style="font-family:${MONO};font-size:11.5px;color:${c.ink3}">seed #1</span></div>
        <div style="margin:0 14px;border-radius:10px;border:1px solid ${c.border};background:${c.bg};padding:14px;display:flex;flex-direction:column;gap:10px">
          <span style="font-size:11px;color:${c.ink3}">Question 7 of 12 · no hints in a test</span>
          <span style="font-size:15px;font-weight:600;line-height:1.35">This graph was built from reads with k = 3. One read has a single wrong base in its middle. Which kind of mark did that read leave?</span>
          <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:8px;padding:4px 8px">${F.bubble(false)}</div>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px">${['tip', 'clean', 'bubble', 'repeat'].map((k, i) => `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:8px;border:1px solid ${c.border2};background:${c.surface}"><span style="font-family:${MONO};font-size:11px;color:${c.ink3}">${'ABCD'[i]}</span><div style="transform:scale(.8);transform-origin:left center;height:48px">${mini(k)}</div></div>`).join('')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;padding:14px">
          <span style="font-size:13px;font-weight:600">Checks</span>
          ${check(true, 'One correct answer on all 20 seeds')}${check(true, 'Every figure and image has alt text')}${check(true, 'Each distractor names a misconception')}${check(true, 'No hint in an exam question')}${check(false, 'Seed #14: options B and C draw the same graph')}
        </div>
      </aside>
    </div>`;
  return studio('Graph', inner, 1680, 1380, { collapsed: true });
}

// ── L5 Node at First steps — a design-round draft (tutor spec T10.2) ──
function firstStepsNode() {
  const cellFig = () => {
    let s = `<svg viewBox="0 0 760 280" width="100%" style="display:block">`;
    s += `<ellipse cx="170" cy="140" rx="140" ry="110" style="fill:${c.lineSoft};stroke:${c.line};stroke-width:3"></ellipse>`;
    s += `<circle cx="190" cy="140" r="46" style="fill:${c.surface};stroke:${c.ink2};stroke-width:3"></circle>`;
    s += `<path d="M168 128 C180 112 200 112 212 128 S236 150 214 158 S176 166 168 150" style="fill:none;stroke:${c.sel};stroke-width:3.5;stroke-linecap:round"></path>`;
    s += `<text x="170" y="270" text-anchor="middle" style="font-family:${UI};font-size:17px;font-weight:600;fill:${c.ink}">a cell</text>`;
    s += `<path d="M250 110 C320 60 380 60 430 80" style="fill:none;stroke:${c.ink3};stroke-width:2;stroke-dasharray:5 5"></path><path d="M422 72 L432 80 L420 86" style="fill:none;stroke:${c.ink3};stroke-width:2"></path>`;
    s += `<rect x="440" y="40" width="300" height="200" rx="18" style="fill:${c.surface};stroke:${c.border2};stroke-width:2"></rect>`;
    const bases = 'ATGCGTAC'; [...bases].forEach((b, i) => {
      const x = 470 + i * 32;
      s += `<rect x="${x}" y="100" width="26" height="36" rx="6" style="fill:${c.selSoft};stroke:${c.sel};stroke-width:2"></rect><text x="${x + 13}" y="124" text-anchor="middle" style="font-family:${MONO};font-size:17px;font-weight:500;fill:${c.ink}">${b}</text>`;
    });
    s += `<text x="590" y="80" text-anchor="middle" style="font-family:${UI};font-size:16px;font-weight:600;fill:${c.ink}">inside: instructions</text>`;
    s += `<text x="590" y="176" text-anchor="middle" style="font-family:${UI};font-size:15px;fill:${c.ink2}">written with just 4 letters:</text>`;
    s += `<text x="590" y="204" text-anchor="middle" style="font-family:${MONO};font-size:19px;font-weight:500;fill:${c.ink}">A · T · G · C</text>`;
    return s + '</svg>';
  };
  const big = (t, st) => `<div style="display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:14px;font-size:19px;${st === 'right' ? `border:2.5px solid ${c.btn};background:${c.lineSoft}` : `border:1.5px solid ${c.border2};background:${c.surface}`}">${st === 'right' ? ic.check(c.btn) : `<span style="width:20px;height:20px;border-radius:50%;border:2px solid ${c.border2};flex:none"></span>`}${t}</div>`;
  return page(1440, 2040, `${learnBar()}
  <div style="height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 36px;border-bottom:1px solid ${c.border};background:${c.surface};font-size:15px;color:${c.ink2}">
    <span>On your route <b style="color:${c.ink};font-weight:600">Learn Salmon</b> · the very first stop</span>
    <span>1 of 2 questions</span>
    <a style="font-weight:500">Back to the route</a>
  </div>
  <main style="flex:1;display:flex;justify-content:center;padding:44px 36px">
    <article style="width:820px;display:flex;flex-direction:column;gap:28px">
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:10px">${levelTag('First steps')}<span style="font-size:16px;color:${c.ink2}">About 10 minutes</span></div>
        ${h1('Living things carry instructions', 48)}
        <p style="margin:0;font-size:21px;line-height:1.6;color:${c.ink}">Every living thing — you, a tree, a bacterium — is built from tiny cells. Each cell carries a set of instructions for how to grow and what to do.</p>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;border-radius:14px;background:${c.surface};border:1px solid ${c.border}">
        <span style="font-size:16px;color:${c.ink2}">Prefer to watch? A short video explains the same idea.</span>${seg(c, ['Read', 'Watch · 4 min'], 0)}
      </div>

      <section style="display:flex;flex-direction:column;gap:16px">
        <h2 style="margin:0;font-size:30px;font-weight:600;letter-spacing:-.01em">1 · The instructions are inside each cell</h2>
        <p style="margin:0;font-size:20px;line-height:1.65;color:${c.ink2}">Inside most cells there is a small space that holds the instructions. They are written in a chemical called <b style="color:${c.ink};font-weight:600">DNA</b>.</p>
        <figure style="margin:0;display:flex;flex-direction:column;gap:10px">
          <div style="${gridBg(c)};border:1px solid ${c.border};border-radius:16px;padding:18px 22px">${cellFig()}</div>
          <figcaption style="font-size:16px;color:${c.ink2};line-height:1.5">A cell, and the instructions inside it. Drawn from data; letters are real DNA letters.</figcaption>
        </figure>
      </section>

      <section style="display:flex;flex-direction:column;gap:14px;padding:26px 28px;border-radius:18px;border:2px solid ${c.sel};background:${c.surface}">
        <span style="font-size:15px;font-weight:600;color:${c.sel}">Try it · question 1</span>
        <span style="font-size:24px;font-weight:600;line-height:1.35">How many different letters does DNA use to write its instructions?</span>
        <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">${big('2')}${big('4', 'right')}${big('10')}${big('26, like our alphabet')}</div>
        <div style="display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:14px;background:${c.lineSoft}">
          <span style="font-size:19px;font-weight:600;color:${c.btn}">Right — 4 letters.</span>
          <span style="font-size:17px;line-height:1.55">DNA uses only A, T, G and C. Long strings of these 4 letters are enough to write every instruction a living thing needs.</span>
        </div>
        <span style="display:inline-flex;align-self:flex-start;align-items:center;gap:8px;padding:12px 18px;border-radius:12px;border:1.5px solid ${c.border2};font-size:16px;color:${c.ink2}">Show a hint</span>
      </section>

      <section style="display:flex;flex-direction:column;gap:16px">
        <h2 style="margin:0;font-size:30px;font-weight:600;letter-spacing:-.01em">2 · Why this matters for your goal</h2>
        <div style="display:flex;align-items:flex-start;gap:12px;padding:16px 20px;border-radius:14px;background:${c.lineSoft}">
          <span style="font-size:18px;line-height:1.6;flex:1">Salmon, the tool you want to learn, reads the letters in these instructions — millions of them — to work out what each cell is doing.</span>${amberTag()}
        </div>
      </section>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:22px 24px;border-radius:18px;background:${c.surface};border:1px solid ${c.border}">
        <div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:15px;color:${c.ink3}">Next on your route</span><span style="font-size:24px;font-weight:600">DNA and genes</span>${levelTag('Foundations')}</div>
        <span style="display:inline-flex;align-items:center;gap:10px;padding:16px 28px;border-radius:14px;background:${c.btn};color:${c.btnInk};font-size:18px;font-weight:600;box-shadow:0 3px 0 ${c.btnSh}">Continue ${ic.arrow}</span>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:14px;border:1px solid ${c.border};font-size:15px;line-height:1.6;color:${c.ink2}">
        <span style="font-weight:600;color:${c.ink}">Where this comes from</span>
        <span>OpenStax Biology 2e, §3.5 and §14.2 (CC BY 4.0). Reviewed by [Reviewer name]. The green text is AI-written and not yet reviewed.</span>
      </div>
    </article>
  </main>`);
}

// ── write everything ────────────────────────────────────────────
const LEARN = [
  ['Main', 'L3 · Home — the overview', home(), 1440, 1120, 'Reached from: the logo, every return visit, closing a page.\nLeads to: Continue, the route shown (last opened), a ready node, Review, the weekly problem, Your whole network.\nOnly the route you last opened is drawn here; the full network lives on Your knowledge.'],
  ['Start', 'L1 · Start — what do you want to learn?', start(), 1440, 1300, 'Reached from: first visit, “Learn something new”, “Ask for a goal”, a search with no match.\nLeads to: placement, or the route.\nTargets are suggested and confirmed by the learner; the route is computed from what each page needs.'],
  ['Placement', 'L2 · Placement — the first station of the tutor loop', placement(), 1440, 800, 'Reached from: Start (“Place me first”), Route, Home.\nLeads to: the shortened route.\nOne question per candidate stop, no hints, no score (tutor spec T3). A right answer drops the stop and what only it needed; “I don’t know this yet” keeps it. The side panel shows the route shortening as you go. The goal itself is never tested out of.'],
  ['Route', 'L4 · Route — map, selected stop, next up, detours, milestones', route(), 1440, 1480, 'Reached from: Home, Start, Explore.\nLeads to: any ready node, following a missing node, the Labs pipeline at the end.\nTop: the outcome, honest time left with a pace estimate, progress per line (near goals keep people going). Map + selected-stop panel (the roadmap.sh pattern). Bottom: what can start now (max 4), a suggested step back when an answer revealed a gap (tutor spec T6.1 — a visit, not a change of order), and milestones — a problem per line, the Labs pipeline at the end. The route shows its level span and where it starts for you (T10.1) — levels describe pages, never you, and never change the route.'],
  ['Node', 'L5 · Node — learn it, blocks, questions with hints, a step back', node(), 1440, 5420, 'Reached from: a route, Continue, search, Needed-by / Goes-deeper links, Labs.\nLeads to: needs (back), goes deeper / related (sideways), needed by (forward), the problem, back to the route.\nA block document: every dark tag names the block type the AI wrote through the Studio API (toggle “showBlocks”). Learn it (tutor spec T4): Read / Watch, an embedded outside video playing only the part it covers, and linked readings and tutorials, each with provider and licence. Checks carry hints and a rationale; a wrong answer that reveals a gap offers a step back to the prerequisite (T6). Figures are library components filled with data; the image carries author and licence. Try-it questions return in review; the Rosalind-style problem settles the node.'],
  ['NodeFirstSteps', 'L5 · Node at First steps — design-round draft', firstStepsNode(), 1440, 2040, 'Reached from: a route that starts at First steps, search.\nTutor spec T10.2: First steps is in the MVP, and its pages get their own design round before M3. This draft keeps the identity, the route strip, provenance and the tutor loop, and changes only what the level needs: one column, larger type (19–21 px body), short numbered sections, one idea each, big answer buttons, Read / Watch, and the next stop with its level. No points, no mascots, no streaks — the same rules as every level.'],
  ['ExamSetup', 'L13 · Exam — set up, and a test in progress', examSetup(), 1440, 860, 'Reached from: Test yourself on Route and Home.\nLeads to: results.\nTutor spec T7.1: choose a scope (what I’ve done so far, the whole route, one line) and a length; questions come from each page’s reviewed exam pool, mixed across pages, seeded so retakes differ. No hints or answers until the end; stop and resume. Pages without a reviewed pool are left out and named.'],
  ['ExamResults', 'L13 · Exam — results per page, on the route', examResults(), 1440, 1320, 'Reached from: finishing or stopping a test.\nLeads to: step back, review, the route.\nResults are per page, never a grade: confirmed (no colour), shaky (amber — added to review), not yet (red — back on the route, with a step back to what the wrong answers point at). Drawn on the metro map with a table. Not a certificate.'],
  ['Explore', 'L12 · Explore — search and filter at scale', explore(), 1440, 1120, 'Reached from: Home, search.\nLeads to: starting or continuing a track; Start to ask for a new goal.\nSearch first; filters with counts; applied filters as removable chips; dense rows sorted by how much you already hold. Network view shows only filtered tracks.'],
  ['Knowledge', 'L9 · Your knowledge — areas that may not connect', knowledge(), 1440, 1480, 'Reached from: the account menu, “Your whole network” on Home.\nLeads to: any node, review, re-placement.\nAreas that share no nodes are drawn as separate maps and join automatically when a route links them. A List view covers everything as text.'],
  ['AccountMenu', 'Account menu', account(), 320, 420, 'Opened from the avatar on every learner page: knowledge, solved problems, routes, theme, and Studio for the team.'],
];
const STUDIO = [
  ['Requests', 'S7 · Requests — a triage queue for dozens', requests(), 1680, 1000, 'Reached from: Inbox, the rail.\nLeads to: Implementing (accept), an existing node (merge), or a declined note the learner sees.\nSaved views, filters with counts, a dense table with duplicates collapsed, a detail pane, a bulk bar and one-key decisions (Linear’s triage pattern). The model proposes and groups; only a person moves a request, and each decision is logged.'],
  ['Implementing', 'S8 · Implementing — grouped by stage', implementing(), 1680, 1000, 'Reached from: accepting a request.\nLeads to: the node workbench (open), review, land.\nSaved views, filters, rows grouped by stage and collapsible, bulk assign, a stalled flag instead of due dates, and team load to help assign.'],
  ['WeaveReview', 'S9 · Weave review — texts pinned where learners read them', weaveReview(), 1680, 1040, 'Reached from: Tracks in the rail, Inbox.\nLeads to: a published named track in Explore.\nEach number on the map is a text the AI wrote. Pick one (or J/K through them): it sits beside the two claims it may use and its automatic checks; approve, suggest an edit, or ask for a rewrite (GitHub-review style). The strip below tracks every text by kind.'],
  ['Workbench', 'S3 · Node workbench — outline · blocks · live preview', workbench(), 1680, 1060, 'Reached from: a node in Graph, Implementing, Inbox.\nLeads to: the figure composer, problem builder, review.\nTutor spec additions: a Resources tab (outside videos and readings with provider, part and licence); every drafted block carries a judge score with named parts and reasons, a redraft count, and the judge model (never the drafter’s family); a block that fails a check is not scored.\nCMS patterns: tabs (Content, Links, Problem, Settings); an outline of blocks (Gutenberg list view); the block editor with add-block points; side panels (Preview, Checks, Sources, History, Comments) with a live, click-to-edit preview (Wagtail, Sanity, Storyblok); a pre-submit checklist.'],
  ['QuestionBuilder', 'S3 · Exam pool — a question built from blocks', questionBuilder(), 1680, 1380, 'Reached from: the Exam pool tab of a node’s workbench.\nTutor spec T7.1, authoring questions: a question is a small block document built with the same editor as a page. The stem holds text, figures (library components filled with data), images with licence, math, tables, code or sequences; the answer is choice (options that hold figures or images), number, sequence, figure interaction or order. Seeded variants are checked across 20 seeds; each distractor names a misconception; the rationale shows only in results; no hints. Preview shows it exactly as in a test.'],
  ['FigureComposer', 'S4 · Figure composer — choose · data · interaction · describe', composer(), 1680, 1060, 'Reached from: the Figure hole in the workbench.\nData first, as a sheet (Datawrapper, Flourish); settings generated from the component’s schema (Storybook controls); the assistant can make described changes; preview with every interaction state; a Describe step for caption, alt text and data source; checks that point at the field to fix; the component version pinned, with where else it’s used.'],
  ['Review', 'S6 · Review — approve blocks, lowest score first', reviewStudio(), 1680, 1000, 'Reached from: the rail, Inbox, Implementing.\nTutor spec T8: blocks sorted and filtered by the judge’s score; the block shown standalone and beside its sources; the score’s named parts with reasons and the redraft history; Approve stays inert until its conditions hold (you didn’t draft it, sources opened, unsourced sentences marked). “Was the score right?” feeds judge–human agreement in Quality.'],
  ['Skeletons', 'S18 · Skeletons — nodes drafted from a public outline', skeletons(), 1680, 1060, 'Reached from: the rail (Content).\nLeads to: Requests (accepted stubs), Graph.\nTutor spec T5: import an outline from an allowed source (College Board, OpenStax, Galaxy Training, the Carpentries); the model proposes node stubs and needs links with reasons, each scored; each is mapped to existing / new / merge; bulk-send to Requests, where only a person accepts. Coverage against reference courses — Khan Academy included — is checked by people.'],
  ['Quality', 'S11 · Quality — is the tutor teaching? is the judge right?', quality(), 1680, 880, 'Reached from: the rail (Insight).\nTutor spec T9 and T8.3: aggregates only. Right-on-next-try after a step back and after a hint; routes finished; resources marked unhelpful or broken. Judge–human agreement per block type against a 90% line — automatic deployment is locked for every type, and crossing the line only makes a type eligible for its own spec. Every “fix these” row opens the place to act.'],
  ['Graph', 'S2 · Graph — search, neighbourhood, impact', graph(), 1680, 1060, 'Reached from: the rail.\nLeads to: a node’s workbench, split/merge, a weave preview for any goal.\nSearch-first with a region tree (Bloom, WebProtégé); a layered neighbourhood view for editing, with Table and Whole network as alternatives (node-link views stop being readable past ~20 nodes); the three link kinds drawn differently; the impact of a change shown before it is proposed; link history. Switch Editing view / Learner view (click it, or the “view” tweak): learners only ever see the metro style, and the learner view shows the change on their maps.'],
  ['Assistant', 'S15 · Assistant — chat that acts through the content API', assistant(), 1680, 1060, 'Reached from: the rail, “Ask the assistant” in the workbench, a request or a route.\nEvery chat is tied to a node, request or route. The assistant acts only through the content API; each action is a card you keep or discard. Kept changes become drafts that still need checks and review. It cannot approve, publish, land or move requests.'],
  ['AIUsage', 'S16 · AI — usage', usage(), 1680, 1180, 'Reached from: AI at the bottom of the rail.\nTokens and cost by task, person and model, from the LiteLLM gateway; budget meters and alerts that say what happens when a cap is reached. Chart colours validated for colour-blind separation; the tables are its accessible view.'],
  ['AIModels', 'S17 · AI — models, budgets and scoring', models(), 1440, 1260, 'The three lanes from Labs (no AI, self-hosted, hosted keys), the fixed list of places Code calls a model with a model, fallback and cap for each — now including skeleton drafting, resource suggestion and the judge — budgets, and the scoring settings: redraft threshold, redraft limit, the different-family rule, and automatic deployment shown locked.'],
];
const IDENTITY = [
  ['IdentityCodeLight', 'Identity · Code light', code(T.light), 1280, 860],
  ['IdentityCodeDark', 'Identity · Code dark', code(T.dark), 1280, 860],
  ['IdentityLabsLight', 'Identity · Labs light', labs(T.light), 1400, 880],
  ['IdentityLabsDark', 'Identity · Labs dark', labs(T.dark), 1400, 880],
];

const artboards = [], annotations = [];
const INTERACTIVE = new Set(['Graph']);
function layout(list, pageId, cols) {
  let x = 0, y = 0, rowH = 0;
  list.forEach(([stem, title, html, w, h, note], i) => {
    writeFileSync(`${D}${stem}.dc.html`, html);
    if (i > 0 && i % cols === 0) { x = 0; y += rowH + 360; rowH = 0; }
    artboards.push({ file: `${stem}.dc.html`, title, x, y, w, h, page: pageId, ...(INTERACTIVE.has(stem) ? { is_interactive: true } : {}) });
    if (note) annotations.push({ id: `note-${stem.toLowerCase()}`, x, y: y - 250, w: Math.min(w, 620), text: note, page: pageId });
    x += w + 120; rowH = Math.max(rowH, h);
  });
}
layout(LEARN, 'learn', 3);
layout(STUDIO, 'studio', 3);
layout(IDENTITY, 'identity', 2);
annotations.push({ id: 'note-brief', x: -760, y: -250, w: 620, page: 'learn', text: 'Comeni Code — key pages, hybrid identity, light mode (dark is on the Identity page).\n\nThe idea: Code is the tutor on top of existing material (tutor spec). Nodes are standalone pages that also point to the best existing videos and readings; a goal is woven into a route by following what each page needs. AI suggests targets and writes short connecting text (marked until reviewed); it never chooses the route. Missing pages go to a request queue, and only a person moves them to Implementing.\n\nNavigation: learner top bar = logo · search · account. Home is the overview. Lessons use a focused bar.' });
writeFileSync(`${D}canvas.json`, JSON.stringify({
  pages: [{ id: 'learn', name: 'Learn' }, { id: 'studio', name: 'Studio' }, { id: 'identity', name: 'Identity' }],
  artboards, annotations, launch: { view: 'canvas', page: 'learn' },
}, null, 2));
console.log(artboards.map(a => a.file).join(' '));

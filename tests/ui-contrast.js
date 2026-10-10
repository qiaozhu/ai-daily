// Evaluated in the page by tests/ui-v2.js (#20 contrast review): every visible text run and input placeholder must
// reach WCAG AA 4.5:1 against its composited background (translucent fills blended over their ancestors).
// Skips skeletons, aria-hidden, svg and disabled controls. Returns the failures as strings.
// in-page: every visible text run (and input placeholders) must reach WCAG AA 4.5:1 against its composited background
(() => {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); if (!a) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a); };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => { const st = []; let opacity = 1; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); st.push(parse(cs.backgroundColor)); opacity *= Number(cs.opacity); } let c = [255, 255, 255, 1]; for (const l of st.reverse()) c = over(l, c); return { c, opacity }; };
  const bad = [];
  const check = (el, color, label) => {
    const { c: bg, opacity } = bgOf(el); const fg = parse(color); fg[3] *= opacity; const r = ratio(over(fg, bg), bg);
    if (r < 4.5) bad.push(`${label} ${r.toFixed(2)} (${color} on rgb(${bg.slice(0, 3).map(Math.round)}))`);
  };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('[data-state=loading],[aria-hidden=true],svg,script,style,[disabled]')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (txt) check(el, getComputedStyle(el).color, JSON.stringify(txt.slice(0, 16)) + '<' + el.tagName.toLowerCase() + '>');
    if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.placeholder) check(el, getComputedStyle(el, '::placeholder').color, 'placeholder ' + JSON.stringify(el.placeholder.slice(0, 12)));
  }
  return [...new Set(bad)];
})()

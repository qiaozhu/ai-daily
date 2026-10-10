"use strict";
/* AI 热点日报 v2 — X-style frontend, data from the Worker API (no embedded data) */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n==null ? '' : n>=1e8 ? (n/1e8).toFixed(1).replace(/\.0$/,'')+'亿' : n>=1e4 ? (n/1e4).toFixed(1).replace(/\.0$/,'')+'万' : Number(n).toLocaleString('en-US');
const dateCN = d => String(d||'').replace(/^(\d+)-0?(\d+)-0?(\d+)$/,'$1年$2月$3日');
const dateShort = d => String(d||'').replace(/^\d+-0?(\d+)-0?(\d+)$/,'$1月$2日');
// display names returned by X user expansions during collection; unknown handles fall back to @handle
const NAMES = {"claudeai":"Claude","AnthropicAI":"Anthropic","elonmusk":"Elon Musk","HYJsfn9h":"H YJ","OpenAIDevs":"OpenAI Developers",
 "peterwildeford":"Peter Wildeford","IGraceAshford":"Grace Ashford","Alibaba_Qwen":"Qwen","StepFun_ai":"StepFun","fkysly":"马天翼",
 "faststocknewss":"FSMN","Mr_Salio":"Salio","AI_Screening":"Pranav Reddy","aakashgupta":"Aakash Gupta","TheZvi":"Zvi Mowshowitz",
 "Nyxelarm":"Nyxelarm","demishassabis":"Demis Hassabis","Google":"Google","AIStockSavvy":"Hardik Shah","ReutersChina":"Reuters China",
 "nvidia":"NVIDIA","unusual_whales":"unusual_whales","lmoroney":"Laurence Moroney","NFT_Chen":"SuSu_酥酥","xiax0603":"xiax｜AI & Agents",
 "ppmmzzcn":"AI观察者 | 平行世界","OpenAI":"OpenAI","GoogleDeepMind":"Google DeepMind","sama":"Sam Altman","xai":"xAI","grok":"Grok"};
const nameOf = p => p.name || NAMES[p.handle] || p.handle;
// exact post time from the X snowflake id: ms = (id >> 22) + 1288834974657; shown in UTC+8
const timeCache = new Map();
function postTime(id){
  if (timeCache.has(id)) return timeCache.get(id);
  let r = { short:'', full:'', ms:0 };
  try { const ms = Number((BigInt(id) >> 22n) + 1288834974657n); if (ms > 1.2e12) { const d = new Date(ms + 8*3600e3), p = n => String(n).padStart(2,'0');
    r = { ms, short:`${d.getUTCMonth()+1}月${d.getUTCDate()}日 ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`, full:`${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}（UTC+8）` }; } } catch(e) {}
  timeCache.set(id, r); return r;
}
const COLORS = ['#1d9bf0','#f91880','#00ba7c','#7856ff','#ff7a00','#d4a000','#e0245e','#17bf63','#794bc4','#0f9d58'];
function avatar(p){ let h=0; for (const c of p.handle) h=(h*31+c.charCodeAt(0))>>>0;
  return `<div class="av" style="background:${COLORS[h%COLORS.length]}" aria-hidden="true">${esc(nameOf(p).trim().charAt(0).toUpperCase())}</div>`; }
const ICON = {
  reply:'<svg viewBox="0 0 24 24"><path d="M1.75 10c0-4.42 3.58-8 8-8h4.37c4.42 0 8.13 3.58 8.13 8 0 4.42-3.71 8-8.13 8H9.6l-4.6 3.5V17.2C3.06 15.7 1.75 13 1.75 10zm8-6c-3.31 0-6 2.69-6 6 0 2.2 1.19 4.13 2.97 5.17l.53.31v2.09L9 16h5.12c3.31 0 6.13-2.69 6.13-6s-2.82-6-6.13-6H9.75z"/></svg>',
  rt:'<svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.43 4.14-1.36 1.46L5.5 7.55V16c0 1.1.9 2 2 2H13v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.43 9.48.07 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.21 0 4 1.79 4 4v8.45l2.07-1.93 1.36 1.46-4.43 4.14-4.43-4.14 1.36-1.46 2.07 1.93V8c0-1.1-.9-2-2-2z"/></svg>',
  like:'<svg viewBox="0 0 24 24"><path d="M16.7 3.5c-1.86 0-3.4.9-4.7 2.6-1.3-1.7-2.84-2.6-4.7-2.6C4.1 3.5 1.75 6.06 1.75 9.2c0 5.57 7.3 10.17 9.79 11.62.28.17.64.17.92 0 2.49-1.45 9.79-6.05 9.79-11.62 0-3.14-2.35-5.7-5.55-5.7zm-4.7 15.3C8.96 16.9 3.75 13.1 3.75 9.2c0-2.07 1.47-3.7 3.55-3.7 1.6 0 2.83 1 3.82 2.83L12 9.9l.88-1.57C13.87 6.5 15.1 5.5 16.7 5.5c2.08 0 3.55 1.63 3.55 3.7 0 3.9-5.21 7.7-8.25 9.6z"/></svg>',
  view:'<svg viewBox="0 0 24 24"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/></svg>',
  starO:'<svg class="o" viewBox="0 0 24 24"><path d="M12 2.5l2.94 6.26 6.81.78-5.06 4.66 1.38 6.73L12 17.5l-6.07 3.43 1.38-6.73-5.06-4.66 6.81-.78L12 2.5zm0 4.7-1.6 3.4-3.7.43 2.75 2.53-.75 3.66L12 15.35l3.3 1.87-.75-3.66 2.75-2.53-3.7-.43L12 7.2z"/></svg>',
  starF:'<svg class="f" viewBox="0 0 24 24"><path d="M12 2.5l2.94 6.26 6.81.78-5.06 4.66 1.38 6.73L12 17.5l-6.07 3.43 1.38-6.73-5.06-4.66 6.81-.78z"/></svg>',
};

let state = { view:'day', date:null, cat:null, q:'', sel:null };
let DAYS = [], favs = new Set(), visible = [];
const dayCache = new Map();

async function api(path, opts) {
  const r = await fetch(path, Object.assign({ headers: { 'Content-Type':'application/json' } }, opts));
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
async function getDay(date){ if (!dayCache.has(date)) dayCache.set(date, api('/api/days/'+encodeURIComponent(date)).catch(e=>{ dayCache.delete(date); throw e; })); return dayCache.get(date); }
const terms = () => state.view==='search' ? state.q.split(/\s+/).filter(Boolean).map(x=>esc(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')) : [];
function hl(text){ const t = esc(text), tm = terms(); return tm.length ? t.replace(new RegExp('('+tm.join('|')+')','gi'),'<mark>$1</mark>') : t; }

function tweet(p){
  const t = postTime(p.post_id), tr = p.translation_zh || '', showOrig = p.text && tr && p.text !== tr;
  const metric = (k, v, label) => v==null ? '' : `<span class="m m-${k}" title="${label} ${v}">${ICON[k]}<b>${fmt(v)}</b></span>`;
  return `<a class="tw" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="在 X 上打开原帖">
    <div class="tw-l">${avatar(p)}</div>
    <div class="tw-r">
      <div class="tw-h"><span class="tw-name">${esc(nameOf(p))}</span><span class="tw-handle">@${esc(p.handle)}</span>${t.short?`<span class="dot">·</span><time datetime="${new Date(t.ms).toISOString()}" title="${t.full}">${t.short}</time>`:''}<span class="tw-x">${ICON.x}</span></div>
      ${showOrig ? `<div class="tw-text">${hl(p.text)}</div>` : ''}
      <div class="tw-tr">${showOrig ? '<span class="trl">译</span>' : ''}${hl(tr || p.text)}</div>
      <div class="tw-m">${metric('reply',p.replies,'回复')}${metric('rt',p.reposts,'转发')}${metric('like',p.likes,'点赞')}${metric('view',p.views,'浏览')}</div>
    </div></a>`;
}
const cats = s => (s.categories||[]).map(c=>`<span class="cat">${esc(c)}</span>`).join('');
const newsLinks = s => (s.news_refs||[]).map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">X 新闻 ${i+1} ↗</a>`).join('');
const starBtn = s => { const on = favs.has(s.id); return `<button class="star ${on?'on':''}" data-fav="${esc(s.id)}" title="${on?'取消收藏':'收藏'}" aria-pressed="${on}">${ICON.starO}${ICON.starF}</button>`; };

function storyHTML(s, showDate){
  return `<article class="story ${s.id===state.sel?'sel':''}" data-id="${esc(s.id)}" tabindex="0">
   <div class="sh"><span class="rk">#${s.rank}</span><h2>${hl(s.headline_zh)}</h2>${starBtn(s)}</div>
   <div class="meta">${showDate?`<span class="dlabel">📅 ${esc(s.date)}</span>`:''}${s.org_tag?`<span class="org">${esc(s.org_tag)}</span>`:''}${cats(s)}<span class="heat" title="热度分（0-100）">🔥 ${s.heat??'-'}</span></div>
   ${(s.source_posts||[]).map(tweet).join('')}
   <div class="inline-sum"><div class="sumh">AI 摘要 <span class="badge">Grok Bot</span></div>${hl(s.summary_zh)}
    ${s.why_it_matters?`<div style="margin-top:6px"><b>为什么重要：</b>${hl(s.why_it_matters)}</div>`:''}
    ${s.data_quality?`<div class="dq" style="margin-top:8px">⚠️ ${esc(s.data_quality)}</div>`:''}
    ${(s.news_refs||[]).length?`<div class="links" style="margin-top:6px">${newsLinks(s)}</div>`:''}</div>
  </article>`;
}
function chipsHTML(pool){
  const counts={}; pool.forEach(s=>(s.categories||[]).forEach(c=>counts[c]=(counts[c]||0)+1));
  const cs=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  return `<button class="chip ${!state.cat?'on':''}" data-cat="">全部<small>${pool.length}</small></button>`+cs.map(c=>`<button class="chip ${state.cat===c?'on':''}" data-cat="${esc(c)}">${esc(c)}<small>${counts[c]}</small></button>`).join('');
}
function setChips(pool){ const h = pool && pool.length ? chipsHTML(pool) : ''; $('#chips').innerHTML = h || '<span style="color:var(--sub);font-size:13px">—</span>'; $('#mchips').innerHTML = h; $('#mchips').style.display = h ? '' : 'none'; }
const byCat = list => state.cat ? list.filter(s=>(s.categories||[]).includes(state.cat)) : list;

function panelHTML(){
  const s = visible.find(x=>x.id===state.sel);
  if (!s) return `<div class="ph">AI 摘要 <span class="badge">Grok Bot</span></div><div class="pb"><p style="color:var(--sub)">${state.view==='trend'?'趋势页汇总全部历史日报。切回“今日”查看单条资讯的 AI 摘要。':'点击任意话题，在这里查看 AI 摘要。'}</p></div>`;
  const n=(s.source_posts||[]).length;
  return `<div class="ph">AI 摘要 <span class="badge">Grok Bot</span>${starBtn(s)}</div><div class="pb">
   <div class="meta">${s.org_tag?`<span class="org">${esc(s.org_tag)}</span>`:''}${cats(s)}<span class="heat">🔥 ${s.heat??'-'}</span></div>
   <h3>${hl(s.headline_zh)}</h3><p>${hl(s.summary_zh)}</p>
   ${s.why_it_matters?`<p class="why"><b>为什么重要：</b>${hl(s.why_it_matters)}</p>`:''}
   ${s.data_quality?`<p class="dq">⚠️ ${esc(s.data_quality)}</p>`:''}
   <div class="src">📅 ${esc(s.date)} · 基于 ${n} 条 X 原帖</div>
   ${(s.news_refs||[]).length?`<div class="links">${newsLinks(s)}</div>`:''}</div>`;
}
function syncPanel(){ $('#panel').innerHTML = panelHTML(); }
function select(id){ state.sel=id; $$('.story.sel').forEach(e=>e.classList.remove('sel')); const el=document.querySelector(`.story[data-id="${CSS.escape(id)}"]`); if(el) el.classList.add('sel'); syncPanel(); }

// ---------- views ----------
async function viewDay(){
  if (!state.date) { setChips([]); return { html:'<div class="empty">暂无日报数据</div>', list:[] }; }
  const d = await getDay(state.date);
  const pool = d.stories.slice();  // ranked order
  setChips(pool);
  const list = byCat(pool);
  const gen = (d.generated_at||'').replace('T',' ').slice(0,16);
  $('#sub').innerHTML = `<span class="sd">${esc(dateCN(d.date))} · </span>${d.stories.length} 个话题 · 生成于 ${esc(gen.slice(11)||gen)} · 来自 X`;
  const notes = (d.data_quality_notes||[]).length ? `<div class="notes"><h3>数据说明</h3><ul>${d.data_quality_notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>` : '';
  return { html: (list.map(s=>storyHTML(s,false)).join('') || '<div class="empty">该分类下暂无内容</div>') + notes, list };
}
async function viewSearch(){
  if (!state.q) { setChips([]); $('#sub').textContent='在全部历史日报中搜索'; return { html:`<div class="vh"><p>输入关键词，搜索全部 ${DAYS.length} 天日报的标题、摘要、标签和 X 原帖（含译文）。多个关键词用空格分隔。</p></div>`, list:[] }; }
  const r = await api('/api/stories?q='+encodeURIComponent(state.q));
  setChips(r.stories); const list = byCat(r.stories);
  $('#sub').textContent = `“${state.q}” · ${r.count} 条结果`;
  return { html:`<div class="vh"><p>“${esc(state.q)}” · 在全部 ${DAYS.length} 天中找到 ${r.count} 条</p></div>` + (list.map(s=>storyHTML(s,true)).join('') || '<div class="empty">没有匹配的内容</div>'), list };
}
async function viewFav(){
  const r = await api('/api/favorites'); favs = new Set(r.ids); updFavCnt();
  setChips(r.stories); const list = byCat(r.stories);
  $('#sub').textContent = `${r.count} 条收藏 · 保存在服务器上`;
  return { html:`<div class="vh"><h2>⭐ 我的收藏</h2><p>共 ${r.count} 条 · 收藏保存在服务器上，任何设备打开都能看到</p></div>` + (list.map(s=>storyHTML(s,true)).join('') || '<div class="empty">还没有收藏，点击话题右上角的 ☆ 即可收藏</div>'), list };
}
const PALETTE = ["#1d9bf0","#00ba7c","#f91880","#7856ff","#ff7a00","#d4a000","#06b6d4","#ef4444","#84cc16","#64748b","#ec4899","#a16207"];
let CATS=[]; const catColor = c => { let i=CATS.indexOf(c); if(i<0){CATS.push(c); i=CATS.length-1;} return PALETTE[i%PALETTE.length]; };
async function viewTrend(){
  setChips([]);
  const t = await api('/api/trends');
  $('#sub').textContent = `${t.days.length} 天 · 分类与话题走势`;
  const dates=t.days.map(d=>d.date), cnt={}; t.per_day.forEach(r=>{(cnt[r.date]=cnt[r.date]||{})[r.category]=r.n;});
  t.category_totals.forEach(c=>catColor(c.category));
  const legend=`<div class="legend">${t.category_totals.map(c=>`<span><i style="background:${catColor(c.category)}"></i>${esc(c.category)}</span>`).join('')}</div>`;
  const table=`<div class="tscroll"><table class="trend"><tr><th>日期</th><th>分类分布</th><th>条数</th></tr>${t.days.slice().reverse().map(d=>{const c=cnt[d.date]||{}; const tot=Object.values(c).reduce((a,b)=>a+b,0)||1; return `<tr><td><button class="tlink" data-date="${esc(d.date)}">${esc(d.date)}</button></td><td><div class="stack">${Object.entries(c).map(([k,v])=>`<span title="${esc(k)} ${v}" style="width:${v/tot*100}%;background:${catColor(k)}"></span>`).join('')}</div></td><td>${d.n}</td></tr>`;}).join('')}</table></div>`;
  const mx=Math.max(1,...t.category_totals.map(c=>c.n)), last7=dates.slice(-7);
  const catTable=`<div class="tscroll"><table class="trend"><tr><th>分类</th><th>累计</th>${last7.map(d=>`<th>${d.slice(5)}</th>`).join('')}</tr>${t.category_totals.map(c=>`<tr><td>${esc(c.category)}</td><td><span class="bar" style="width:${c.n/mx*90}px;background:${catColor(c.category)}"></span>${c.n}</td>${last7.map(d=>`<td>${(cnt[d]||{})[c.category]||'·'}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const rec=t.recurring_topics, show=(rec.length?rec:t.topics).slice(0,30), tmx=Math.max(1,...show.map(x=>x.story_count));
  const topicTable=`<div class="tscroll"><table class="trend"><tr><th>话题</th><th>出现天数</th><th>相关资讯</th><th>最近一次</th></tr>${show.map(x=>`<tr><td><button class="tlink" data-search="${esc(x.topic)}">${esc(x.topic)}</button></td><td>${x.day_count}</td><td><span class="bar" style="width:${x.story_count/tmx*80}px"></span>${x.story_count}</td><td>${esc(x.last_seen)}</td></tr>`).join('')}</table></div>`;
  return { list:[], html:`<div class="vh"><h2>📈 趋势</h2><p>全部 ${dates.length} 天日报的分类分布与反复出现的话题</p></div>
  <section class="tsec"><h3>每日分类分布</h3>${legend}${table}</section>
  <section class="tsec"><h3>分类累计（近 7 天明细）</h3>${catTable}</section>
  <section class="tsec"><h3>${rec.length?'跨日反复出现的话题':'热门话题'}</h3>${rec.length?'':`<p style="color:var(--sub);font-size:13px;margin:0 0 6px">目前仅有 ${dates.length} 天数据，积累 2 天以上后将显示跨日反复出现的话题。</p>`}${topicTable}</section>` };
}

// ---------- render ----------
function renderDates(){
  $('#dates').innerHTML = DAYS.map(d=>`<button class="dt ${state.view==='day'&&d.date===state.date?'on':''}" data-date="${esc(d.date)}">${esc(d.date)}<small>${d.story_count} 条</small></button>`).join('') || '<div style="color:var(--sub);padding:0 12px">暂无数据</div>';
  $('#mdate').innerHTML = DAYS.map(d=>`<option value="${esc(d.date)}" ${d.date===state.date?'selected':''}>${esc(dateShort(d.date))}（${d.story_count}）</option>`).join('');
}
function writeHash(){
  const h = new URLSearchParams(); if (state.view!=='day') h.set('v',state.view); if (state.date && state.date!==(DAYS[0]||{}).date) h.set('d',state.date);
  if (state.cat) h.set('c',state.cat); if (state.view==='search' && state.q) h.set('q',state.q);
  const s = h.toString(); history.replaceState(null,'', s ? '#'+s : location.pathname);
}
function readHash(){
  const h = new URLSearchParams(location.hash.slice(1));
  const v = h.get('v'); if (['day','search','fav','trend'].includes(v)) state.view=v;
  const d = h.get('d'); if (d && DAYS.some(x=>x.date===d)) state.date=d;
  state.cat = h.get('c') || null; state.q = (h.get('q')||'').slice(0,100); $('#q').value = state.q;
}
const updFavCnt = () => { $('#favcnt').textContent = favs.size || ''; };
let seq = 0;
async function render(opts={}){
  const my = ++seq;
  document.body.className = 'v-'+state.view;
  $$('[data-v]').forEach(b=>b.classList.toggle('on', b.dataset.v===state.view));
  $('#title').textContent = {day:'AI 热点日报', search:'搜索', fav:'收藏', trend:'趋势'}[state.view];
  renderDates(); writeHash();
  let r;
  try { r = await ({day:viewDay, search:viewSearch, fav:viewFav, trend:viewTrend})[state.view](); }
  catch(e) { r = { html:`<div class="empty err">加载失败：${esc(e.message)}，请稍后刷新重试</div>`, list:[] }; }
  if (my !== seq) return;
  visible = r.list;
  if (!visible.some(s=>s.id===state.sel)) state.sel = visible[0] ? visible[0].id : null;
  $('#tl').innerHTML = r.html.replace(/class="story ([^"]*)" data-id="([^"]*)"/g, (m,c,id)=>`class="story ${id===esc(state.sel)?'sel':''}" data-id="${id}"`) + `<div class="foot">数据来自 X 平台公开内容 · 互动数为抓取时数值 · 时间为北京时间（UTC+8）</div>`;
  syncPanel();
  if (opts.top) scrollTo(0,0);
}

// ---------- interactions ----------
function applyTheme(t){ document.documentElement.dataset.theme=t; $$('.themelabel').forEach(e=>e.textContent = t==='dark'?'浅色模式':'深色模式'); }
async function toggleFav(id){
  const on = favs.has(id), btns = $$(`.star[data-fav="${CSS.escape(id)}"]`); btns.forEach(b=>b.disabled=true);
  try {
    if (on) { await api('/api/favorites/'+encodeURIComponent(id), {method:'DELETE'}); favs.delete(id); }
    else { await api('/api/favorites', {method:'POST', body:JSON.stringify({story_id:id})}); favs.add(id); }
  } catch(err) { alert('收藏失败：'+err.message); }
  updFavCnt();
  if (state.view==='fav') return render();
  $$(`.star[data-fav="${CSS.escape(id)}"]`).forEach(b=>{ const f=favs.has(id); b.disabled=false; b.classList.toggle('on',f); b.title=f?'取消收藏':'收藏'; b.setAttribute('aria-pressed',f); });
}
function focusSearch(){ setTimeout(()=>$('#q').focus(), 0); }
document.addEventListener('click', e=>{
  if (e.target.closest('a.tw, a[href]')) return;               // tweet cards / links: native new-tab navigation
  const t = e.target.closest('button, .story'); if (!t) return;
  if (t.matches('[data-theme-toggle]')) { const n = document.documentElement.dataset.theme==='dark' ? 'light' : 'dark'; try{ localStorage.setItem('aidaily.theme', JSON.stringify(n)); }catch(_){} applyTheme(n); return; }
  if (t.dataset.fav !== undefined) { e.stopPropagation(); toggleFav(t.dataset.fav); return; }
  if (t.dataset.v) { const v=t.dataset.v; if (v===state.view && v!=='day') { if (v==='search') focusSearch(); return; } state.view=v; state.cat=null; render({top:true}); if (v==='search') focusSearch(); return; }
  if (t.dataset.cat !== undefined) { state.cat=t.dataset.cat||null; render({top:true}); return; }
  if (t.dataset.date) { state.date=t.dataset.date; state.view='day'; state.cat=null; render({top:true}); return; }
  if (t.dataset.search !== undefined) { state.q=t.dataset.search; $('#q').value=state.q; state.view='search'; state.cat=null; render({top:true}); return; }
  if (t.classList.contains('story')) select(t.dataset.id);
});
document.addEventListener('keydown', e=>{ if (e.key==='Enter' && e.target.classList && e.target.classList.contains('story')) select(e.target.dataset.id); });
$('#mdate').addEventListener('change', e=>{ state.date=e.target.value; state.view='day'; state.cat=null; render({top:true}); });
let timer;
$('#q').addEventListener('input', e=>{
  clearTimeout(timer); timer = setTimeout(()=>{ state.q=e.target.value.trim().slice(0,100); state.view='search'; state.cat=null; render(); }, 250);
});
window.addEventListener('hashchange', ()=>{ readHash(); render(); });

(async function init(){
  applyTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
  try {
    const [d,f] = await Promise.all([api('/api/days'), api('/api/favorites')]);
    DAYS = d.days; state.date = d.latest; favs = new Set(f.ids); updFavCnt();
  } catch(e) { $('#tl').innerHTML = `<div class="empty err">加载失败：${esc(e.message)}，请稍后刷新重试</div>`; $('#sub').textContent='加载失败'; return; }
  readHash(); render();
})();

// usage: node tests/ui-v2.js <baseURL> [shotPrefix]   (needs puppeteer-core + Chrome; CHROME_PATH overrides the browser path)
// v6 UI (F1 home redesign, visual spec v1). The v5 functional regression checks are kept with the same meaning
// (stories/rank order, X posts, search + highlight, category filter, favorites, trend, export, history, theme,
// legacy links) plus text contrast >= 4.5:1 (tests/ui-contrast.js); the v5 *visual* checks (blue borders, X-style cards) were replaced by the v1 token checks.
// Screenshots: <prefix>{light,dark}-{desktop,mobile}.png (+ search-desktop.png).
// WARNING: toggles one favorite on and off again on the target site (restores the original state).
const p=require('puppeteer-core');const BASE=process.argv[2]||'http://127.0.0.1:8787', PFX=process.argv[3]||'';
const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const R=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const J=async u=>(await fetch(BASE+u)).json();
(async()=>{
const b=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--lang=zh-CN']});
const errs=[];
async function page(vp,sysDark){const pg=await b.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&!/Failed to load resource.*(500|404)/.test(m.text())&&errs.push(m.text()));
 await pg.setViewport(vp); if(sysDark) await pg.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]); return pg;}
const D={width:1440,height:1000}, M={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
const day=await J('/api/days/latest'), daysList=(await J('/api/days')).days, N=day.stories.length;
const nPosts=day.stories.reduce((a,s)=>a+s.source_posts.length,0);
let pg=await page(D,true);
const ns=()=>pg.$$eval('#tl .story',x=>x.length);
const css=(sel,prop)=>pg.$eval(sel,(e,pr)=>getComputedStyle(e)[pr],prop);
const url=()=>pg.evaluate(()=>location.pathname+location.search+location.hash);
const theme=()=>pg.evaluate(()=>document.documentElement.dataset.theme);
await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await pg.evaluate(()=>localStorage.clear()); await pg.reload({waitUntil:'networkidle0'}); await W(300);
// ---- desktop · light (system dark must be ignored) ----
R('default light even with system dark: '+await theme(), await theme()==='light');
R('bg #F5F5F7 '+await css('body','backgroundColor'), await css('body','backgroundColor')==='rgb(245, 245, 247)');
R(`stories ${await ns()}/${N}`, await ns()===N && N>0);
R('rank order (editorial rank, like v5)', JSON.stringify(await pg.$$eval('#tl .story',x=>x.map(e=>e.dataset.id)))===JSON.stringify(day.stories.map(s=>s.id)));
const three=await pg.$$eval('#three .it span',x=>x.map(e=>e.textContent));
R('今日三件事 = highlights[0..3) ('+three.length+')', JSON.stringify(three)===JSON.stringify(day.highlights.slice(0,3)));
R('subtitle: N 个话题 · generated_at HH:MM 更新 — '+await pg.$eval('#sub',e=>e.textContent), await pg.$eval('#sub',(e,a)=>e.textContent===a,`${N} 个话题 · ${day.generated_at.slice(11,16)} 更新`));
R('title 今日热点', await pg.$eval('#title',e=>e.textContent)==='今日热点');
const badges=await pg.$$eval('#tl .story',x=>x.map(e=>{const b=e.querySelector('[data-badge]');return b?b.dataset.badge+':'+b.textContent:'-'}));
R('badges match API badge/streak_days '+JSON.stringify(badges.slice(0,4)), JSON.stringify(badges)===JSON.stringify(day.stories.map(s=>s.badge==='ongoing'?`ongoing:持续热议 ${s.streak_days} 天`:s.badge==='new'?'new:新':'-')));
const bars=await pg.$$eval('#tl .story .heat i',x=>x.map(e=>parseFloat(e.style.width)));
R('heat bars = heat %', JSON.stringify(bars)===JSON.stringify(day.stories.map(s=>Math.max(0,Math.min(100,s.heat??0)))));
R('desktop: side nav visible, tab bar hidden', await pg.$eval('#sidenav',e=>e.offsetHeight>0) && await pg.$eval('#tabbar',e=>e.offsetHeight===0));
const cols=await pg.evaluate(()=>[document.querySelector('#sidenav').getBoundingClientRect().width,document.querySelector('#mainCol').getBoundingClientRect().width,document.querySelector('.rcol').getBoundingClientRect().width].map(Math.round));
R('3 columns 240/680/320 '+cols, cols.join()==='240,680,320');
R('热度榜 top 8 '+await pg.$$eval('#heatrank li',x=>x.length), (await pg.$$eval('#heatrank li',x=>x.length))===Math.min(8,N));
{ const byHeat=[...day.stories].sort((a,b)=>(b.heat??-1)-(a.heat??-1)||a.rank-b.rank).slice(0,8).map(s=>s.id);
  const hr=await pg.$$eval('#heatrank li',x=>x.map(e=>e.dataset.id)); R('热度榜 sorted by heat (cards stay in rank order) '+hr.join(), JSON.stringify(hr)===JSON.stringify(byHeat)); }
{ const al=await pg.evaluate(()=>{const t=document.querySelector('#title').getBoundingClientRect(),b=document.querySelector('#titleActions');if(!b||!b.offsetHeight)return null;const r=b.getBoundingClientRect();return {tb:Math.round(t.bottom),bb:Math.round(r.bottom),bt:Math.round(r.top),tt:Math.round(t.top)};});
  R('desktop search + share bottom-aligned with the title '+JSON.stringify(al), !!al && Math.abs(al.tb-al.bb)<=8 && al.bt>al.tt); }
R('topic count shown once on desktop (only in the subtitle) ', await pg.$eval('#mainCol',e=>(e.innerText.match(/个话题/g)||[]).length)===1);
R('two-column cards on desktop', await pg.$$eval('#tl .story',x=>x.length>1&&Math.round(x[0].getBoundingClientRect().top)===Math.round(x[1].getBoundingClientRect().top)));
const card=await pg.$eval('#tl .story',e=>{const c=getComputedStyle(e),h=getComputedStyle(e.querySelector('h3'));return {r:c.borderTopLeftRadius,bg:c.backgroundColor,sh:c.boxShadow,fs:h.fontSize,fw:h.fontWeight}});
R('light card: white, radius 18, soft shadow, headline 17/600 '+JSON.stringify(card), card.r==='18px'&&card.bg==='rgb(255, 255, 255)'&&card.sh!=='none'&&card.fs==='17px'&&card.fw==='600');
const nb=await pg.$('[data-badge="new"]'); if(nb) R('"新" = brand-text on brand-soft '+await pg.$eval('[data-badge="new"]',e=>getComputedStyle(e).color), await pg.$eval('[data-badge="new"]',e=>getComputedStyle(e).color)==='rgb(100, 64, 214)');
R('no prev/next beyond the available days', await pg.$eval('[data-nav=next]',e=>e.disabled) && await pg.$eval('[data-nav=prev]',(e,n)=>e.disabled===(n<2),daysList.length));
await pg.screenshot({path:`${PFX}light-desktop.png`});
// category filter (URL ?c=)
const cat=day.stories[0].categories[0]; await pg.click(`#cats [data-key="${cat}"]`); await W(300);
R(`category ${cat}: ${await ns()} `+await url(), (await ns())===day.stories.filter(s=>s.categories.includes(cat)).length && (await url()).includes('c='));
await pg.click('#cats [data-key=""]'); await W(300); R('category 全部 '+await ns(), (await ns())===N);
R('no sort control / no "按热度" on the home page (#20)', (await pg.$$('#sort')).length===0 && !(await pg.$eval('#mainCol',e=>e.textContent.includes('按热度'))));
// 详情: expand every card in place -> all X posts of the day (v5 inline content)
for (const h of await pg.$$('#tl .story > [role=button]')) { await h.click(); await W(30); }
await W(200);
const tw=await pg.$$eval('#tl a.tw',a=>a.map(x=>({h:x.href,t:x.target,rel:x.rel,time:x.querySelector('time')?.textContent})));
R(`tweets ${tw.length}/${nPosts} all x.com/_blank`, tw.length===nPosts&&tw.every(x=>/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(x.h)&&x.t==='_blank'&&x.rel.includes('noopener')));
R('timestamps '+tw[0]?.time, tw.length>0&&tw.every(x=>/月\d+日 \d\d:\d\d/.test(x.time||'')));
R('why_it_matters shown in details', (await pg.$$eval('#tl .details',x=>x.filter(e=>e.textContent.includes('为什么重要')).length))===day.stories.filter(s=>s.why_it_matters).length);
for (const h of await pg.$$('#tl .story > [role=button]')) { await h.click(); await W(20); }
// favorites (server-side): favorite the first story, see it under 我的, unfavorite it there
const before=(await J('/api/favorites')).count;
const sid=await pg.$eval('#tl .story',e=>e.dataset.id);
await pg.click('#tl .story > [role=button]'); await W(200);
await pg.click(`#tl .story[data-id="${sid}"] .star`); await W(700);
let f=await J('/api/favorites'); R('fav saved on server ('+before+'->'+f.count+')', f.ids.includes(sid));
R('fav count in side nav '+await pg.$eval('[data-favcount]',e=>e.textContent), (await pg.$eval('[data-favcount]',e=>e.textContent))===String(f.count));
await pg.click('#sidenav [data-tab=me]'); await pg.waitForSelector('#favs .story,#favs [data-state]',{timeout:15000}); await W(200);
R('我的 lists favorites '+await ns(), (await ns())===f.count);
await pg.click(`#tl .story[data-id="${sid}"] > [role=button]`); await W(200); await pg.click(`#tl .story[data-id="${sid}"] .star`); await W(900);
f=await J('/api/favorites'); R('unfav restored ('+f.count+')', !f.ids.includes(sid) && f.count===before);
R('export link on 我的', (await pg.$$eval('a[href="/api/export"][download]',x=>x.length))===1);
const ex=await fetch(BASE+'/api/export'); R('export '+ex.status+' '+ex.headers.get('content-disposition'), ex.ok && /attachment/.test(ex.headers.get('content-disposition')||''));
// 往期: dates, trend, weekly
await pg.click('#sidenav [data-tab=archive]'); await W(400);
R('往期 日报 list '+await pg.$$eval('#dates .dt',x=>x.length), (await pg.$$eval('#dates .dt',x=>x.length))===daysList.length);
await pg.click('#archiveTabs [data-key=trend]'); await pg.waitForSelector('table.trend',{timeout:15000}); await W(200);
R('trend tables '+await pg.$$eval('table.trend',x=>x.length)+' '+await url(), (await pg.$$eval('table.trend',x=>x.length))===3 && (await url())==='/archive?tab=trend');
await pg.click('table.trend .tlink[data-search]'); await W(900); R('trend topic -> search '+await ns(), (await ns())>=1 && (await url()).startsWith('/search?q='));
await pg.goto(BASE+'/archive?tab=weekly',{waitUntil:'networkidle0'}); R('周报 tab placeholder', await pg.$eval('#mainCol [data-state=empty]',e=>e.textContent.includes('周报')));
await pg.click('#archiveTabs [data-key=daily]'); await W(200); await pg.click('#dates .dt'); await W(500);
R('date click -> day '+await url(), (await ns())===day.stories.length);
// search
await pg.click('#sidenav [data-tab=search]'); await W(300);
R('search page: input focused at top', await pg.evaluate(()=>document.activeElement.id==='q' && document.querySelector('#searchbar').getBoundingClientRect().top<200));
await pg.type('#q','Gemini'); await W(900); R('search Gemini '+await ns()+' marks '+await pg.$$eval('mark',x=>x.length), (await ns())>=1 && (await pg.$$eval('mark',x=>x.length))>0);
{const u=await url(); R('url has q '+u, u.startsWith('/search?')&&u.includes('q='));}
await pg.screenshot({path:`${PFX}search-desktop.png`});
// empty / error / loading states (hifi-v1 §3)
const earliest=daysList[daysList.length-1].date.replace(/^\d+-0?(\d+)-0?(\d+)$/,'$1 月 $2 日');
for (const bad of ['/day/2000-01-01','/day/2026-13-45','/day/abc']) {
 const resp=await pg.goto(BASE+bad,{waitUntil:'networkidle0'}); await W(200);
 const nf=await pg.$eval('[data-state=not-found]',e=>({t:e.querySelector('h1').textContent,p:e.querySelector('p').textContent,b:[...e.querySelectorAll('a')].map(a=>a.textContent+'>'+a.getAttribute('href')).join()})).catch(()=>null);
 R(`404 page ${bad}: HTTP ${resp.status()} ${JSON.stringify(nf)}`, resp.status()===404 && nf && nf.t==='这一天没有日报' && nf.p===`日报从 ${earliest} 开始` && nf.b==='回到今日>/,看往期>/archive' && await pg.$eval('#sidenav',e=>e.offsetHeight>0));
}
R('404 page has no og: tags', (await pg.$$('meta[property^="og:"]')).length===0);
await pg.click('[data-state=not-found] a[href="/"]'); await W(500); R('404 回到今日 -> / '+await ns(), (await url())==='/' && (await ns())===N);
await pg.setRequestInterception(true);
let mode='fail'; const onReq=r=>{ if(r.url().includes('/api/days/')){ if(mode==='fail') return r.respond({status:500,contentType:'application/json',body:'{"error":"x"}'}); if(mode==='slow') return setTimeout(()=>r.continue(),1500);} r.continue(); };
pg.on('request',onReq);
await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await W(200);
R('API error -> 加载失败 + 重试 (no details)', await pg.$eval('[data-state=error]',e=>e.textContent.includes('加载失败')&&e.textContent.includes('重试')&&!e.textContent.includes('500')));
mode='slow'; await pg.click('[data-state=error] button'); await W(400);
R('retry shows skeleton while loading', (await pg.$$('[data-state=loading]')).length===1);
await W(1600); R('retry -> content '+await ns(), (await ns())===N);
pg.off('request',onReq); await pg.setRequestInterception(false);
// theme: switch in 我的, persists, dark tokens
await pg.goto(BASE+'/me',{waitUntil:'networkidle0'}); await pg.click('[data-theme-toggle]'); await W(200);
R('toggle -> dark', await theme()==='dark');
await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await W(300);
R('dark persisted after reload, bg '+await css('body','backgroundColor'), await theme()==='dark' && await css('body','backgroundColor')==='rgb(0, 0, 0)');
{const c=await pg.$eval('#tl .story',e=>({bg:getComputedStyle(e).backgroundColor,sh:getComputedStyle(e).boxShadow})); R('dark card: #1C1C1E, no shadow '+JSON.stringify(c), c.bg==='rgb(28, 28, 30)'&&c.sh==='none');}
if(nb) R('dark "新" = #A88BFF', await pg.$eval('[data-badge="new"]',e=>getComputedStyle(e).color)==='rgb(168, 139, 255)');
await pg.screenshot({path:`${PFX}dark-desktop.png`});
await pg.goto(BASE+'/me',{waitUntil:'networkidle0'}); await pg.click('[data-theme-toggle]'); await W(100);
R('toggle back -> light stored', await pg.evaluate(()=>localStorage.getItem('aidaily.theme'))==='"light"');
// path routes: deep links are served by the SPA fallback; old links are rewritten / redirected
await pg.goto(BASE+'/search?q=Gemini',{waitUntil:'networkidle0'}); await W(400);
R('deep link /search?q=Gemini '+await ns()+' marks '+await pg.$$eval('mark',x=>x.length), (await ns())>=1 && (await pg.$$eval('mark',x=>x.length))>0 && await pg.$eval('#q',e=>e.value)==='Gemini');
// old hash links never reach the server: rewritten on startup with history.replaceState (not a 301)
for (const [from,to] of [['/#v=search&q=Gemini','/search?q=Gemini'],['/#v=trend','/archive?tab=trend'],['/#v=fav','/me'],[`/#d=${day.date}`,`/day/${day.date}`],['/#/search?q=Gemini','/search?q=Gemini'],['/#/fav','/me'],['/#/trend','/archive?tab=trend'],['/nope','/']]) {
 await pg.goto(BASE+from,{waitUntil:'networkidle0'}); await W(300);
 const u=await url(); R(`legacy link ${from} -> ${u}`, u===to);
}
// old URLs: /trend, /fav -> HTTP 301 by the Worker; /?d= -> client-side replace (/ is a static asset)
{ const seen=[]; const h=r=>{ if(r.isNavigationRequest()&&r.redirectChain().length) seen.push(r.redirectChain().map(x=>x.response()?.status()).join()); }; pg.on('request',h);
 for (const [from,to] of [['/trend?c=x','/archive?tab=trend&c=x'],['/fav','/me'],[`/?d=${day.date}&c=x`,`/day/${day.date}?c=x`]]) {
  await pg.goto(BASE+from,{waitUntil:'networkidle0'}); await W(300); const u=await url(); R(`old URL ${from} -> ${u}`, u===to);
 }
 pg.off('request',h); R('/trend and /fav were HTTP 301s '+JSON.stringify(seen), seen.filter(x=>x==='301').length===2); }
// PRD #26: /?d=<bad value> -> first request 200 (static /, the server cannot see the query), the front end replaces
// the URL with /day/<value> and shows the 404 page; a direct request to /day/<value> is an HTTP 404 (server side)
for (const v of ['2000-01-01','abc','2026-13-45']) {
 const resp=await pg.goto(BASE+'/?d='+v,{waitUntil:'networkidle0'}); await W(300);
 const u=await url(); const nf=await pg.$eval('[data-state=not-found] h1',e=>e.textContent).catch(()=>null);
 const direct=await fetch(BASE+'/day/'+v); const body=await direct.text();
 R(`/?d=${v}: first ${resp.status()}, -> ${u} (${nf}); direct /day/${v} HTTP ${direct.status}`, resp.status()===200 && u==='/day/'+v && nf==='这一天没有日报' && direct.status===404 && !body.includes('property="og:'));
}
await pg.close();
// ---- mobile 390 · light & dark ----
for (const th of ['light','dark']) {
 pg=await page(M,th==='light'); // system dark for the light run: must still be light
 await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await pg.evaluate(()=>localStorage.clear()); await pg.reload({waitUntil:'networkidle0'}); await W(300);
 if(th==='dark'){ await pg.click('#tabbar [data-tab=me]'); await W(300); await pg.click('[data-theme-toggle]'); await W(200); R('mobile 我的 switch -> dark', await theme()==='dark'); await pg.click('#tabbar [data-tab=day]'); await W(500); }
 else R('mobile default light', await theme()==='light');
 R(`mobile ${th}: tab bar 4 tabs, no side nav / right column`, (await pg.$$eval('#tabbar a',x=>x.map(e=>e.textContent).join()))==='今日,往期,搜索,我的' && await pg.$eval('#sidenav',e=>e.offsetHeight===0) && await pg.$eval('.rcol',e=>e.offsetHeight===0));
 { const c=await pg.$eval('#tabbar [aria-current=page]',e=>[getComputedStyle(e).color,getComputedStyle(e.querySelector('svg')).color]); const want=th==='dark'?['rgb(168, 139, 255)','rgb(168, 139, 255)']:['rgb(100, 64, 214)','rgb(125, 90, 240)'];
  R(`mobile ${th}: selected tab label brand-text, icon brand ${c}`, JSON.stringify(c)===JSON.stringify(want)); }
 R(`mobile ${th}: no h-overflow `+await pg.evaluate(()=>document.documentElement.scrollWidth), await pg.evaluate(()=>document.documentElement.scrollWidth)<=390);
 const fs=await pg.evaluate(()=>{const bar=document.querySelector('#tabbar').getBoundingClientRect().top,t=document.querySelector('#three').getBoundingClientRect(),h=document.querySelector('#tl .story h3').getBoundingClientRect();return {bar:Math.round(bar),three:Math.round(t.bottom),h3:Math.round(h.bottom)}});
 R(`mobile ${th}: first screen (390×844) shows 三件事 + first card headline `+JSON.stringify(fs), fs.three<=fs.bar && fs.h3<=fs.bar);
 const seg=await pg.$eval('#cats',e=>({sw:e.scrollWidth,cw:e.clientWidth,clip:[...e.children].some(b=>b.scrollWidth>b.clientWidth+1)}));
 R(`mobile ${th}: categories scroll horizontally, labels not squeezed `+JSON.stringify(seg), seg.sw>seg.cw && !seg.clip);
 R(`mobile ${th}: single-column cards`, await pg.$$eval('#tl .story',x=>x.length<2||x[1].getBoundingClientRect().top>x[0].getBoundingClientRect().bottom));
 await pg.screenshot({path:`${PFX}${th}-mobile.png`,fullPage:false});
 if(th==='light'){
  await pg.click('#tabbar [data-tab=search]'); await W(300); R('mobile search input at top', await pg.$eval('#searchbar',e=>e.offsetHeight>0&&e.getBoundingClientRect().top<200));
  await pg.type('#q','Qwen'); await W(900); R('mobile search '+await pg.$$eval('#tl .story',x=>x.length), (await pg.$$eval('#tl .story',x=>x.length))>=1);
  await pg.click('#tabbar [data-tab=day]'); await W(400); await pg.click('#dateLabel'); await W(400);
  R('mobile date label -> 往期 '+await url(), (await url())==='/archive');
  await pg.click('#dates .dt'); await W(500); R('mobile 往期 date -> day', (await pg.$$eval('#tl .story',x=>x.length))===day.stories.length);
 }
 await pg.close();
}
// text contrast >= 4.5:1 (WCAG AA) in light and dark, with a story expanded (tags, notes, posts)
{ const CHECK=require('fs').readFileSync(require('path').join(__dirname,'ui-contrast.js'),'utf8');
 for (const th of ['light','dark']) for (const [vp,urls] of [[D,['/','/search','/archive','/archive?tab=trend','/archive?tab=weekly','/me','/day/2000-01-01']],[M,['/','/search']]]) {
  const pg=await page(vp); await pg.goto(BASE+'/me',{waitUntil:'networkidle0'}); await pg.evaluate(t=>localStorage.setItem('aidaily.theme',JSON.stringify(t)),th);
  for (const u of urls) { await pg.goto(BASE+u,{waitUntil:'networkidle0'}); await W(200);
   if (u==='/') { await pg.click('#tl article.story [role=button]'); await W(300); }
   const bad=await pg.evaluate(CHECK); R(`contrast >= 4.5 ${th} ${vp.width} ${u} ${bad.length?JSON.stringify(bad.slice(0,5)):''}`, bad.length===0); }
  await pg.evaluate(()=>localStorage.removeItem('aidaily.theme')); await pg.close(); } }
R('no JS errors '+JSON.stringify(errs), errs.length===0);
await b.close(); console.log(fails? fails+' FAILED':'ALL PASS'); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

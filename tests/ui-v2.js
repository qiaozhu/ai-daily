// usage: node tests/ui-v2.js <baseURL> [shotPrefix]   (needs puppeteer-core + Chrome; CHROME_PATH overrides the browser path)
// v6 UI (F1 home redesign, visual spec v1). The v5 functional regression checks are kept with the same meaning
// (stories/rank order, X posts, search + highlight, category filter, favorites, trend, export, history, theme,
// legacy links) plus text contrast >= 4.5:1 (tests/ui-contrast.js); the v5 *visual* checks (blue borders, X-style cards) were replaced by the v1 token checks.
// F2 (#9): the story detail page /story/<id> (cards link to it; 首次出现 state; trend chart with an intercepted
// multi-day /trend response, since the local DB only has data/*.json; 404 page; share actions).
// Screenshots: <prefix>{light,dark}-{desktop,mobile}.png (+ search-desktop.png, story-{light,dark}-{desktop,mobile}.png,
// story-trend-{light,dark}-desktop.png, story-404-mobile.png).
// WARNING: toggles one favorite on and off again on the target site (restores the original state).
const p=require('puppeteer-core');const BASE=process.argv[2]||'http://127.0.0.1:8787', PFX=process.argv[3]||'';
const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const R=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const J=async u=>(await fetch(BASE+u)).json();
(async()=>{
const b=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--lang=zh-CN']});
await b.defaultBrowserContext().overridePermissions(BASE,['clipboard-read','clipboard-write','clipboard-sanitized-write']);
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
// 详情 (F2): every card is a link to /story/<id>; the detail page shows why_it_matters and all X posts
{ const hrefs=await pg.$$eval('#tl .story > a',x=>x.map(a=>a.getAttribute('href')));
  R('cards link to /story/<id>', JSON.stringify(hrefs)===JSON.stringify(day.stories.map(s=>'/story/'+encodeURIComponent(s.id)))); }
{ const first=day.stories[0];
  await pg.click('#tl .story > a'); await pg.waitForSelector('#storyTitle',{timeout:15000}); await W(200);
  R('card click -> detail page '+await url(), (await url())==='/story/'+encodeURIComponent(first.id) && await pg.$eval('#storyTitle',e=>e.textContent)===first.headline_zh);
  R('detail: side nav keeps 今日 selected', await pg.$eval('#sidenav [aria-current=page]',e=>e.dataset.tab).catch(()=>null)==='day');
  R('detail: document.title = headline', (await pg.title())===first.headline_zh+' · AI 热点日报');
  await pg.click('#storyNav a'); await W(400); R('back link -> previous page '+await url(), (await url())==='/' && (await ns())===N);
  // keyboard: focus the first card link, Enter opens it
  await pg.focus('#tl .story > a'); await pg.keyboard.press('Enter'); await pg.waitForSelector('#storyTitle',{timeout:15000});
  R('keyboard Enter on a card opens the detail page', (await url())==='/story/'+encodeURIComponent(first.id));
  await pg.goBack(); await W(400);
  await pg.click('#heatrank li a'); await pg.waitForSelector('#storyTitle',{timeout:15000});
  const top=[...day.stories].sort((a,b)=>(b.heat??-1)-(a.heat??-1)||a.rank-b.rank)[0];
  R('热度榜 item -> its detail page', (await url())==='/story/'+encodeURIComponent(top.id)); }
{ let tws=0, ok=true, why=0; const posts=[];
  for (const s of day.stories) {
    await pg.goto(BASE+'/story/'+encodeURIComponent(s.id),{waitUntil:'networkidle0'}); await pg.waitForSelector('#storyTitle',{timeout:15000});
    const tw=await pg.$$eval('#posts a.tw',a=>a.map(x=>({h:x.href,t:x.target,rel:x.rel,time:x.querySelector('time')?.textContent})));
    tws+=tw.length; posts.push(...tw); if(tw.length!==s.source_posts.length) ok=false;
    if(s.why_it_matters && (await pg.$eval('article[data-story]',e=>e.textContent.includes('为什么重要')))) why++;
    const meta=await pg.$eval('#storyMeta',e=>e.textContent);
    if(meta!==`${s.org_tag?s.org_tag+' · ':''}${s.source_posts.length} 条原帖 · ${s.date.replace(/^\d+-0?(\d+)-0?(\d+)$/,'$1月$2日')}`) { ok=false; console.log('meta',meta); }
    if((await pg.$$eval('#news a',x=>x.length))!==s.news_refs.length) ok=false;
    if(!!(await pg.$('#dataNote'))!==!!s.data_quality) ok=false;
  }
  R(`detail pages: tweets ${tws}/${nPosts} all x.com/_blank, meta / news / 数据说明 per story`, ok && tws===nPosts && posts.every(x=>/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(x.h)&&x.t==='_blank'&&x.rel.includes('noopener')));
  R('timestamps '+posts[0]?.time, posts.length>0&&posts.every(x=>/月\d+日 \d\d:\d\d/.test(x.time||'')));
  R('why_it_matters shown on the detail page', why===day.stories.filter(s=>s.why_it_matters).length); }
// detail page states (only data/*.json locally -> every story is 首次出现; the chart uses an intercepted /trend)
{ const s=day.stories[0], sid=s.id;
  await pg.goto(BASE+'/story/'+encodeURIComponent(sid),{waitUntil:'networkidle0'}); await pg.waitForSelector('#storyTitle'); await W(200);
  const tr=await J('/api/stories/'+encodeURIComponent(sid)+'/trend');
  if (tr.points.length<2) R('首次出现 · 热度 N (no chart) '+await pg.$eval('[data-trend]',e=>e.textContent), await pg.$eval('[data-trend]',e=>e.dataset.trend)==='first' && await pg.$eval('[data-trend]',(e,h)=>e.textContent.includes('首次出现 · 热度 '+h),String(s.heat)) && (await pg.$$('[data-trend] linearGradient')).length===0);
  const t=await pg.$eval('#storyTitle',e=>({fs:getComputedStyle(e).fontSize,fw:getComputedStyle(e).fontWeight}));
  R('desktop title 30/700 '+JSON.stringify(t), t.fs==='30px'&&t.fw==='700');
  R('desktop: 分享这条 in the right column, no bottom bar', await pg.$eval('#shareBox',e=>e.offsetHeight>0&&e.textContent.includes('分享这条')) && await pg.$eval('#storyActions',e=>e.offsetHeight===0));
  const save=await pg.$eval('#shareBox [data-action=save-image]',e=>e.getAttribute('href'));
  const img=await fetch(BASE+save); R(`保存分享图 -> ${save} ${img.status} ${img.headers.get('content-type')}`, save==='/og/story/'+encodeURIComponent(sid)+'.png?size=portrait' && img.status===200 && img.headers.get('content-type')==='image/png');
  await pg.click('#shareBox [data-action=copy-link]'); await W(300);
  const toast=await pg.$eval('[role=status]',e=>e.textContent).catch(()=>null);
  const clip=await pg.evaluate(()=>navigator.clipboard.readText().catch(()=>null));
  R('复制链接 -> clipboard + toast '+clip+' '+toast, clip===BASE+'/story/'+encodeURIComponent(sid) && toast==='链接已复制');
  const html=await (await fetch(BASE+'/story/'+encodeURIComponent(sid))).text();
  R('served HTML has og:image /og/story/<id>.png + twitter:card', html.includes(`/og/story/${encodeURIComponent(sid)}.png"`) && html.includes('name="twitter:card" content="summary_large_image"'));
  const rel=await J('/api/stories/'+encodeURIComponent(sid)+'/related');
  R(`关联话题 chips = /related (${rel.stories.length})`, JSON.stringify(await pg.$$eval('#related a',x=>x.map(a=>a.dataset.id)))===JSON.stringify(rel.stories.map(r=>r.id)));
  await pg.screenshot({path:`${PFX}story-light-desktop.png`,fullPage:true});
  // chart state: a fake 3-day /trend for this story
  const pts=[{date:'2026-10-07',heat:31.5,story_id:'x1'},{date:'2026-10-08',heat:48.2,story_id:'x2'},{date:s.date,heat:s.heat,story_id:sid}];
  await pg.setRequestInterception(true);
  const onT=r=>r.url().endsWith('/api/stories/'+encodeURIComponent(sid)+'/trend')?r.respond({status:200,contentType:'application/json',body:JSON.stringify({points:pts})}):r.continue();
  pg.on('request',onT); await pg.reload({waitUntil:'networkidle0'}); await pg.waitForSelector('[data-trend=chart]',{timeout:15000});
  const ch=await pg.$eval('[data-trend=chart]',e=>({n:e.dataset.points,d:e.querySelector('[data-delta]').dataset.delta,txt:e.textContent,stroke:getComputedStyle(e.querySelector('svg path[stroke]')).stroke,sw:e.querySelector('svg path[stroke]').getAttribute('stroke-width'),grad:e.querySelector('stop').getAttribute('stop-opacity')}));
  const dl=Math.round((s.heat-48.2)*10)/10;
  R('trend chart: 3 points, 2px brand line, 18% gradient, change vs previous day '+JSON.stringify(ch), ch.n==='3' && Number(ch.d)===dl && ch.txt.includes('热度走势 · 近 30 天') && ch.stroke==='rgb(125, 90, 240)' && ch.sw==='2' && ch.grad==='0.18');
  await pg.screenshot({path:`${PFX}story-trend-light-desktop.png`,fullPage:false});
  pg.off('request',onT); await pg.setRequestInterception(false); }
// 404 story: HTTP 404, no og tags, 找不到这个话题, nothing selected in the navigation (PR #20)
{ const resp=await pg.goto(BASE+'/story/2026-10-10-no-such-story',{waitUntil:'networkidle0'}); await W(200);
  const nf=await pg.$eval('[data-state=not-found]',e=>({t:e.querySelector('h1').textContent,p:e.querySelector('p').textContent,b:[...e.querySelectorAll('a')].map(a=>a.textContent+'>'+a.getAttribute('href')).join()})).catch(()=>null);
  R(`story 404: HTTP ${resp.status()} ${JSON.stringify(nf)}`, resp.status()===404 && nf && nf.t==='找不到这个话题' && nf.p==='链接可能写错了，或者这个话题已经不在了' && nf.b==='回到今日>/');
  R('story 404: no og tags, no nav item selected', (await pg.$$('meta[property^="og:"]')).length===0 && (await pg.$$('#sidenav [aria-current]')).length===0); }
await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await W(300);
// favorites (server-side): favorite the first story on its detail page, see it under 我的, unfavorite it there
const before=(await J('/api/favorites')).count;
const sid=await pg.$eval('#tl .story',e=>e.dataset.id);
await pg.click('#tl .story > a'); await pg.waitForSelector('#storyTitle');
await pg.click('#storyNav button[aria-label="收藏"]'); await W(700);
let f=await J('/api/favorites'); R('fav saved on server ('+before+'->'+f.count+')', f.ids.includes(sid) && await pg.$eval('#storyNav button[aria-pressed]',e=>e.getAttribute('aria-pressed'))==='true');
R('fav count in side nav '+await pg.$eval('[data-favcount]',e=>e.textContent), (await pg.$eval('[data-favcount]',e=>e.textContent))===String(f.count));
await pg.click('#sidenav [data-tab=me]'); await pg.waitForSelector('#favs .story,#favs [data-state]',{timeout:15000}); await W(200);
R('我的 lists favorites '+await ns(), (await ns())===f.count);
await pg.click(`#tl .story[data-id="${sid}"] > a`); await pg.waitForSelector('#storyTitle'); await pg.click('#storyNav button[aria-label="取消收藏"]'); await W(900);
f=await J('/api/favorites'); R('unfav restored ('+f.count+')', !f.ids.includes(sid) && f.count===before);
await pg.click('#sidenav [data-tab=me]'); await W(400);
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
 R(`404 page ${bad}: HTTP ${resp.status()} ${JSON.stringify(nf)}`, resp.status()===404 && nf && nf.t==='这一天没有日报' && nf.p===`日报从 ${earliest} 开始` && nf.b==='回到今日>/,看往期>/archive' && await pg.$eval('#sidenav',e=>e.offsetHeight>0) && (await pg.$$('#sidenav [aria-current]')).length===0);
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
{ const s=day.stories[0]; await pg.click('#tl .story > a'); await pg.waitForSelector('#storyTitle'); await W(300);
  await pg.screenshot({path:`${PFX}story-dark-desktop.png`,fullPage:true});
  await pg.setRequestInterception(true);
  const onT=r=>r.url().endsWith('/trend')?r.respond({status:200,contentType:'application/json',body:JSON.stringify({points:[{date:'2026-10-08',heat:62.3,story_id:'x'},{date:s.date,heat:s.heat,story_id:s.id}]})}):r.continue();
  pg.on('request',onT); await pg.reload({waitUntil:'networkidle0'}); await pg.waitForSelector('[data-trend=chart]',{timeout:15000});
  const c=await pg.$eval('[data-trend=chart] [data-delta]',e=>({d:Number(e.dataset.delta),c:getComputedStyle(e).color}));
  R('dark trend chart: a drop is text-2, not up-text '+JSON.stringify(c), c.d>=0 || c.c==='rgb(152, 152, 159)');
  await pg.screenshot({path:`${PFX}story-trend-dark-desktop.png`,fullPage:false});
  pg.off('request',onT); await pg.setRequestInterception(false); }
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
  const r404=await pg.goto(BASE+'/story/2026-10-10-no-such-story',{waitUntil:'networkidle0'}); await W(200);
  R('mobile story 404: tab bar shown, no tab selected', r404.status()===404 && await pg.$eval('#tabbar',e=>e.offsetHeight>0) && (await pg.$$('#tabbar [aria-current]')).length===0);
  await pg.screenshot({path:`${PFX}story-404-mobile.png`});
 }
 { await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await W(200); await pg.tap('#tl .story > a'); await pg.waitForSelector('#storyTitle',{timeout:15000}); await W(300);
  const t=await pg.$eval('#storyTitle',e=>getComputedStyle(e).fontSize);
  const act=await pg.$eval('#storyActions',e=>({h:e.offsetHeight,t:[...e.children].map(c=>c.textContent).join()}));
  R(`mobile ${th} detail: title 26px, 复制链接 + 保存分享图 at the bottom, no right column ${t} ${JSON.stringify(act)}`, t==='26px' && act.h>0 && act.t==='复制链接,保存分享图' && await pg.$eval('.rcol',e=>e.offsetHeight===0));
  R(`mobile ${th} detail: tab bar with 今日 selected`, await pg.$eval('#tabbar [aria-current=page]',e=>e.dataset.tab)==='day');
  R(`mobile ${th} detail: no h-overflow `+await pg.evaluate(()=>document.documentElement.scrollWidth), await pg.evaluate(()=>document.documentElement.scrollWidth)<=390);
  await pg.screenshot({path:`${PFX}story-${th}-mobile.png`,fullPage:true}); }
 await pg.close();
}
// text contrast >= 4.5:1 (WCAG AA) in light and dark, incl. the detail page (tags, notes, posts, chips, actions)
const storyUrls=[...new Set([day.stories[0],day.stories.find(s=>s.data_quality&&s.news_refs.length&&s.badge)].filter(Boolean).map(s=>'/story/'+encodeURIComponent(s.id)))];
{ const CHECK=require('fs').readFileSync(require('path').join(__dirname,'ui-contrast.js'),'utf8');
 for (const th of ['light','dark']) for (const [vp,urls] of [[D,['/','/search','/archive','/archive?tab=trend','/archive?tab=weekly','/me','/day/2000-01-01',...storyUrls,'/story/2026-10-10-no-such-story']],[M,['/','/search',...storyUrls]]]) {
  const pg=await page(vp); await pg.goto(BASE+'/me',{waitUntil:'networkidle0'}); await pg.evaluate(t=>localStorage.setItem('aidaily.theme',JSON.stringify(t)),th);
  for (const u of urls) { await pg.goto(BASE+u,{waitUntil:'networkidle0'}); await W(200);
   if (u.startsWith('/story/') && !u.includes('no-such')) await pg.waitForSelector('#storyTitle',{timeout:15000});
   const bad=await pg.evaluate(CHECK); R(`contrast >= 4.5 ${th} ${vp.width} ${u} ${bad.length?JSON.stringify(bad.slice(0,5)):''}`, bad.length===0); }
  await pg.evaluate(()=>localStorage.removeItem('aidaily.theme')); await pg.close(); } }
R('no JS errors '+JSON.stringify(errs), errs.length===0);
await b.close(); console.log(fails? fails+' FAILED':'ALL PASS'); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

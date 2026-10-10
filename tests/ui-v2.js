// usage: node tests/ui-v2.js <baseURL> [shotPrefix]   (needs puppeteer-core + Chrome; CHROME_PATH overrides the browser path)
// WARNING: toggles one favorite on and off again on the target site (restores the original state).
const p=require('puppeteer-core');const BASE=process.argv[2]||'http://127.0.0.1:8787', PFX=process.argv[3]||'';
const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const R=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
(async()=>{
const b=await p.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--lang=zh-CN']});
const errs=[];
async function page(vp,dark){const pg=await b.newPage();pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
 await pg.setViewport(vp); if(dark) await pg.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]); return pg;}
const D={width:1440,height:1000}, M={width:390,height:1300,deviceScaleFactor:2,isMobile:true,hasTouch:true};
let pg=await page(D,true);
await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await pg.evaluate(()=>localStorage.clear()); await pg.reload({waitUntil:'networkidle0'}); await W(300);
R('default light even with system dark: '+await pg.evaluate(()=>document.documentElement.dataset.theme), await pg.evaluate(()=>document.documentElement.dataset.theme)==='light');
R('bg white '+await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor), await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(255, 255, 255)');
const ns=()=>pg.$$eval('#tl .story',x=>x.length);
R('stories '+await ns(), await ns()===12);
const tw=await pg.$$eval('a.tw',a=>a.map(x=>({h:x.href,t:x.target,rel:x.rel,time:x.querySelector('time')?.textContent})));
R('tweets '+tw.length+' all x.com/_blank', tw.length===33&&tw.every(x=>/^https:\/\/x\.com\/[^/]+\/status\/\d+/.test(x.h)&&x.t==='_blank'&&x.rel.includes('noopener')));
R('timestamps '+tw[0].time, tw.every(x=>/月\d+日 \d\d:\d\d/.test(x.time||'')));
R('names '+await pg.$eval('.tw-name',e=>e.textContent), true);
R('dates list '+await pg.$$eval('#dates .dt',x=>x.length), (await pg.$$eval('#dates .dt',x=>x.length))>=1);
const p0=await pg.$eval('#panel h3',e=>e.textContent);
await pg.screenshot({path:`${PFX}light-desktop.png`});
const geo=()=>pg.$$eval('#tl .story',x=>x.map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.top+scrollY),Math.round(r.height),Math.round(r.width)].join()}).join('|'));const g0=await geo();
const st=await pg.$$('#tl .story'); await (await st[3].$('.sh h2')).click(); await W(150);
const p1=await pg.$eval('#panel h3',e=>e.textContent);
R('no layout shift on select', g0===await geo()); R('select story -> panel changes', p0!==p1 && p1===await pg.$$eval('#tl .story',x=>x[3].querySelector('h2').textContent));
R('no tabs', (await pg.$$('#tabs,[data-tab]')).length===0);
R('ranked order', JSON.stringify(await pg.$$eval('#tl .story .rk',x=>x.map(e=>e.textContent)))===JSON.stringify(Array.from({length:12},(_,i)=>'#'+(i+1))));
R('right column: no search box, no 今日要点, panel only', (await pg.$$('.rcol input, .rcol .sbox, #hl, .hl')).length===0 && (await pg.$$('.rcol .panel')).length===1);
R('no mobile 今日要点 fold-out', (await pg.$$('.mhl')).length===0);
const cardStyle=()=>pg.$$eval('#tl .story',x=>{const a=x[0].getBoundingClientRect(),b=x[1].getBoundingClientRect(),sel=document.querySelector('.story.sel'),un=x.find(e=>e!==sel),cs=getComputedStyle(un),sc=getComputedStyle(sel);return {r:parseFloat(cs.borderTopLeftRadius),bw:parseFloat(cs.borderTopWidth),selBw:parseFloat(sc.borderTopWidth),unBc:cs.borderTopColor,selBc:sc.borderTopColor,selR:parseFloat(sc.borderTopLeftRadius),shadow:cs.boxShadow,selShadow:sc.boxShadow,gap:Math.round(b.top-a.bottom),bg:cs.backgroundColor,mid:getComputedStyle(document.querySelector('#mainCol')).backgroundColor,selRk:getComputedStyle(sel.querySelector('.rk')).backgroundColor};});
const card=await cardStyle();
R('light cards: unselected borderless (transparent), selected blue border, no shadow, white on #f5f5f5, rank pill '+JSON.stringify(card), card.r>=12 && card.bw===card.selBw && card.unBc==='rgba(0, 0, 0, 0)' && card.selBc==='rgb(29, 155, 240)' && card.selBw>=1 && card.selBw<=1.5 && card.selR>=12 && card.shadow==='none' && card.selShadow==='none' && card.gap>=8 && card.bg==='rgb(255, 255, 255)' && card.mid==='rgb(245, 245, 245)' && card.selRk==='rgb(29, 155, 240)');
R('search bar hidden on day view', await pg.$eval('#searchbar',e=>e.offsetHeight===0));
await pg.click('#chips .chip[data-cat="芯片"]'); await W(300); R('chip 芯片 '+await ns(), (await ns())>=1&&(await ns())<12);
await pg.click('#chips .chip[data-cat=""]'); await W(300);
await pg.click('.lnav [data-v=search]'); await W(300);
const sb=await pg.evaluate(()=>{const s=document.querySelector('#searchbar').getBoundingClientRect(),m=document.querySelector('#mainCol').getBoundingClientRect(),h=document.querySelector('.mh').getBoundingClientRect();return {vis:s.height>0,inMain:s.left>=m.left&&s.right<=m.right,top:Math.round(s.top-h.bottom),focus:document.activeElement.id};});
R('search page: input at top of middle column '+JSON.stringify(sb), sb.vis&&sb.inMain&&sb.top<=1&&sb.focus==='q');
await pg.type('#q','Gemini'); await W(900); R('search Gemini '+await ns()+' marks '+await pg.$$eval('mark',x=>x.length), (await ns())>=1 && (await pg.$$eval('mark',x=>x.length))>0);
R('hash has q '+await pg.evaluate(()=>location.hash), (await pg.evaluate(()=>location.hash)).includes('q='));
await pg.screenshot({path:`${PFX}search-desktop.png`});
await pg.$eval('#q',e=>e.value=''); await pg.click('.lnav [data-v=day]'); await W(400);
const before=(await (await fetch(BASE+'/api/favorites')).json()).count;
const sid=await pg.$eval('#tl .story',e=>e.dataset.id);
await pg.click('#tl .story .star'); await W(700);
let f=await (await fetch(BASE+'/api/favorites')).json(); R('fav saved on server ('+before+'->'+f.count+')', f.ids.includes(sid));
R('fav count badge '+await pg.$eval('#favcnt',e=>e.textContent), (await pg.$eval('#favcnt',e=>e.textContent))===String(f.count));
await pg.click('.lnav [data-v=fav]'); await pg.waitForFunction(()=>document.querySelector('.vh h2')?.textContent.includes('收藏'),{timeout:15000}); R('fav view '+await ns(), (await ns())===f.count);
await pg.click(`#tl .story[data-id="${sid}"] .star`); await W(800);
f=await (await fetch(BASE+'/api/favorites')).json(); R('unfav restored ('+f.count+')', !f.ids.includes(sid) && f.count===before);
await pg.click('.lnav [data-v=trend]'); await W(600); R('trend tables '+await pg.$$eval('table.trend',x=>x.length), (await pg.$$eval('table.trend',x=>x.length))===3);
await pg.click('table.trend .tlink[data-search]'); await W(800); R('trend topic -> search '+await ns(), (await ns())>=1);
await pg.click('.lnav [data-v=day]'); await W(400);
R('export link', (await pg.$$eval('a[href="/api/export"][download]',x=>x.length))===2);
const ex=await fetch(BASE+'/api/export'); R('export '+ex.status+' '+ex.headers.get('content-disposition'), ex.ok && /attachment/.test(ex.headers.get('content-disposition')||''));
await pg.click('#dates .dt'); await W(300); R('date click', (await ns())===12);
// theme toggle
await pg.click('.lnav [data-theme-toggle]'); await W(200);
R('toggle -> dark', await pg.evaluate(()=>document.documentElement.dataset.theme)==='dark');
await pg.reload({waitUntil:'networkidle0'}); await W(300);
{const c=await cardStyle(); R('dark cards: #16181c on #000, selected blue border, others none, no shadow '+JSON.stringify(c), c.bg==='rgb(22, 24, 28)'&&c.mid==='rgb(0, 0, 0)'&&c.unBc==='rgba(0, 0, 0, 0)'&&c.selBc==='rgb(29, 155, 240)'&&c.shadow==='none'&&c.selShadow==='none');}
R('dark persisted after reload, bg '+await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor), await pg.evaluate(()=>document.documentElement.dataset.theme)==='dark' && await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor)==='rgb(0, 0, 0)');
await pg.screenshot({path:`${PFX}dark-desktop.png`});
await pg.click('.lnav [data-theme-toggle]'); await W(100);
R('toggle back -> light stored', await pg.evaluate(()=>localStorage.getItem('aidaily.theme'))==='"light"');
await pg.close();
// mobile
for (const theme of ['light','dark']) {
 pg=await page(M,theme==='light'); // system dark for the light run: must still be light
 await pg.goto(BASE+'/',{waitUntil:'networkidle0'}); await pg.evaluate(()=>localStorage.clear()); await pg.reload({waitUntil:'networkidle0'}); await W(300);
 if(theme==='dark'){ await pg.click('.mtools [data-theme-toggle]'); await W(200); R('mobile header toggle -> dark', await pg.evaluate(()=>document.documentElement.dataset.theme)==='dark'); }
 else R('mobile default light', await pg.evaluate(()=>document.documentElement.dataset.theme)==='light');
 R(`mobile ${theme}: aside hidden, inline summaries ${await pg.$$eval('.inline-sum',x=>x.filter(e=>e.offsetHeight>0).length)}`, await pg.$eval('.rcol',e=>e.offsetHeight===0) && (await pg.$$eval('.inline-sum',x=>x.filter(e=>e.offsetHeight>0).length))===12);
 R(`mobile ${theme}: no h-overflow `+await pg.evaluate(()=>document.documentElement.scrollWidth), await pg.evaluate(()=>document.documentElement.scrollWidth)<=390);
 R(`mobile ${theme}: summary below its tweets`, await pg.$eval('#tl .story',s=>{const t=[...s.querySelectorAll('a.tw')].pop().getBoundingClientRect(), i=s.querySelector('.inline-sum').getBoundingClientRect(); return i.top>=t.bottom-1;}));
 await pg.screenshot({path:`${PFX}${theme}-mobile.png`});
 if(theme==='light'){ await pg.click('.mtools [data-v=search]'); await W(200); R('mobile search input visible at top', await pg.$eval('#searchbar',e=>e.offsetHeight>0&&e.getBoundingClientRect().top<200)); await pg.type('#q','Qwen'); await W(900); R('mobile search '+await pg.$$eval('#tl .story',x=>x.length), (await pg.$$eval('#tl .story',x=>x.length))>=1);
  await pg.select('#mdate', await pg.$eval('#mdate option',o=>o.value)); await W(400); R('mobile date select -> day', (await pg.$$eval('#tl .story',x=>x.length))===12); }
 await pg.close();
}
R('no JS errors '+JSON.stringify(errs), errs.length===0);
await b.close(); console.log(fails? fails+' FAILED':'ALL PASS'); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

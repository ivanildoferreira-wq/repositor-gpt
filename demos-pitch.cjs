const {chromium}=require('@playwright/test');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch();
fs.mkdirSync('recordings',{recursive:true});
for(const [name,width,height] of [['celular',390,760],['notebook',1200,720]]){
 const context=await browser.newContext({viewport:{width,height},recordVideo:{dir:'recordings',size:{width,height}},deviceScaleFactor:1,isMobile:name==='celular',hasTouch:name==='celular'});
 const page=await context.newPage(); let sent=[];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin==='http://127.0.0.1:4173')return route.continue();
  const f=new URLSearchParams(route.request().postData()||'');
  if(f.get('publicAction')==='participant'){
   const p=JSON.parse(f.get('payload')),result=p.statusOnly?{registered:false,open:true}:{registered:true,open:true,code:'ABCDEF123456',projectIds:sent,total:sent.length,remaining:5-sent.length,waitMs:0,limit:5,minutes:10};
   return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,result,requestId:p.requestId})});
  }
  if(f.get('publicAction')==='submitEvaluation'){const p=JSON.parse(f.get('payload'));sent.push(p.projectId);return route.fulfill({contentType:'text/html',body:'<html></html>'});}
  if(url.searchParams.has('callback')){
   const result=url.searchParams.get('action')==='receipt'?{received:sent.length>0,score:4.7}:[];
   return route.fulfill({contentType:'application/javascript',body:url.searchParams.get('callback')+'('+JSON.stringify({ok:true,result})+');'});
  }
  return route.abort();
 });
 await page.goto('http://127.0.0.1:4173/repositor-gpt/');
 await page.locator('.project-card').first().waitFor();
 await page.waitForTimeout(1200);
 const wait=ms=>page.waitForTimeout(ms);
 async function scroll(loc){await loc.evaluate(e=>e.scrollIntoView({behavior:'smooth',block:'start'}));await wait(850);}
 async function click(loc){await loc.scrollIntoViewIfNeeded();await wait(500);await loc.click();await wait(850);}
 if(name==='celular'){
  await scroll(page.locator('.voting-status'));
  await click(page.getByRole('button',{name:'Obter meu código',exact:true}));
  await page.getByText('Seu código individual está ativo').waitFor();
  await scroll(page.locator('.catalog-heading'));
  await page.screenshot({path:'recordings/celular.png'});
  await click(page.locator('.project-card').first());
  await click(page.getByRole('button',{name:'Avaliar este projeto'}));
  for(const [i,rating] of (await page.locator('.criterion').all()).entries())await click(rating.getByRole('button',{name:i===0?/^4 -/:/^5 -/}));
  const send=page.getByRole('button',{name:'Enviar avaliação',exact:true});
  await send.scrollIntoViewIfNeeded();await wait(1000);await click(send);
  await page.locator('.evaluation-success').waitFor({timeout:20000});await scroll(page.locator('.evaluation-success'));await wait(1500);
  await click(page.getByRole('button',{name:'Avaliar outros projetos'}));await wait(1200);
 }else{
  await scroll(page.locator('.catalog-heading'));await page.screenshot({path:'recordings/notebook.png'});await wait(1200);
  const sel=page.getByRole('combobox',{name:'Filtrar por modalidade'});await sel.selectOption('Mostra Nacional');await wait(1500);await sel.selectOption('Mostra de Extensão');await wait(1500);await sel.selectOption('Todas');await wait(1000);
  const search=page.getByRole('textbox',{name:'Buscar projeto',exact:true});await search.fill('Flora');await wait(1500);await search.fill('');await wait(700);
  await click(page.locator('nav:visible').getByRole('button',{name:'Ranking',exact:true}));
  await click(page.getByRole('button',{name:'Ver demonstração'}));await scroll(page.locator('.ranking-columns'));await wait(2300);
 }
 const video=page.video();await context.close();fs.renameSync(await video.path(),'recordings/'+name+'.webm');
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

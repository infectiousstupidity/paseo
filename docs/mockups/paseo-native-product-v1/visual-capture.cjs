// Isolated prototype only: does not access installed Paseo, Electron, or backend.
const fs=require('node:fs'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'))}catch(e){console.error('Install Playwright in this folder first: npm install --no-save playwright');process.exit(2)}
(async()=>{
 const root=__dirname,out=path.join(root,'.visual-evidence');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const sizes=[[2048,828],[3440,1440],[5120,1440],[2560,900],[1440,900],[1280,800],[390,844]];
 for(const [width,height] of sizes){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',deviceScaleFactor:1});
  await page.goto('file://'+path.join(root,'index.html'));
  const save=async(name)=>page.screenshot({path:path.join(out,`${name}-${width}x${height}.png`)});
  const nav=async(selector)=>{if(width<=760)await page.locator('.mobiletop [data-action="toggle-nav"]').first().click();await page.locator(selector).first().click()};
  await save('current-workspace');
  await page.locator('[data-action="mode:proposed"]').click();
  await nav('button[data-action="home"]');await save('proposed-home');
  await nav('button[data-action="project:seicho"]');await save('proposed-project');
  await page.locator('[data-action="inspect-review"]').first().click();await save('proposed-review');
  await page.locator('[data-action="close-inspector"]').click();
  await nav('button[data-action="workspace:seicho:main"]');
  await page.locator(width<=760?'button[data-action="pane:diff"]:visible':'button[data-action="pane:diff"]:visible').first().click();await save('proposed-workspace-diff');
  await page.locator('[data-action="line:17"]').first().click();await save('proposed-context-inspector');
  await page.locator('[data-action="close-inspector"]').click();
  await nav('button[data-action="new-terminal"]');await save('proposed-modal');
  const overflow=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth}));
  if(overflow.scrollWidth>width)console.warn('Horizontal overflow:',width,overflow);
  await page.close();
 }
 await browser.close();console.log('Screenshots in',out);
})().catch(err=>{console.error(err);process.exit(1)});

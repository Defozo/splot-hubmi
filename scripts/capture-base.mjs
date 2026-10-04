import { chromium } from 'playwright';
const browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:1440,height:950}});
const base=process.env.E2E_URL||'http://127.0.0.1:5186';
page.on('pageerror',error=>console.log('Browser:',error.message));
try {
await page.goto(base,{waitUntil:'domcontentloaded'}); await page.locator('.innovation-card').first().waitFor();
await page.screenshot({path:'artifacts/screenshots/01-home.png'});
await page.goto(base+'/#/library',{waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:'Mapa wyzwań'}).click();
await page.getByText('Mapa orientacyjna').waitFor(); await page.screenshot({path:'artifacts/screenshots/05-library-map.png'});
await page.goto(base+'/#/search',{waitUntil:'domcontentloaded'});
await page.getByLabel('Opisz swoją potrzebę').fill('Potrzebujemy algorytmu do przewidywania kursu kryptowalut i zysków inwestycyjnych.');
await page.getByRole('button',{name:'Znajdź pasujące rozwiązania'}).click();
await page.getByRole('heading',{name:'Jeszcze nie mamy potwierdzonego kierunku'}).waitFor();
await page.locator('.interpretation').scrollIntoViewIfNeeded(); await page.screenshot({path:'artifacts/screenshots/04-no-match.png'});
console.log('Captured home, library map and real refusal.');
} catch(error) { await page.screenshot({path:'artifacts/capture-error.png'}); console.log((await page.locator('main').innerText()).slice(0,3000)); throw error; }
finally { await browser.close(); }

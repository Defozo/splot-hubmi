import { mkdir, writeFile, readFile } from 'node:fs/promises';
await mkdir('public/fonts', {recursive:true});
const response = await fetch('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;650;700;750;800&display=swap', {headers:{'User-Agent':'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36'}});
if (!response.ok) throw new Error('Font stylesheet unavailable');
let css = await response.text();
let index=0;
for(const url of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g)||[])) {
  const res=await fetch(url); if(!res.ok)throw new Error('Font binary unavailable');
  const name=`font-${++index}.woff2`;
  await writeFile(`public/fonts/${name}`,new Uint8Array(await res.arrayBuffer()));
  css=css.replaceAll(url,`/fonts/${name}`);
}
await writeFile('public/fonts/fonts.css',css);
for(const [family,folder] of [['DM-Sans','dmsans'],['Manrope','manrope']]) {
  const res=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`);
  if(!res.ok)throw new Error('Font license unavailable');
  await writeFile(`public/fonts/LICENSE-${family}.txt`,await res.text());
}
const styles=await readFile('src/styles.css','utf8');
await writeFile('src/styles.css',styles.replace(/^@import url\([^\n]+\);/,"@import url('/fonts/fonts.css');"));
console.log(JSON.stringify({localFontFiles:index}));

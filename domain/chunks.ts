export const CHUNKING_VERSION='pages-1600-v1';
export function chunkHash(text:string) {
  // Deterministic content fingerprint. Raw source SHA-256 is kept separately.
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),2246822519);}
  return `${(a>>>0).toString(16)}${(b>>>0).toString(16)}`;
}
export function splitKnowledge(row:{title:string;summary:string;body:string;problemTags:string[]}) {
  const chunks:{ordinal:number;locator:string;text:string;hash:string;searchText:string}[]=[];
  const sections=row.body.split(/(?=\[Strona \d+(?:[^\]]*)\])/g).filter(text=>text.trim());
  for(const section of sections.length?sections:[row.summary]){
    const page=section.match(/^\[Strona (\d+)(?:[^\]]*)\]/)?.[1];
    const content=section.replace(/^\[Strona \d+(?:[^\]]*)\]\s*/,'').trim();
    let part=0;
    for(let offset=0;offset<content.length;){
      const end=Math.min(content.length,offset+1600);const text=content.slice(offset,end);
      const searchText=`${row.title}. ${row.problemTags.join(' ')}. ${text}`;
      chunks.push({ordinal:chunks.length,locator:page?`strona ${page}, fragment ${++part}`:`sekcja ${sections.indexOf(section)+1}, fragment ${++part}`,text,hash:chunkHash(searchText),searchText});
      if(end===content.length)break;offset=end-120;
    }
  }
  if(!chunks.length||chunks.length>100)throw new Error('Dokument musi zawierać tekst i mieścić się w 100 fragmentach. Podziel materiał.');
  return chunks;
}

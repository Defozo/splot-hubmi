/** URL imports must preserve the complete extracted text or reject the document. */
export function extractImportBody(html:string) {
  const body=html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  if(body.length<100)throw new Error('Nie udało się wydobyć wystarczającej treści. Użyj ręcznej redakcji.');
  if(body.length>100000)throw new Error('Wydobyty tekst przekracza 100000 znaków. Podziel materiał lub przygotuj krótszy, kompletny dokument. Niczego nie zaimportowano.');
  return body;
}

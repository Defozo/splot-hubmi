export const OCR_PROMPT_VERSION = 'pdf-transcription-v1';
export const OCR_PAGE_LIMIT = 10;
export function requiresPdfOcr(pages: string[]) {
  return pages.length === 0 || pages.some(page => page.replace(/\[Strona \d+\]/g, '').trim().length < 40);
}
export function requireOcrConsent(allowOcr: boolean | undefined, consent: boolean | undefined, pages: number) {
  if (!allowOcr || !consent) throw new Error('OCR wymaga zaznaczenia zgody na przekazanie całego PDF dostawcy OpenAI.');
  if (pages < 1 || pages > OCR_PAGE_LIMIT) throw new Error(`OCR obsługuje od 1 do ${OCR_PAGE_LIMIT} stron w dokumencie. Podziel skan.`);
}
export function parseOcrResult(response: any, expectedPages: number) {
  if (response.status !== 'completed') throw new Error('OCR nie zwrócił kompletnego dokumentu. Nie zmieniono opublikowanej wiedzy.');
  const text = (response.output ?? []).filter((item: any) => item.type === 'message').flatMap((item: any) => item.content ?? []).filter((item: any) => item.type === 'output_text').map((item: any) => item.text).join('');
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('OCR zwrócił niepoprawny format. Spróbuj ponownie lub przepisz tekst ręcznie.'); }
  if (!Array.isArray(data.pages) || data.pages.length !== expectedPages || data.pages.some((page: any, index: number) => !page || page.page !== index + 1 || typeof page.text !== 'string' || typeof page.uncertain !== 'boolean' || page.text.length > 20000)) throw new Error('OCR pominął stronę albo zmienił ich kolejność. Wynik wymaga ponownego odczytu.');
  const body = data.pages.map((page: any) => `[Strona ${page.page}${page.uncertain ? ', niepewny odczyt OCR' : ''}]\n${page.text}`).join('\n\n');
  if (body.length > 100000 || data.pages.map((page: any) => page.text).join('').trim().length < 100) throw new Error('OCR nie odczytał wystarczającej treści. Potrzebny jest czytelniejszy skan.');
  const inputTokens = Number(response.usage?.input_tokens ?? 0), outputTokens = Number(response.usage?.output_tokens ?? 0);
  if (![inputTokens, outputTokens].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Nieprawidłowe rozliczenie odpowiedzi OCR.');
  return {body, uncertainPages: data.pages.filter((page: any) => page.uncertain).map((page: any) => page.page), inputTokens, outputTokens};
}

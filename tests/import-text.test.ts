import {describe,it,expect} from 'vitest';
import {extractImportBody} from '../domain/import-text';
describe('Complete URL import text',()=>{
  it('retains the final text at the maximum supported length',()=>{const body='a'.repeat(99984)+' KONIEC ŹRÓDŁA!';expect(body.length).toBeLessThanOrEqual(100000);expect(extractImportBody(`<article>${body}</article>`)).toBe(body);});
  it('rejects an oversized complete document instead of silently dropping its last characters',()=>{expect(()=>extractImportBody(`<p>${'a'.repeat(100000)} WAŻNE OGRANICZENIE KOŃCOWE</p>`)).toThrow('Niczego nie zaimportowano');});
  it('discards executable styling and script content before checking the readable text limit',()=>{const body='Opis materiału społecznego. '.repeat(10);expect(extractImportBody(`<style>${'x'.repeat(110000)}</style><script>ignored()</script><p>${body}</p>`)).toBe(body.trim());});
});

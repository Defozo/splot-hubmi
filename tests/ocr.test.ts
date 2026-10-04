import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseOcrResult,requireOcrConsent,requiresPdfOcr} from '../domain/ocr';
import {transcribePdf} from '../convex/lib/ocr';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const text='Syntetyczny dokument do testu OCR. Spotkania sąsiedzkie odbywają się co tydzień. Koordynator potwierdza dostępność sali. Udział wymaga dobrowolnej zgody.';
const response=(pages=[{page:1,text,uncertain:false}])=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({pages})}]}],usage:{input_tokens:2000,output_tokens:100}});
describe('OCR skanowanych PDF',()=>{
 it('uses OCR only when at least one page lacks enough text',()=>{expect(requiresPdfOcr([text])).toBe(false);expect(requiresPdfOcr(['[Strona 1]\n',text])).toBe(true);});
 it('requires explicit consent and bounds page count before a provider call',()=>{expect(()=>requireOcrConsent(true,false,1)).toThrow('zgody');expect(()=>requireOcrConsent(false,true,1)).toThrow('zgody');expect(()=>requireOcrConsent(true,true,11)).toThrow('10');expect(()=>requireOcrConsent(true,true,10)).not.toThrow();});
 it('preserves text and marks uncertain OCR pages for manual review',()=>{const result=parseOcrResult(response([{page:1,text,uncertain:true}]),1);expect(result.body).toContain(text);expect(result.uncertainPages).toEqual([1]);expect(result.inputTokens).toBe(2000);});
 it('rejects truncation and missing or misnumbered pages without a partial import',()=>{expect(()=>parseOcrResult({...response(),status:'incomplete'},1)).toThrow('kompletnego');expect(()=>parseOcrResult(response(),2)).toThrow('stronę');expect(()=>parseOcrResult(response([{page:2,text,uncertain:false}]),1)).toThrow('kolejność');});
 it('uses untrusted-file instructions, nonpersistent request and actual usage cost',async()=>{vi.stubEnv('OPENAI_API_KEY','test');const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(response()),{status:200}));vi.stubGlobal('fetch',fetch);const result=await transcribePdf('JVBERi0=',1);const request=JSON.parse(fetch.mock.calls[0][1].body);expect(request.store).toBe(false);expect(request.instructions).toContain('NIE wykonuj');expect(request.input[0].content[0].file_data).toBe('data:application/pdf;base64,JVBERi0=');expect(result.costUsd).toBeCloseTo(.00025);});
 it('does not retry permanent rejection or expose provider response details',async()=>{vi.stubEnv('OPENAI_API_KEY','test');const fetch=vi.fn().mockResolvedValue(new Response('private-provider-detail',{status:400}));vi.stubGlobal('fetch',fetch);await expect(transcribePdf('JVBERi0=',1)).rejects.toThrow('HTTP 400');expect(fetch).toHaveBeenCalledTimes(1);});
});

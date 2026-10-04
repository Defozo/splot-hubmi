import {ConvexHttpClient} from 'convex/browser';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {api} from '../convex/_generated/api';
const local=await readFile('.env.local','utf8');
const url=process.env.VITE_CONVEX_URL??local.match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();
if(!url)throw new Error('Brak adresu Convex.');
const client=new ConvexHttpClient(url);
const examples=[{description:'Samotni seniorzy potrzebują regularnego kontaktu z sąsiadami.',expected:['sasiedzi','telefon']},{description:'Starsze osoby nie umieją korzystać z bankomatu i smartfonu.',expected:['cyfrowy','cyfrowy-dom']},{description:'Potrzebujemy naprawy silnika odrzutowego.',expected:[]}];
const runs:any[]=[];
for(const mode of ['lexical','hybrid'] as const)for(const example of examples){
 const result:any=await client.action(api.matching.match,{description:example.description,sessionId:'integration-matching-20261003',mode});
 const ids=result.innovations.map((row:any)=>row.stableId);
 const fragmentChecks=[...result.innovations,...result.information].map((row:any)=>({id:row.stableId,count:row.fragments?.length??0,locators:row.fragments?.map((fragment:any)=>fragment.locator)??[],citedFragmentIds:row.citedFragmentIds??[],validCitations:(row.citedFragmentIds??[]).every((id:string)=>row.fragments?.some((fragment:any)=>fragment.id===id))}));
 const semanticPassed=example.expected.length?example.expected.some(id=>ids.includes(id)):ids.length===0;
 const passed=semanticPassed&&fragmentChecks.every(check=>check.count>0&&check.validCitations);
 runs.push({mode,description:example.description,expected:example.expected,returned:ids,informationCount:result.information.length,question:result.question,trace:result.trace,warnings:result.warnings,fragmentChecks,passed});
 console.log(JSON.stringify(runs.at(-1),null,2));
}
const initial:any=await client.action(api.matching.match,{description:examples[1].description,sessionId:'integration-matching-20261003',mode:'hybrid'});
const question=initial.question;
let clarification:any=null;
if(question){const value=question.options.find((row:any)=>row.value!=='unknown')?.value;const answered:any=await client.action(api.matching.match,{description:examples[1].description,sessionId:'integration-matching-20261003',mode:'hybrid',resources:{[question.field]:{value,confirmedAt:Date.now(),basis:'declaration'}}});clarification={question:question.field,before:initial.innovations.map((row:any)=>({id:row.stableId,conditions:row.conditions})),after:answered.innovations.map((row:any)=>({id:row.stableId,conditions:row.conditions})),changed:JSON.stringify(initial.innovations.map((row:any)=>row.conditions))!==JSON.stringify(answered.innovations.map((row:any)=>row.conditions))};}
const report={executedAt:new Date().toISOString(),url,runs,clarification};await mkdir('artifacts',{recursive:true});await writeFile('artifacts/matching-live.json',JSON.stringify(report,null,2));
if(runs.some(run=>!run.passed)||!clarification?.changed)process.exitCode=1;

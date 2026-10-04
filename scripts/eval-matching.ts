import {writeFile,mkdir} from 'node:fs/promises';
import {demoCorpus,corpusSources} from '../domain/corpus';
import {buildMatch,RULE_VERSION} from '../domain/matching';
import {matchingCases} from '../tests/matching-cases';
import {splitKnowledge,CHUNKING_VERSION} from '../domain/chunks';
const started=Date.now();
const records=demoCorpus.map(item=>({...item,_id:item.stableId,sourceIds:['source']}));
const sources=[{...corpusSources[0],_id:'source'}];
const chunks=records.flatMap(row=>splitKnowledge(row).map(chunk=>({...chunk,knowledgeId:row._id})));
const texts=[...chunks.map(chunk=>chunk.searchText),...matchingCases.map(row=>row.description)];
let vectors:number[][]=[];let embeddingError:string|null=null;let tokens=0;
const model=process.env.EMBEDDING_MODEL??'text-embedding-3-small';
if(process.env.OPENAI_API_KEY){
 try{const response=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:texts,dimensions:1536}),signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error(`Embedding HTTP ${response.status}`);const body=await response.json();vectors=body.data.sort((a:any,b:any)=>a.index-b.index).map((row:any)=>row.embedding);tokens=body.usage.total_tokens;}catch(error){embeddingError=String(error);}
}else embeddingError='Brak OPENAI_API_KEY: nie wykonano pomiaru toru wektorowego ani hybrydy.';
const dot=(a:number[],b:number[])=>a.reduce((sum,n,index)=>sum+n*b[index],0);
const modes=vectors.length?['lexical','vector','hybrid']:['lexical'];
const results=modes.map(mode=>{
 const rows=matchingCases.map((test,index)=>{
  const scores=vectors.length?records.map(row=>({id:row._id,score:Math.max(...chunks.flatMap((chunk,chunkIndex)=>chunk.knowledgeId===row._id?[dot(vectors[chunkIndex],vectors[chunks.length+index])]:[]))})).sort((a,b)=>b.score-a.score):[];
  const result=buildMatch(test.description,records,sources,{},scores,mode);
  const hits=result.innovations.slice(0,3).map(row=>row.stableId);
  return {id:test.id,split:test.split,description:test.description,expected:test.expected,returned:hits,hit:test.expected.some(id=>hits.includes(id)),abstained:hits.length===0,informationHit:test.information?result.information.slice(0,3).some(row=>row.stableId===test.information):null};
 });
 const positives=rows.filter(row=>row.expected.length),negatives=rows.filter(row=>!row.expected.length);
 const infoRows=positives.filter(row=>row.informationHit!==null);
 const holdoutPositive=positives.filter(row=>row.split==='holdout'),holdoutNegative=negatives.filter(row=>row.split==='holdout');
 return {mode,positiveCount:positives.length,negativeCount:negatives.length,hitAt3:positives.filter(row=>row.hit).length/positives.length,correctAbstention:negatives.filter(row=>row.abstained).length/negatives.length,falseAbstentions:positives.filter(row=>row.abstained).length,informationHitAt3:infoRows.filter(row=>row.informationHit).length/infoRows.length,holdout:{positiveCount:holdoutPositive.length,negativeCount:holdoutNegative.length,hitAt3:holdoutPositive.filter(row=>row.hit).length/holdoutPositive.length,correctAbstention:holdoutNegative.filter(row=>row.abstained).length/holdoutNegative.length},rows};
});
const report={executedAt:new Date().toISOString(),ruleVersion:RULE_VERSION,chunkingVersion:CHUNKING_VERSION,chunkCount:chunks.length,corpusVersion:1,corpusCount:records.length,caseCount:matchingCases.length,model:vectors.length?model:null,dimensions:1536,embeddingTokens:tokens,embeddingCostUsd:tokens*0.02/1_000_000,durationMs:Date.now()-started,method:'Offline ranking comparison with actual OpenAI chunk embeddings and identical deterministic application rules. Fragment scores are aggregated by maximum within each document. Convex index retrieval and LLM explanations are verified separately by integration flows.',limitations:['Autorski syntetyczny zbiór techniczny, bez oceny eksperta ROPS.','Pierwsze 50 przypadków to regresja po kalibracji progu. Dodatkowe 20 przypadków holdout powstało po zamrożeniu reguł wersji .2 i nie posłużyło do strojenia.','Mała próba nie dowodzi trafności dla populacji ani innowacji rzeczywistych.'],embeddingError,results};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/matching-evaluation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.map(({rows,...summary})=>({...summary,failures:rows.filter(row=>row.expected.length?!row.hit:!row.abstained)}))},null,2));
if(results.some(result=>result.hitAt3<0.85||result.correctAbstention<0.9))process.exitCode=1;

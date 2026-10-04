import {ConvexHttpClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {ASSISTANT_FIELDS,containsFinancialClaim} from '../domain/assistant';
const q=(name:string)=>makeFunctionReference<'query'>(name),a=(name:string)=>makeFunctionReference<'action'>(name);
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url)throw new Error('Brak adresu Convex.');
const client=new ConvexHttpClient(url);const session:any=await client.action(a('auth:signIn'),{provider:'password',params:{email:'instytucja@splot.demo',password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});if(!session.tokens?.token)throw new Error('Logowanie nie powiodło się.');client.setAuth(session.tokens.token);
const library:any[]=await client.query(q('knowledge:list'),{});const innovation=library.find(row=>row.stableId==='sasiedzi');if(!innovation)throw new Error('Brak opublikowanej innowacji kontrolnej.');
const rows:any[]=[];
for(const kind of ['idea','middleman'] as const){const start=performance.now();const result:any=await client.action(a('ai:assist'),{kind,content:kind==='idea'?'Chcę przeciwdziałać samotności seniorów poprzez cotygodniowe małe spotkania sąsiedzkie. To demonstracja. Nie znam jeszcze kosztów ani liczby wolontariuszy.':'Instytucja chce uruchomić demonstracyjny test Kręgów sąsiedzkich dla 12 seniorów. Ma dostępną salę i koordynatora, ale nie zna stawek kosztów. Potrzebuje propozycji działań, ryzyk i pomiaru przed i po.',...(kind==='middleman'?{innovationId:innovation._id}:{})});
 const labeledProposals=result.suggestions?.every((suggestion:any)=>suggestion.basis==='ai_proposal');
 const sourceReferencesValid=result.suggestions?.every((suggestion:any)=>suggestion.sourceIds.every((id:string)=>innovation.sourceIds.includes(id)));
 const fieldContractValid=result.suggestions?.every((suggestion:any)=>(ASSISTANT_FIELDS[kind] as readonly string[]).includes(suggestion.field));
 const noMonetaryClaims=result.suggestions?.every((suggestion:any)=>!containsFinancialClaim(suggestion.text))&&result.missing?.every((item:string)=>!containsFinancialClaim(item));
 rows.push({kind,durationMs:performance.now()-start,model:result.model,promptVersion:result.promptVersion,suggestionCount:result.suggestions?.length??0,labeledProposals,sourceReferencesValid,fieldContractValid,noMonetaryClaims,missing:result.missing,disclaimer:result.disclaimer,suggestions:result.suggestions,passed:result.model!=='unavailable'&&result.suggestions?.length>=3&&labeledProposals&&sourceReferencesValid&&fieldContractValid&&noMonetaryClaims});
}
const report={executedAt:new Date().toISOString(),url,innovationId:innovation._id,innovationVersion:innovation.version,rows,limitations:['Rzeczywista inferencja dwóch asystentów na danych syntetycznych; wynik jest propozycją do edycji, nie oceną merytoryczną eksperta.','Propozycji nie zapisano automatycznie do dokumentów ani nie wysłano do partnerów.']};await mkdir('artifacts',{recursive:true});await writeFile('artifacts/assistants-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(rows.some(row=>!row.passed||!row.sourceReferencesValid))process.exitCode=1;

import {ConvexHttpClient,ConvexClient} from 'convex/browser';
import {makeFunctionReference} from 'convex/server';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const q=(name:string)=>makeFunctionReference<'query'>(name),m=(name:string)=>makeFunctionReference<'mutation'>(name),a=(name:string)=>makeFunctionReference<'action'>(name);
const url=(await readFile('.env.local','utf8')).match(/^VITE_CONVEX_URL=(.+)$/m)?.[1].trim();if(!url)throw new Error('Brak adresu Convex.');
async function login(email:string){const client=new ConvexHttpClient(url!);const session:any=await client.action(a('auth:signIn'),{provider:'password',params:{email,password:process.env.DEMO_PASSWORD??'SplotDemo2026!',flow:'signIn'}});if(!session.tokens?.token)throw new Error('Logowanie nie powiodło się.');client.setAuth(session.tokens.token);return {client,token:session.tokens.token};}
const writer=await login('instytucja@splot.demo'),reader=await login('rops@splot.demo');
const observer=new ConvexClient(url);observer.setAuth(async()=>reader.token);
const firstSeen=new Map<string,{at:number;notificationId:string}>();
let initialized=false,subscriptionError:Error|null=null;
const unsubscribe=observer.onUpdate(q('hub:notifications'),{},(notifications:any[])=>{const at=performance.now();for(const notification of notifications)if(notification.recordId&&!firstSeen.has(notification.recordId))firstSeen.set(notification.recordId,{at,notificationId:notification._id});initialized=true;},error=>{subscriptionError=error;});
async function waitUntil(predicate:()=>boolean,timeout:number){const start=Date.now();while(!predicate()){if(subscriptionError)throw subscriptionError;if(Date.now()-start>timeout)throw new Error('Przekroczono czas oczekiwania na subskrypcję administratora.');await new Promise(resolve=>setTimeout(resolve,15));}}
const stamp=new Date().toISOString(),rows:any[]=[];
try{
 await waitUntil(()=>initialized,15000);
 for(let index=0;index<20;index++){
  const started=performance.now();const recordId:any=await writer.client.mutation(m('hub:save'),{kind:'idea',title:`Pomiar techniczny komunikacji ${stamp} ${index+1}`,data:{problem:'Syntetyczna próba trwałego zapisu i reaktywnego powiadomienia. Nie jest rzeczywistym zgłoszeniem.',audience:'Użytkownicy demonstracyjni',stage:'pomysł',context:'Izolowany pomiar 20 operacji',resources:'Nie dotyczy',trials:'Test techniczny',publicConsent:false}});
  const acknowledged=performance.now();await waitUntil(()=>firstSeen.has(recordId),8000);const delivered=firstSeen.get(recordId)!;
  rows.push({sample:index+1,recordId,notificationId:delivered.notificationId,writeAckMs:acknowledged-started,notificationFromWriteStartMs:delivered.at-started,notificationAfterWriteAckMs:Math.max(0,delivered.at-acknowledged),notificationArrivedBeforeAck:delivered.at<acknowledged});
 }
}finally{unsubscribe();await observer.close();}
const percentile=(values:number[],p:number)=>[...values].sort((left,right)=>left-right)[Math.ceil(values.length*p)-1];
const report={executedAt:new Date().toISOString(),url,measurement:'20 sequential durable idea writes from authenticated institution session; separate administrator JWT and WebSocket subscription receive actual notification updates.',sampleCount:rows.length,p95WriteAckMs:percentile(rows.map(row=>row.writeAckMs),.95),p95NotificationFromWriteStartMs:percentile(rows.map(row=>row.notificationFromWriteStartMs),.95),p95NotificationAfterWriteAckMs:percentile(rows.map(row=>row.notificationAfterWriteAckMs),.95),passedWriteGate:percentile(rows.map(row=>row.writeAckMs),.95)<=1000,passedNotificationGate:percentile(rows.map(row=>row.notificationFromWriteStartMs),.95)<=2000,limitations:['Próba 20 kolejnych zapisów w działającym demo, bez obciążenia 100 sesjami.','Czas powiadomienia liczony konserwatywnie od rozpoczęcia zapisu do callbacku drugiej sesji; nie wymaga synchronizacji zegara klienta i serwera.','Zmierzone dostarczenie danych do klienta subskrypcji, nie dodatkowy czas renderowania przeglądarki.','20 jawnie technicznych prywatnych fiszek i powiadomień pozostało jako ślad pomiaru.'],rows};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/write-notifications-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
if(!report.passedWriteGate||!report.passedNotificationGate)process.exitCode=1;

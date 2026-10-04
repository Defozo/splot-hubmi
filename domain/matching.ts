/** Deterministic, shared matching rules. No credentials or provider calls. */
export const RULE_VERSION = 'pl-social-2026-10-03.4';
export const PROMPT_VERSION = 'grounded-fragments-v2';
export const SYNONYMS: Record<string, string[]> = {
  samotnosc: ['samotn', 'osamotn', 'izolac', 'towarzyst', 'kontaktow', 'kontaktów', 'relacj', 'sasiad', 'sąsiad', 'odwiedzin'],
  transport: ['transport', 'dojazd', 'dowoz', 'dowóz', 'autobus', 'przejazd', 'mobilnosc', 'mobilność'],
  cyfrowe: ['cyfrow', 'smartfon', 'telefon', 'internet', 'komputer', 'urzadzen', 'urządzeń', 'aplikac', 'bankomat', 'biletomat'],
  opieka: ['opiek', 'wytchnien', 'zalezna', 'zależną', 'niesamodziel', 'demenc', 'alzheimer'],
  psychiczne: ['psychiczn', 'psycholog', 'dobrostan', 'stres', 'emocj', 'kryzys', 'lekiem', 'lękiem'],
  praca: ['bezrob', 'zatrudn', 'zawodow', 'pracy', 'prace', 'pracę', 'pracodawc'],
  dostepnosc: ['dostepn', 'dostępn', 'niepelnospraw', 'niepełnospraw', 'wozk', 'wózk', 'barier', 'niewidom', 'slabowidz', 'słabowidz'],
  integracja: ['migran', 'uchodz', 'uchodź', 'integrac', 'jezyk', 'język', 'nowych mieszkanc'],
  zywnosc: ['zywnosc', 'żywność', 'jedzen', 'posilk', 'posiłk', 'glod', 'głod', 'spozywcz', 'spożywcz', 'marnowan'],
  mieszkanie: ['bezdom', 'mieszkani', 'nocleg', 'eksmis', 'schronien'],
  seniorzy: ['senior', 'starsz', 'emeryt', 'babci', 'dziad'],
  mlodziez: ['mlodzie', 'młodzie', 'nastolat', 'uczni', 'szkol', 'dzieci', 'dzieck'],
  rodziny: ['rodzin', 'rodzic', 'matk', 'ojc'],
};
const PROBLEM_KEYS = new Set(['samotnosc', 'transport', 'cyfrowe', 'opieka', 'psychiczne', 'praca', 'dostepnosc', 'integracja', 'zywnosc', 'mieszkanie']);
export const normalize = (value: string) => value.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
export function concepts(text: string): string[] {
  const normalized = normalize(text);
  return Object.entries(SYNONYMS).filter(([key, words]) => normalized.includes(key) || words.some(word => normalized.includes(normalize(word)))).map(([key]) => key);
}
export function problemConcepts(text: string) { return concepts(text).filter(key => PROBLEM_KEYS.has(key)); }
export function audienceCompatible(description:string,item:Knowledge) {
  const text=normalize(description);
  const older=/(senior|osob\w* starsz|emeryt|babci|dziad)/.test(text);
  const young=/(nastolat|mlodzie|dzieci|dzieck|uczni)/.test(text);
  if(older&&!young&&item.audienceTags.includes('mlodziez')&&!item.audienceTags.includes('seniorzy'))return false;
  if(young&&!older&&item.audienceTags.includes('seniorzy')&&!item.audienceTags.includes('mlodziez'))return false;
  return true;
}
export function searchTokens(text: string) {
  return [...new Set([...concepts(text), ...normalize(text).split(/[^a-z0-9]+/).filter(word => word.length >= 4)])].slice(0, 16);
}
export function stripPrivate(text: string): string {
  return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[usunięty e-mail]')
    .replace(/(?:\+48[ .-]?)?(?<!\d)(?:\d[ .-]?){9}(?!\d)/g, '[usunięty telefon]')
    .replace(/\b\d{11}\b/g, '[usunięty identyfikator]')
    .replace(/(?:ul\.|ulica|adres\s*:)[^\n;,]{3,90}/gi, '[usunięty adres]')
    .replace(/(?:nazywam się|imię i nazwisko\s*:|osoba\s*:)[^\n;,]{3,70}/gi, '[usunięte dane osoby]').slice(0, 6000);
}
export interface Requirement {
  id: string; key: string; category: string; label: string; operator?: 'eq' | 'gte' | 'oneOf' | 'in'; expected?: unknown;
  mandatory: boolean; allowPartner?: boolean; sourceId?: string; sourceVersion?: number; approved?: boolean;
  responsible?: string; reviewAt?: number; unit?: string; question?: string; options?: Array<{value: any; label: string}>;
}
export interface ResourceEvidence {value: unknown; confirmedAt?: number; validUntil?: number; basis?: string; partnerConfirmed?: boolean; sourceId?: string}
export interface Knowledge {
  _id: string; stableId: string; version: number; kind: string; status: string; title: string; summary: string; body?: string;
  tags: string[]; problemTags: string[]; audienceTags: string[]; sourceIds: string[]; requirements: Requirement[];
  evidenceLevel: string; demo: boolean; publishedScope?: string; [key: string]: any;
}
export function lexicalScore(description: string, item: Knowledge): number {
  if(!audienceCompatible(description,item))return 0;
  const topics = problemConcepts(description);
  const itemTopics = new Set(item.problemTags.map(normalize));
  const topicMatches = topics.filter(topic => itemTopics.has(topic)).length;
  // Matching an audience alone must never count as matching its problem.
  if (topics.length && !topicMatches) return 0;
  const words = searchTokens(description).filter(word => !['seniorzy', 'mlodziez', 'rodziny'].includes(word));
  const full = normalize(`${item.title} ${item.summary} ${item.body ?? ''} ${item.tags.join(' ')}`);
  const wordMatches = words.filter(word => full.includes(word)).length;
  if (!topicMatches && wordMatches < 2) return 0;
  return topicMatches * 12 / Math.max(1, topics.length) + wordMatches / Math.max(1, words.length) * 3;
}
export function lexicalRanking(description: string, items: Knowledge[]) {
  return items.map(item => ({id: item._id, score: lexicalScore(description, item)})).filter(item => item.score > 0).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
}
export function rrf(lists: Array<Array<{id: string; score: number}>>, k = 60) {
  const scores = new Map<string,number>();
  for(const list of lists) list.slice(0,20).forEach((item,index) => scores.set(item.id,(scores.get(item.id) ?? 0)+1/(k+index+1)));
  return [...scores].map(([id,score]) => ({id,score})).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
}
export function assessRequirements(requirements: Requirement[], resources: Record<string, any> = {}, now = Date.now()) {
  return requirements.map(requirement => {
    const raw = resources[requirement.key];
    const resource: ResourceEvidence | undefined = raw !== undefined && raw !== null && typeof raw === 'object' ? raw : raw === undefined || raw === null || raw === 'unknown' ? undefined : {value:raw};
    const common = {id:requirement.id,key:requirement.key,label:requirement.label,mandatory:requirement.mandatory,expected:requirement.expected??true,operator:requirement.operator??'eq',unit:requirement.unit??null,sourceId:requirement.sourceId ?? null,sourceVersion:requirement.sourceVersion ?? null};
    if (!requirement.approved || (requirement.reviewAt && requirement.reviewAt < now)) return {...common,status:'unknown' as const,evidence:'Warunek wymaga aktualnej weryfikacji kuratora.'};
    if (!resource || resource.value === 'unknown' || resource.value === null || resource.value === undefined) return {...common,status:'unknown' as const,evidence:'Brak aktualnej deklaracji zasobu.'};
    if ((resource.validUntil && resource.validUntil < now) || (resource.confirmedAt && resource.confirmedAt < now - 180*86400000)) return {...common,status:'unknown' as const,evidence:'Potwierdzenie utraciło ważność.'};
    if (resource.basis === 'partner' && (!requirement.allowPartner || !resource.partnerConfirmed)) return {...common,status:'unknown' as const,evidence:'Partner musi potwierdzić ten zasób, a dokumentacja musi dopuszczać jego udział.'};
    const expected = requirement.expected ?? true;
    const met = requirement.operator === 'gte' ? typeof resource.value === 'number' && typeof expected === 'number' && resource.value >= expected : ['oneOf','in'].includes(requirement.operator??'') ? Array.isArray(expected) && expected.includes(resource.value) : resource.value === expected;
    const basis = resource.basis === 'expert' ? 'Weryfikacja eksperta' : resource.basis === 'partner' ? 'Potwierdzenie partnera' : 'Deklaracja instytucji';
    return {...common,status:met?'met' as const:'unmet' as const,evidence:`${basis}: ${String(resource.value)}${requirement.unit ? ' '+requirement.unit : ''}. ${met ? 'Warunek spełniony.' : 'Warunek nie jest spełniony.'}`};
  });
}
export function readiness(conditions: ReturnType<typeof assessRequirements>): 'ready'|'blocked'|'clarify' {
  return conditions.some(c=>c.mandatory && c.status==='unmet') ? 'blocked' : conditions.some(c=>c.mandatory && c.status==='unknown') ? 'clarify' : 'ready';
}
export function nextStep(state: string) {return state==='blocked'?'Uzgodnij brakujący zasób z partnerem lub skonsultuj alternatywę.':state==='clarify'?'Potwierdź warunki i przygotuj Kartę wdrożenia.':'Przygotuj Kartę wdrożenia i uzgodnij test z opiekunem.';}
export function chooseQuestion(items: Knowledge[], resources: Record<string, any> = {}, now=Date.now()) {
  const baseline = items.map(item=>readiness(assessRequirements(item.requirements,resources,now)));
  const options = new Map<string, {requirement: Requirement; priority:number}>();
  for (const item of items) for(const requirement of item.requirements) {
    const condition=assessRequirements([requirement],resources,now)[0];
    if(condition.status!=='unknown' || !requirement.approved || (requirement.reviewAt && requirement.reviewAt<now))continue;
    const choices = requirement.options ?? (typeof requirement.expected==='number'?[{value:0,label:'Nie mamy tego zasobu'},{value:requirement.expected,label:`Tak, minimum ${requirement.expected} ${requirement.unit ?? ''}`}]:[{value:true,label:'Tak'},{value:false,label:'Nie'}]);
    const signatures=new Set<string>();
    let influence=0;
    for (const option of choices) {
      // A new object is essential: simulations cannot write answers to the real profile.
      const hypothetical={...resources,[requirement.key]:{value:option.value,confirmedAt:now,basis:'declaration'}};
      const states=items.map(candidate=>readiness(assessRequirements(candidate.requirements,hypothetical,now)));
      signatures.add(states.join('|'));
      influence+=states.filter((state,index)=>state!==baseline[index]).length;
    }
    if(signatures.size<2)continue;
    options.set(requirement.key,{requirement:{...requirement,options:choices},priority:influence+(requirement.mandatory?10:0)});
  }
  const selected=[...options.values()].sort((a,b)=>b.priority-a.priority)[0];
  if(!selected)return null;
  return {field:selected.requirement.key,text:selected.requirement.question ?? `Czy możesz zapewnić: ${selected.requirement.label.toLocaleLowerCase('pl')}?`,why:'Odpowiedź zmieni ocenę warunków lub następny krok dla pokazanych rozwiązań.',options:[...selected.requirement.options!,{value:'unknown',label:'Nie wiem'}]};
}
function conditionChanged(previous:any,next:any){
  if(!previous)return true;
  return ['status','evidence','mandatory','sourceId','sourceVersion','label'].some(key=>previous[key]!==next[key])||['expected','operator','unit'].some(key=>previous[key]!==undefined&&JSON.stringify(previous[key])!==JSON.stringify(next[key]));
}
export function materialChange(previous:any, next:any): string|null {
  if(!previous)return next.innovations?.length?'new_candidate':null;
  const before=new Map<string,any>((previous.innovations ?? []).map((item:any)=>[item.stableId,item]));
  const after=new Map<string,any>((next.innovations ?? []).map((item:any)=>[item.stableId,item]));
  if([...after.keys()].some(id=>!before.has(id)))return 'new_candidate';
  if([...before.keys()].some(id=>!after.has(id)))return 'source_withdrawn';
  for(const [id,item] of after){const old=before.get(id);if(old.evidenceLevel!==item.evidenceLevel)return 'new_evidence';if((old.conditions??[]).length!==(item.conditions??[]).length||(item.conditions??[]).some((condition:any)=>conditionChanged(old.conditions?.find((c:any)=>c.key===condition.key),condition)))return 'condition_changed';if(old.version!==item.version||JSON.stringify(old.sources)!==JSON.stringify(item.sources))return 'new_evidence';}
  const beforeInfo=new Set((previous.information??[]).map((item:any)=>item.stableId));
  const afterInfo=new Set((next.information??[]).map((item:any)=>item.stableId));
  if([...afterInfo].some(id=>!beforeInfo.has(id)))return 'new_evidence';
  if([...beforeInfo].some(id=>!afterInfo.has(id)))return 'source_withdrawn';
  return null;
}
export function describeMaterialChange(previous:any,next:any){
  const type=materialChange(previous,next);if(!type)return null;
  const before=new Map<string,any>([...(previous?.innovations??[]),...(previous?.information??[])].map((item:any)=>[item.stableId??item.id,item]));
  const after=new Map<string,any>([...(next.innovations??[]),...(next.information??[])].map((item:any)=>[item.stableId??item.id,item]));
  const entries:{title:string;detail:string;sources:{title:string;url:string}[]}[]=[];
  const labels:Record<string,string>={met:'spełniony',unmet:'niespełniony',unknown:'niepotwierdzony'};
  const add=(item:any,detail:string)=>entries.push({title:item.title,detail,sources:(item.sources??[]).filter((source:any)=>typeof source.url==='string').map((source:any)=>({title:source.title,url:source.url}))});
  for(const [id,item]of after){const old=before.get(id);if(!old){add(item,`Nowa propozycja: „${item.title}” (wersja ${item.version}).`);continue;}
    const changed=(item.conditions??[]).filter((condition:any)=>conditionChanged(old.conditions?.find((c:any)=>c.key===condition.key),condition));
    const removed=(old.conditions??[]).filter((condition:any)=>!(item.conditions??[]).some((c:any)=>c.key===condition.key));
    if(changed.length||removed.length){const details=changed.map((condition:any)=>{const prior=old.conditions?.find((c:any)=>c.key===condition.key);const threshold=prior?.expected!==undefined&&JSON.stringify(prior.expected)!==JSON.stringify(condition.expected)?` Wymagana wartość: ${JSON.stringify(prior.expected)} → ${JSON.stringify(condition.expected)}${condition.unit?' '+condition.unit:''}.`:'';const basis=prior?.sourceVersion!==condition.sourceVersion?` Podstawa: wersja ${prior?.sourceVersion??'nieznana'} → ${condition.sourceVersion??'nieznana'}.`:'';return `${condition.label}: ${labels[prior?.status]??'brak wcześniejszej oceny'} → ${labels[condition.status]??condition.status}.${threshold}${basis} ${condition.evidence}`;});details.push(...removed.map((condition:any)=>`Usunięto warunek „${condition.label}” z aktualnej wersji.`));add(item,`„${item.title}”: ${details.join(' ')}`);}
    else if(old.evidenceLevel!==item.evidenceLevel)add(item,`„${item.title}”: zmieniono poziom dowodów z „${old.evidenceLevel}” na „${item.evidenceLevel}”.`);
    else if(old.version!==item.version||JSON.stringify(old.sources)!==JSON.stringify(item.sources))add(item,`„${item.title}”: nowa wersja materiału lub jego źródła (${old.version} → ${item.version}). Sprawdź aktualną podstawę rekomendacji.`);
  }
  for(const [id,item]of before)if(!after.has(id))add(item,`„${item.title}” nie jest już rekomendowane. Materiał lub jego źródło wycofano, wygasło albo przestało pasować do potrzeby.`);
  return {type,message:entries.map(entry=>entry.detail).slice(0,3).join(' ').slice(0,1500),entries};
}
export function canCommitWatch(current:any, job:{needVersion:number;matchRevision:number;corpusVersion:number}) {
  return current?.data?.watch===true && current.version===job.needVersion && current.data.matchRevision===job.matchRevision && current.data.targetCorpusVersion===job.corpusVersion;
}
export function buildMatch(description:string,items:Knowledge[],sources:any[],resources:Record<string,any>={},vector:Array<{id:string;score:number}>=[],mode='hybrid') {
  const publicItems=items.filter(item=>item.status==='published' && item.publishedScope==='public:published' && audienceCompatible(description,item));
  const lexical=lexicalRanking(description,publicItems);
  const topics=problemConcepts(description);
  // Without a recognized problem, incidental semantic proximity is insufficient.
  // The stricter threshold is an explicit abstention rule, not a success probability.
  const eligibleVectors=vector.filter(hit=>{const item=publicItems.find(item=>item._id===hit.id);return item && hit.score>=(topics.length?0.35:0.55) && (!topics.length || item.problemTags.some(tag=>topics.includes(tag)));});
  const ranks=mode==='lexical'?lexical:mode==='vector'?eligibleVectors:rrf([lexical,eligibleVectors]);
  const sourceMap=new Map(sources.map(source=>[String(source._id),source]));
  const seen=new Set<string>();
  const candidates=ranks.map(rank=>publicItems.find(item=>item._id===rank.id)!).filter(item=>{if(!item||seen.has(item.stableId))return false;seen.add(item.stableId);return true;});
  const decorate=(item:Knowledge)=>{
    const conditions=assessRequirements(item.requirements,resources);
    const state=readiness(conditions);
    return {id:item._id,stableId:item.stableId,version:item.version,title:item.title,summary:item.summary,demo:item.demo,evidenceLevel:item.evidenceLevel,why:`Opis dotyczy obszaru: ${item.problemTags.join(', ')}. ${item.summary}`,conditions,fragments:item.fragments??[],sources:item.sourceIds.map(id=>sourceMap.get(String(id))).filter(Boolean).map(source=>({id:String(source._id),title:source.title,url:source.url,version:source.version,demo:source.demo ?? false})),readiness:state,nextStep:nextStep(state)};
  };
  const innovationDocs=candidates.filter(item=>item.kind==='innovation').slice(0,10);
  return {innovations:innovationDocs.map(decorate),information:candidates.filter(item=>item.kind!=='innovation').slice(0,10).map(decorate),question:chooseQuestion(innovationDocs.slice(0,3),resources),abstention:innovationDocs.length?null:'W opublikowanym korpusie nie mamy potwierdzonej propozycji dla tej potrzeby. Możesz zapisać potrzebę, obserwować nową wiedzę, porozmawiać z ROPS lub rozwinąć pomysł.'};
}

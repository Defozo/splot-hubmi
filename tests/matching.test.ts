import {describe,it,expect} from 'vitest';
import {assessRequirements,buildMatch,chooseQuestion,canCommitWatch,materialChange,stripPrivate,rrf} from '../domain/matching';
import {demoCorpus,corpusSources} from '../domain/corpus';
const source={...corpusSources[0],_id:'source'};
const records=demoCorpus.map(item=>({...item,_id:item.stableId,sourceIds:['source']}));
describe('Dopasowania i dowody',()=>{
 it('separates audience from problem and keeps information separate',()=>{const result=buildMatch('Samotni seniorzy potrzebują kontaktów z sąsiadami',records,[source]);expect(result.innovations.map(item=>item.stableId)).toContain('sasiedzi');expect(result.innovations.map(item=>item.stableId)).not.toContain('cyfrowy');expect(result.information[0].stableId).toBe('guide-samotnosc');});
 it('abstains when corpus has no relevant innovation',()=>expect(buildMatch('Potrzebujemy naprawy silnika samolotu pasażerskiego',records,[source]).innovations).toHaveLength(0));
 it('does not recommend a youth-only program to seniors even with vector similarity',()=>expect(buildMatch('Seniorzy potrzebują wsparcia psychicznego',records,[source],{},[{id:'emocje',score:.9}]).innovations).toHaveLength(0));
 it('does not treat digital training for seniors as a schoolchildren audience',()=>expect(buildMatch('Seniorzy potrzebują szkolenia z obsługi bankomatu',records,[source]).innovations.map(item=>item.stableId)).toContain('cyfrowy'));
 it('withdrawn content never appears even with high vector score',()=>{const unpublished=records.map(item=>({...item,status:'withdrawn'}));expect(buildMatch('Samotność seniorów',unpublished,[source],{},[{id:'sasiedzi',score:1}]).innovations).toHaveLength(0);});
 it('does not hide mandatory constraints',()=>{const result=buildMatch('Nastolatki potrzebują pomocy w radzeniu sobie ze stresem psychicznym',records,[source],{psychologist:false});expect(result.innovations[0].readiness).toBe('blocked');expect(result.innovations[0].conditions.find(item=>item.key==='psychologist')?.status).toBe('unmet');});
 it('unknown price is never zero',()=>{const innovation=records.find(item=>item.stableId==='wytchnienie')!;expect(assessRequirements(innovation.requirements,{}).find(item=>item.key==='budgetGrosz')?.status).toBe('unknown');});
 it('expired declarations and unconfirmed partners are unknown',()=>{const requirement=records[0].requirements[0];expect(assessRequirements([requirement],{coordinator:{value:true,validUntil:1}})[0].status).toBe('unknown');expect(assessRequirements([requirement],{coordinator:{value:true,basis:'partner',partnerConfirmed:false}})[0].status).toBe('unknown');});
 it('simulates useful question without mutating profile',()=>{const profile={};const selected=records.filter(item=>['cyfrowy','cyfrowy-dom'].includes(item.stableId));const question=chooseQuestion(selected,profile)!;expect(question).not.toBeNull();expect(question.options.at(-1)?.value).toBe('unknown');expect(profile).toEqual({});const withAnswer={[question.field]:{value:true}};expect(JSON.stringify(assessRequirements(selected[0].requirements,profile))).not.toBe(JSON.stringify(assessRequirements(selected[0].requirements,withAnswer)));});
 it('skips room question when no candidate requires a room',()=>{const selected=records.filter(item=>item.stableId==='telefon');expect(chooseQuestion(selected,{} as any)?.field).not.toBe('accessibleRoom');});
 it('unknown answer preserves uncertainty',()=>{const requirement=records[0].requirements[0];expect(assessRequirements([requirement],{coordinator:'unknown'})[0].status).toBe('unknown');});
 it('RRF deduplicates IDs',()=>expect(rrf([[{id:'a',score:1}],[{id:'a',score:0.5},{id:'b',score:0.4}]])).toHaveLength(2));
 it('strips contacts, identifier and addresses before provider use',()=>{const clean=stripPrivate('Nazywam się Jan Kowalski; ul. Długa 22; jan@example.pl; +48 123 456 789; 12345678901');expect(clean).not.toContain('@');expect(clean).not.toContain('Kowalski');expect(clean).not.toContain('Długa');expect(clean).not.toContain('12345678901');});
});
describe('Obserwowanie i wyścigi zadań',()=>{
 const latest={version:3,data:{watch:true,matchRevision:8,targetCorpusVersion:12}};
 it('rejects older job finishing after newest job',()=>{expect(canCommitWatch(latest,{needVersion:3,matchRevision:8,corpusVersion:12})).toBe(true);expect(canCommitWatch(latest,{needVersion:3,matchRevision:7,corpusVersion:11})).toBe(false);});
 it('rejects changed need and consent withdrawn while job runs',()=>{expect(canCommitWatch({...latest,version:4},{needVersion:3,matchRevision:8,corpusVersion:12})).toBe(false);expect(canCommitWatch({...latest,data:{...latest.data,watch:false}},{needVersion:3,matchRevision:8,corpusVersion:12})).toBe(false);});
 it('notifies on new candidate or withdrawn basis, not styling',()=>{const a={stableId:'x',evidenceLevel:'concept',conditions:[],title:'przed'};expect(materialChange({innovations:[a]},{innovations:[{...a,title:'po'}]})).toBeNull();expect(materialChange({innovations:[]},{innovations:[a]})).toBe('new_candidate');expect(materialChange({innovations:[a]},{innovations:[]})).toBe('source_withdrawn');});
});

"""Native multimodal listening/viewing, supplied with actual encoded media bytes.

This is a perceptual model review, explicitly not a human listening claim.
"""
import base64,datetime,hashlib,json,os,sys
from pathlib import Path
import requests
source,output=map(Path,sys.argv[1:3])
assert source.suffix in ['.mp3','.mp4','.wav']
mime={'.mp3':'audio/mpeg','.mp4':'video/mp4','.wav':'audio/wav'}[source.suffix]
data=source.read_bytes()
fingerprint=hashlib.sha256(data).hexdigest()
if output.exists():raise RuntimeError('Preserve prior review; select a new path.')
model='gemini-3.8-flash'
prompt='''Listen carefully to the entire supplied actual audio track. Do not use a transcript in place of listening. Describe only what is actually audible. This is a Polish software product pitch. Return JSON: coverage (what you listened to, duration estimate), speech (language, voice characteristics, intelligibility, pronunciation issues with times), non_speech_audio (is there music, what instruments/timbres, audible rhythmic or melodic structure, balance under speech), editing (gaps, clicks, clipping, unnatural joins, cadence, beginning and full last spoken words, music ending), actionable_findings (exact timestamps and minimal supported fixes), passed_for_clear_narration_and_quiet_background_music. If no music is audible say so. A transcript alone cannot establish music or mixing. If video is supplied, also watch it and assess whether narration matches what is visibly happening, caption readability, framing and abrupt or accidental cuts; separate audiovisual findings from pure audio. Don't invent defects to fill fields.'''
request={'contents':[{'role':'user','parts':[{'text':prompt},{'inline_data':{'mime_type':mime,'data':base64.b64encode(data).decode()}}]}],'generationConfig':{'temperature':0.2,'maxOutputTokens':6500,'responseMimeType':'application/json'}}
record={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'started','model':model,'method':'Native audio/video input with actual encoded bytes; no transcript, expected mix settings or previous verdict supplied. Automated perceptual review, not human listening.','source':str(source.resolve()),'sourceSha256':fingerprint,'uploadedBytes':len(data)}
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
response=requests.post(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',headers={'x-goog-api-key':os.environ['GOOGLE_AI_STUDIO_API_KEY'],'Content-Type':'application/json'},json=request,timeout=210)
if not response.ok:
    record.update(status='failed',httpStatus=response.status_code)
    output.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    raise RuntimeError(f'Media review HTTP {response.status_code}; body omitted')
result=response.json()
review='\n'.join(p['text'] for p in result.get('candidates',[{}])[0].get('content',{}).get('parts',[]) if 'text' in p)
record.update(status='complete',completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),responseId=result.get('responseId'),actualModel=result.get('modelVersion'),usage=result.get('usageMetadata'),review=json.loads(review))
output.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'path':str(output),'review':record['review']},ensure_ascii=False))

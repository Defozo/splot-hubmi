import os,requests,json
r=requests.get('https://generativelanguage.googleapis.com/v1beta/models',headers={'x-goog-api-key':os.environ['GOOGLE_AI_STUDIO_API_KEY']},timeout=45)
if not r.ok:raise RuntimeError(f'Model discovery HTTP {r.status_code}')
print(json.dumps([{'name':m['name'],'methods':m.get('supportedGenerationMethods')} for m in r.json().get('models',[]) if 'generateContent' in m.get('supportedGenerationMethods',[]) and 'gemini' in m['name']]))

"""Build the reviewable submission without secrets, database exports or dependencies."""
from pathlib import Path
import hashlib, json, zipfile, datetime, re, os

root = Path(__file__).resolve().parents[1]
out = root / 'output'
out.mkdir(exist_ok=True)
required = [out/'pdf/splot-hubmi.pdf', out/'splot-hubmi.pptx', out/'splot-demo.mp4']
for p in required:
    if not p.is_file():
        raise SystemExit(f'Missing deliverable: {p.name}')
dirs = ['src','convex','domain','tests','scripts','docs','public','official-2026-10-03']
paths = [p for name in dirs for p in (root/name).rglob('*') if p.is_file()]
paths += [p for p in root.iterdir() if p.is_file() and (p.suffix in ['.md','.json','.ts','.html'] or p.name in ['.env.example','.gitignore','.node-version','.nvmrc'])]
paths += list((root/'artifacts').glob('*.json'))
paths += list((root/'artifacts/screenshots').glob('*.png'))
paths += list((root/'artifacts/presentation-source-screenshots').glob('*.png'))
paths += list((root/'artifacts/card-concurrency').glob('*.json'))
paths += list((root/'artifacts/source-review-browser').glob('*.png'))
paths += [p for p in out.rglob('*') if p.is_file() and '_video_work' not in p.parts and p.suffix in ['.pdf','.pptx','.mp4','.vtt','.srt','.txt','.md']]
paths += [p for p in (root/'artifacts/fixtures').glob('*') if p.is_file() and p.suffix in ['.pdf','.png','.json']]
paths = sorted({p for p in paths if '__pycache__' not in p.parts})
entries = []
secret_names = ['SPLOT_CONVEX_DEPLOY_KEY', 'CONVEX_ACCESS_TOKEN', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'GOOGLE_AI_STUDIO_API_KEY', 'HACKTRIBE_PASSWORD']
secret_values = [os.environ[name].encode() for name in secret_names if os.environ.get(name)]
for p in paths:
    rel = p.relative_to(root).as_posix()
    # Account assignments and the authenticated form readback stay with the owner.
    if p.name.startswith('USER_REQUEST_') or p.name == 'HACKTRIBE_UPDATE_RESULT.json':
        continue
    # The publication receipt contains this archive's hash and is written after
    # packaging. Including an earlier receipt would describe a different ZIP.
    if rel == 'artifacts/materials-publication.json':
        continue
    if any(part in ['node_modules','.local','.git','__pycache__','demo-raw'] for part in p.parts):
        raise SystemExit(f'Unexpected private/generated directory: {rel}')
    if p.name.startswith('.env') and p.name != '.env.example':
        raise SystemExit('Environment secrets must never be packaged.')
    data = p.read_bytes()
    if any(secret in data for secret in secret_values):
        raise SystemExit(f'Injected secret appears in {rel}. Packaging stopped; no value printed.')
    if p.suffix in ['.md','.json','.ts','.tsx','.mjs','.py','.txt','.html']:
        content=data.decode('utf-8',errors='ignore')
        if re.search(r'-----BEGIN (?:RSA )?PRIVATE KEY-----', content) or re.search(r'\b(?:sk-proj-|gsk_)[a-zA-Z0-9_-]{30,}', content) or re.search(r'\bAIza[a-zA-Z0-9_-]{30,}', content):
            raise SystemExit(f'Secret-shaped value in {rel}. Review before packaging.')
    entries.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
manifest={'title':'Splot dla HubMI','team':json.loads((root/'TEAM.json').read_text('utf-8')),'builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'demo':'https://agile-kiwi-698.eu-west-1.convex.site','files':entries}
(out/'SUBMISSION-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
archive=out/'splot-hubmi-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for entry in entries: z.write(root/entry['path'],entry['path'])
    z.write(out/'SUBMISSION-MANIFEST.json','output/SUBMISSION-MANIFEST.json')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
report={'file':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'entries':len(entries)+1,'archiveIntegrity':'passed','injectedSecretChecks':len(secret_values),'secretPatternCheck':'passed'}
(out/'PACKAGE-CHECK.json').write_text(json.dumps(report,indent=2),'utf-8')
print(json.dumps(report,indent=2))

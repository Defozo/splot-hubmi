"""Round 2: hold the actual filled feedback frame, then retain its real submission."""
import datetime,hashlib,json,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'output/_video_work'
backup=WORK/'versions/pitch-v2-evidence'
backup.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='de4d640fb5163959c14ac9d48b67b5693772222528e3e8ef83a771cab2ef87b9'
assert sha(ROOT/'output/splot-demo.mp4') in [expected,'47469b7ebe57d81416cede74e5f70e5a113ef337334e8db318d23c33d43fefb6']
manifest=WORK/'manifests/edit-decisions.json'
decisions=json.loads((backup/'edit-decisions.json').read_text(encoding='utf-8'))
scene=next(s for s in decisions['scenes'] if s['id']=='13-opinia')
source=Path(scene['source'])
assert sha(source)=='0502ed35aad1a059d509c7662e50f0bf62dc5dbdce4c56b49322b7f8f980358e'
for file in [manifest,WORK/'reports/pitch-final-technical-qc.json',WORK/'reports/contact-sheet.jpg',Path(scene['clip']),*list((ROOT/'artifacts').glob('*audio*.json')),*list((ROOT/'artifacts').glob('*video*.json')),ROOT/'artifacts/media-perceptual-review.json']:
    target=backup/file.name
    if not target.exists():shutil.copy2(file,target)
clip=WORK/'render/13-opinia-v3b.mp4'
visual=WORK/'render/splot-pitch-visual-v3b.mp4'
assert not clip.exists() and not visual.exists()
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
    assert p.returncode==0,p.stderr
    return p.stdout
still=WORK/'reports/scene13-source-frame34.png'
run(['ffmpeg','-v','error','-y','-i',str(source),'-vf','select=eq(n\\,34)','-frames:v','1',str(still)])
graph='[0:v]setpts=PTS-STARTPTS,scale=1920:972:flags=lanczos,setsar=1,pad=1920:1080:0:0:color=0x133f38,fps=25[recording];[recording][1:v]overlay=0:972,format=yuv420p[v]'
parts=[]
for kind,duration,inputs in [('hold',10.32,['-loop','1','-framerate','25','-i',str(still)]),('motion',.68,['-ss','1.40','-i',str(source)])]:
    part=WORK/f'render/13-{kind}-v3b.mp4'
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2',*inputs,'-loop','1','-i',str(WORK/'captions/13-opinia.png'),'-filter_complex_threads','2','-filter_complex',graph,'-map','[v]','-an','-t',str(duration),'-r','25','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(part)])
    parts.append(part)
partlist=WORK/'render/concat-scene13-v3b.txt'
partlist.write_text('\n'.join("file '"+str(p).replace('\\','/')+"'" for p in parts),encoding='utf-8')
run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(partlist),'-c:v','copy','-an',str(clip)])
before_clip=scene['clip']
scene.update(clip=str(clip),speed=None,retiming={'finding':'FC-01','round':2,'kind':'hold recorded filled form for narration, then original send/confirmation','segments':[{'kind':'hold','sourceFrame':34,'sourceTimeSeconds':1.36,'outputStart':122,'outputEnd':132.32,'outputFrames':258},{'kind':'clip','sourceInFrame':35,'sourceOutFrameExclusive':52,'sourceInSeconds':1.40,'sourceOutSeconds':2.08,'speed':1,'outputStart':132.32,'outputEnd':133,'outputFrames':17}],'sourceUnchanged':True,'newFeedbackSubmitted':False,'beforeClipSha256':sha(Path(before_clip)),'afterClipSha256':sha(clip)})
concat=WORK/'render/concat-v3b.txt'
concat.write_text('\n'.join("file '"+s['clip'].replace('\\','/')+"'" for s in decisions['scenes']),encoding='utf-8')
run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(concat),'-map','0:v:0','-c:v','copy','-movflags','+faststart',str(visual)])
decisions['revision']={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'finding':'FC-01','round':2,'scope':'Only scene 13 temporal presentation. Remaining 17 scene clips unchanged. Audio unchanged.','beforeFinalSha256':expected,'unchangedClips':[{'id':s['id'],'sha256':sha(Path(s['clip']))} for s in decisions['scenes'] if s['id']!='13-opinia']}
manifest.write_text(json.dumps(decisions,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'manifests/scene13-retiming-v3.json').write_text(json.dumps(scene['retiming'],ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'visual':str(visual),'sha256':sha(visual),'finding':'FC-01','duration':179,'unchangedScenes':17}))

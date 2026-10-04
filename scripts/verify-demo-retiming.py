"""Prove the final correction changes only scene 13 and preserves encoded audio."""
import datetime,hashlib,json,subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'output/_video_work'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sources={'v2':WORK/'render/splot-pitch-v2.mp4','v3':ROOT/'output/splot-demo.mp4'}
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
    assert p.returncode==0,p.stderr
def digest(version):
    path=WORK/f'reports/decoded-{version}-frames.md5'
    run(['ffmpeg','-v','error','-y','-threads','2','-i',str(sources[version]),'-map','0:v:0','-an','-f','framemd5',str(path)])
    return [line.split(',')[-1].strip() for line in path.read_text().splitlines() if line and not line.startswith('#')]
with ThreadPoolExecutor(max_workers=2) as pool:
    before,after=list(pool.map(digest,['v2','v3']))
assert len(before)==len(after)==4475
changed=[i for i,(a,b) in enumerate(zip(before,after)) if a!=b]
assert changed and all(3050<=i<3325 for i in changed)
folder=WORK/'frames/scene13-v3'
folder.mkdir(parents=True,exist_ok=True)
frames=[]
for timestamp in [121.96,122,125.48,127.52,132.28,132.32,132.4,132.52,132.96,133,134]:
    file=folder/f'{timestamp:06.2f}.png'
    run(['ffmpeg','-v','error','-y','-ss',str(timestamp),'-i',str(sources['v3']),'-map','0:v:0','-frames:v','1',str(file)])
    frames.append({'timeSeconds':timestamp,'path':file.relative_to(ROOT).as_posix(),'sha256':sha(file)})
qc=json.loads((WORK/'reports/pitch-final-technical-qc.json').read_text(encoding='utf-8'))
assert qc['unchangedEncodedAac']['verified']
report={'schemaVersion':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','beforeSha256':sha(sources['v2']),'finalSha256':sha(sources['v3']),'durationSeconds':179,'frameCount':4475,'changedFrameCount':len(changed),'firstChangedFrame':min(changed),'lastChangedFrame':max(changed),'onlyChangedRangeSeconds':[122,133],'allOtherDecodedFramesIdentical':True,'unchangedScenes':17,'method':'Decoded every video frame of v2 and v3 to FFmpeg framemd5 and compared frame pixel hashes. Every changed frame is within scene 13. AAC is compared after stream-copy extraction to ADTS.','encodedAudio':qc['unchangedEncodedAac'],'retiming':'Original frame 34 (1.36s) held through 132.32s, followed by original frames 35 through 51 at normal speed to 133s. No new submission or synthetic UI.','targetedFrames':frames}
(ROOT/'artifacts/demo-video-v3-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','changedFrames':len(changed),'unchangedScenes':17,'audioIdentical':True,'finalSha256':report['finalSha256']}))

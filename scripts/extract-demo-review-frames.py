"""Create review images from the exact final delivery MP4, with hash provenance."""
import datetime,hashlib,json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'output/_video_work'
source=ROOT/'output/splot-demo.mp4'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
qc=json.loads((WORK/'reports/pitch-final-technical-qc.json').read_text(encoding='utf-8'))
assert sha==qc['finalSha256']
decisions=json.loads((WORK/'manifests/edit-decisions.json').read_text(encoding='utf-8'))
frames=WORK/'frames'
(frames/'boundaries').mkdir(parents=True,exist_ok=True)
records=[]
for scene in decisions['scenes']:
    points=[('representative',scene['finalEnd']-1,frames/(scene['id']+'.jpg')),
            ('start',scene['finalStart'],frames/'boundaries'/(scene['id']+'-start.jpg')),
            ('middle',(scene['finalStart']+scene['finalEnd'])/2,frames/'boundaries'/(scene['id']+'-middle.jpg')),
            ('end',scene['finalEnd']-.04,frames/'boundaries'/(scene['id']+'-end.jpg'))]
    for kind,time,path in points:
        index=round(time*25)
        time=index/25
        result=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2','-ss',str(time),'-i',str(source),'-map','0:v:0','-frames:v','1','-q:v','2','-threads','2','-update','1',str(path)],capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
        assert result.returncode==0,result.stderr
        records.append({'scene':scene['id'],'kind':kind,'timeSeconds':time,'frameIndex':index,'path':path.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    print(scene['id'],flush=True)

sheet=Image.new('RGB',(1440,6*298),'#f4f4f4')
draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
for i,record in enumerate(r for r in records if r['kind']=='representative'):
    x=(i%3)*480;y=(i//3)*298
    with Image.open(ROOT/record['path']) as frame:
        sheet.paste(frame.resize((480,270),Image.Resampling.LANCZOS),(x,y))
    draw.text((x+8,y+276),f"{record['scene']}  {record['timeSeconds']:.2f}s",font=font,fill='#123f38')
sheetpath=WORK/'reports/contact-sheet.jpg'
sheet.save(sheetpath,quality=95)
manifest={'schemaVersion':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'output/splot-demo.mp4','sourceSha256':sha,'durationSeconds':179,'fps':25,'method':'FFmpeg accurate seek and decode of the final encoded delivery MP4, no separate visual-stage file or cached clip used. Four frames per scene: start, middle, representative and last frame.','captionTypes':{'visibleRail':'Concise on-screen scene summaries, including the demo URL, planned service cost and team at the end.','externalSrtVtt':'Complete spoken Polish narration aligned to the actual soundtrack. These are intentionally different forms of text.'},'contactSheet':{'path':sheetpath.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(sheetpath.read_bytes()).hexdigest()},'frames':records}
(ROOT/'artifacts/demo-video-frames.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sourceSha256':sha,'frames':len(records),'manifest':'artifacts/demo-video-frames.json'}))

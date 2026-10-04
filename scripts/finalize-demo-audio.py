"""Assemble the approved audio without re-encoding the verified UI video.

This revision reuses the project's deterministic FFmpeg/Pillow capture renderer.
Pillow renders captions because the installed FFmpeg lacks libass. A lossless
video remux preserves the reviewed interface imagery exactly; AAC is encoded once.
"""
import datetime,hashlib,json,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"output/_video_work"
SKILL=Path('C:/Users/defoz/.agents/skills/reusable-video-editing')
version=sys.argv[1] if len(sys.argv)>1 else 'v1'
assert version in ['v1','v2','v3','v3b']
visual=WORK/('render/splot-pitch-visual.mp4' if version=='v1' else f'render/splot-pitch-visual-{version}.mp4')
mix=WORK/'audio/pitch/final-mix.wav'
audio_input=WORK/'render/splot-pitch-v2.mp4' if version.startswith('v3') else mix
candidate=WORK/f'render/splot-pitch-{version}.mp4'
planfile=WORK/f'plans/pitch-{version}.json'
capture=json.loads((WORK/'manifests/pitch-capture.json').read_text(encoding='utf-8'))
audio=json.loads((WORK/'manifests/pitch-audio-mix.json').read_text(encoding='utf-8'))
script=json.loads((WORK/'audio-script.json').read_text(encoding='utf-8'))
def run(args):
    result=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:raise RuntimeError((result.stdout+'\n'+result.stderr)[-6000:])
    return result.stdout
probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(visual)]))
assert float(probe['format']['duration'])==179
plan={'schema_version':1,'plan_id':'pitch-v1','title':'Splot dla HubMI: od potrzeby do pilotażu','approved':False,'approval':None,'timeline':{'width':1920,'height':1080,'fps':'25','sample_rate':48000,'video_codec':'libx264','pixel_format':'yuv420p','bit_depth':8,'audio_codec':'aac','audio_channels':2},'editorial_rationale':'User requested energetic Polish pitch, narration, quiet legal music and updated real demo. Preserve the complete established 18-scene workflow. Real freshly recorded UI is deterministically assembled in the project capture renderer, with a caption rail outside the viewport; no synthesized UI. Final assembly copies that reviewed video essence and encodes the already mixed authorized narration/music once. The audio mix manifest traces 18 generated utterances and original local instrumental synthesis. The original silent release remains in .local/pitch-backup/video-2026-10-03. Authority: USER_REQUEST_PITCH_AUDIO_2026-10-03.md and parent delegation, no additional approval required.','items':[{'id':'verified-ui-sequence','type':'clip','source':str(visual),'source_in_frame':0,'source_out_frame':4475,'source_fps':'25','speed':1,'audio':{'mode':'delivery','path':str(mix),'gain_db':0},'transition':{'type':'cut','duration_seconds':0},'overlays':[],'rationale':'Actual 18 scenes, recorded from the updated public demo. Independent views and final decode reviewed. Full mapping in pitch-capture and edit-decisions manifests.'}],'music':None,'sound_effects':[],'subtitles':None,'topaz_requests':[],'voiceover':[],'dependencies':[{'kind':'audio','path':str(mix)},{'kind':'other','path':str(WORK/'manifests/pitch-audio-mix.json')},{'kind':'other','path':str(WORK/'manifests/pitch-capture.json')},{'kind':'other','path':str(WORK/'audio/pitch/music-provenance.json')}],'deliverables':[{'id':'splot-pitch-mp4','role':'browser','path':str(candidate),'container':'mp4','primary':True,'subtitle_mode':'none'}]}
plan['plan_id']=f'pitch-{version}'
if version.startswith('v3'):
    plan['editorial_rationale']+=' Final correction round 2, independent finding FC-01: only the timing of scene 13 changes. The actual filled form is held through narration and the original submission follows before 133 seconds. The 17 other clips, duration and encoded AAC from v2 remain unchanged.'
    plan['dependencies'].append({'kind':'other','path':str(WORK/'manifests/scene13-retiming-v3.json')})
    plan['dependencies'].append({'kind':'other','path':str(WORK/'manifests/edit-decisions.json')})
if planfile.exists():raise RuntimeError('Preserve approved plan and candidate. Choose a new version for a correction.')
planfile.write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
validation=run([sys.executable,str(SKILL/'scripts/video_tool.py'),'plan-validate',str(WORK/'project.yaml'),str(planfile)])
print(validation,flush=True)
run([sys.executable,str(SKILL/'scripts/video_tool.py'),'approve',str(WORK/'project.yaml'),str(planfile),'agent: user-authorized pitch/audio revision'])
approved=json.loads(planfile.read_text(encoding='utf-8'))
assert approved['approved'] and approved['approval']['plan_hash']
audio_codec=['-c:a','copy'] if version.startswith('v3') else ['-c:a','aac','-b:a','192k','-ar','48000','-ac','2']
run(['ffmpeg','-hide_banner','-v','error','-y','-i',str(visual),'-i',str(audio_input),'-map','0:v:0','-map','1:a:0','-c:v','copy',*audio_codec,'-metadata','title=Splot dla HubMI','-metadata','artist=DEFOZO SOFTWARE HOUSE; Michał Kiełtyka','-metadata:s:a:0','language=pol','-t','179','-movflags','+faststart',str(candidate)])
run(['ffmpeg','-hide_banner','-v','error','-i',str(candidate),'-map','0:v:0','-map','0:a:0','-f','null','-'])
final_probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(candidate)]))
video=next(s for s in final_probe['streams'] if s['codec_type']=='video')
sound=next(s for s in final_probe['streams'] if s['codec_type']=='audio')
assert int(video['nb_read_frames'])==4475
assert float(final_probe['format']['duration'])<=180
assert sound['sample_rate']=='48000' and sound['channels']==2
decoded=WORK/'audio/pitch/final-aac-decoded.wav'
review=WORK/'audio/pitch/final-aac-review.mp3'
run(['ffmpeg','-v','error','-y','-i',str(candidate),'-map','0:a:0','-c:a','pcm_s24le',str(decoded)])
run(['ffmpeg','-v','error','-y','-i',str(candidate),'-map','0:a:0','-c:a','libmp3lame','-b:a','192k',str(review)])
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
record={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'plan':str(planfile),'planHash':approved['approval']['plan_hash'],'candidate':str(candidate),'finalSha256':hashfile(candidate),'visualSha256':hashfile(visual),'audioMixSha256':hashfile(mix),'decodedWithoutErrors':True,'durationWithin180s':True,'decodedVideoFrames':4475,'sourceUiErrors':sum([s['errors'] for s in capture['scenes']],[]),'probe':final_probe,'audioReviewPath':str(review),'audioReviewSha256':hashfile(review),'audioDecodedPath':str(decoded),'audioDecodedSha256':hashfile(decoded),'method':'Lossless H264 video stream copy plus one AAC encode from the approved sample-accurate voice/music mix.'}
record['version']=version
if version.startswith('v3'):
    record['method']='Lossless H264 video stream copy plus unchanged encoded AAC stream copied from candidate v2. Only scene 13 timing differs; 17 clips remain unchanged.'
    record['perceptualReportPath']=str(WORK/f'reports/final-native-video-review-{version}.json')
    audio_streams=[]
    for name,file in [('v2',audio_input),(version,candidate)]:
        stream=WORK/f'audio/pitch/encoded-{name}.aac'
        run(['ffmpeg','-v','error','-y','-i',str(file),'-map','0:a:0','-c:a','copy','-f','adts',str(stream)])
        audio_streams.append({'version':name,'sha256':hashfile(stream),'bytes':stream.stat().st_size})
    assert audio_streams[0]['sha256']==audio_streams[1]['sha256']
    record['unchangedEncodedAac']={'verified':True,'method':'Compare SHA256 of ADTS AAC extracted by stream copy from v2 and v3. No re-encoding.','streams':audio_streams}
if version=='v3b':
    failed=WORK/'versions/pitch-v3-execution-01'
    failed.mkdir(parents=True,exist_ok=True)
    for file in [WORK/'reports/pitch-final-technical-qc.json',*list((ROOT/'artifacts').glob('*audio*.json')),*list((ROOT/'artifacts').glob('*video*.json')),ROOT/'artifacts/media-perceptual-review.json']:
        if not (failed/file.name).exists():shutil.copy2(file,failed/file.name)
    (failed/'rejection.json').write_text(json.dumps({'candidateSha256':'47469b7ebe57d81416cede74e5f70e5a113ef337334e8db318d23c33d43fefb6','status':'rejected','reason':'Direct frame inspection showed the attempted hold did not persist the filled form. Technical decode and model review alone were insufficient. Re-executed the same second-round correction with separately verified still and motion segments.','correctionRound':2},indent=2),encoding='utf-8')
(WORK/'reports/pitch-final-technical-qc.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
shutil.copy2(candidate,ROOT/'output/splot-demo.mp4')
transcript='# Splot dla HubMI\n\nDemo: https://agile-kiwi-698.eu-west-1.convex.site\n\nDEFOZO SOFTWARE HOUSE · Michał Kiełtyka\n\nRzeczywiste działania w aplikacji na danych demonstracyjnych. Polski lektor i cichy podkład instrumentalny.\n\n'
for segment in script['segments']:
    m,s=divmod(segment['start'],60)
    transcript+=f'## {m:02}:{s:02}\n\n{segment["text"]}\n\n'
(ROOT/'output/splot-demo-transcript.md').write_text(transcript,encoding='utf-8')
print(json.dumps({'candidate':str(candidate),'final':str(ROOT/'output/splot-demo.mp4'),'sha256':record['finalSha256'],'duration':final_probe['format']['duration']}))

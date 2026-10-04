"""Deterministic sample-accurate narration and original instrumental mix.

No cloud calls. Input assets are cached and traced by SHA-256.
"""
import datetime, hashlib, json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"output/_video_work"
DEST=WORK/"audio/pitch"
DEST.mkdir(parents=True,exist_ok=True)
SR=48000
DURATION=179
script=json.loads((WORK/"audio-script.json").read_text(encoding="utf-8"))
assets={a["id"]:a for a in json.loads((WORK/"manifests/pitch-audio-assets.json").read_text(encoding="utf-8"))}
voice=np.zeros((SR*DURATION,2),dtype=np.float64)
placements=[]
def run(args):
    result=subprocess.run(args,capture_output=True,text=True,encoding="utf-8",creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:raise RuntimeError(result.stderr)
    return result
for segment in script["segments"]:
    asset=assets[segment["id"]]
    path=Path(asset["assetPath"])
    assert hashlib.sha256(path.read_bytes()).hexdigest()==asset["audioSha256"]
    data,sr=sf.read(path,always_2d=True)
    assert sr==SR and data.shape[1]==2
    local_start=.5 if segment["id"]=="01-potrzeba" else .25
    start=round((segment["start"]+local_start)*SR)
    end=start+len(data)
    assert end<=round((segment["start"]+segment["duration"]-.1)*SR),segment["id"]
    # Millisecond fades avoid a boundary click without trimming an utterance.
    fade=min(240,len(data)//20)
    data[:fade]*=np.linspace(0,1,fade)[:,None]
    data[-fade:]*=np.linspace(1,0,fade)[:,None]
    voice[start:end]+=data
    placements.append({"id":segment["id"],"startSample":start,"endSample":end,"startSeconds":start/SR,"endSeconds":end/SR,"sceneStart":segment["start"],"sceneEnd":segment["start"]+segment["duration"],"source":str(path),"sourceSha256":asset["audioSha256"],"speed":1,"text":segment["text"]})
raw=DEST/"narration-timeline.wav"
sf.write(raw,voice,SR,subtype="PCM_24")
def normalize(source,target,lufs,peak):
    analysis=run(["ffmpeg","-hide_banner","-i",str(source),"-af",f"loudnorm=I={lufs}:TP={peak}:LRA=7:print_format=json","-f","null","-"])
    stats=json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rfind("{"):])[0]
    filter=f"loudnorm=I={lufs}:TP={peak}:LRA=7:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true"
    run(["ffmpeg","-v","error","-y","-i",str(source),"-af",filter,"-ar",str(SR),"-c:a","pcm_s24le",str(target)])
    return stats
narration=DEST/"narration-normalized.wav"
music=DEST/"music-quiet.wav"
voice_stats=normalize(raw,narration,-18,-2)
music_stats=normalize(DEST/"original-instrumental.wav",music,-28,-9)
mix=DEST/"final-mix.wav"
run(["ffmpeg","-v","error","-y","-i",str(narration),"-i",str(music),"-filter_complex","[0:a]asplit=2[voice][side];[1:a][side]sidechaincompress=threshold=0.018:ratio=3:attack=35:release=550:makeup=1[bed];[voice][bed]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.891:attack=5:release=60:level=false:latency=true[a]","-map","[a]","-ar",str(SR),"-t",str(DURATION),"-c:a","pcm_s24le",str(mix)])
run(["ffmpeg","-v","error","-y","-i",str(mix),"-c:a","libmp3lame","-b:a","192k",str(DEST/"final-mix-review.mp3")])
manifest={"createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"duration":DURATION,"sampleRate":SR,"narrationTargetLufs":-18,"musicTargetLufs":-28,"musicSidechainDuck":True,"limiterCeilingDbfs":-1,"narrationInputAnalysis":voice_stats,"musicInputAnalysis":music_stats,"musicProvenance":str(DEST/"music-provenance.json"),"placements":placements,"files":{name:{"path":str(path),"sha256":hashlib.sha256(path.read_bytes()).hexdigest()} for name,path in [("narration",narration),("music",music),("mix",mix)]},"authority":"User explicitly requested narration, quiet legal music and rendered-film listening in USER_REQUEST_PITCH_AUDIO_2026-10-03.md. All generation completed before render, no speaker imitation."}
(WORK/"manifests/pitch-audio-mix.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"mix":str(mix),"duration":DURATION,"narrationSegments":len(placements),"minimumTailSeconds":min(p["sceneEnd"]-p["endSeconds"] for p in placements)}))

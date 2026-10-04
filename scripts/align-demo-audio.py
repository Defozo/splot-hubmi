"""Align the reviewed narration to its actual mix and export Polish captions."""
import datetime, hashlib, json, os, re
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"output/_video_work"
audio=WORK/"audio/pitch/final-mix-review.mp3"
script=json.loads((WORK/"audio-script.json").read_text(encoding="utf-8"))
text=" ".join(s["text"] for s in script["segments"])
out=WORK/"reports/pitch-word-alignment.json"
fingerprint=hashlib.sha256(audio.read_bytes()).hexdigest()
if out.exists():
    record=json.loads(out.read_text(encoding="utf-8"))
    assert record["audioSha256"]==fingerprint
else:
    with audio.open("rb") as file:
        response=requests.post("https://api.elevenlabs.io/v1/forced-alignment",headers={"xi-api-key":os.environ["ELEVENLABS_API_KEY"]},files={"file":(audio.name,file,"audio/mpeg")},data={"text":text},timeout=180)
    if not response.ok:raise RuntimeError(f"Forced alignment HTTP {response.status_code}; response omitted")
    record={"createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"method":"ElevenLabs forced alignment of exact reviewed Polish script to actual final mix, not speech recognition or perceptual listening.","audioSha256":fingerprint,"script":text,"result":response.json()}
    out.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding="utf-8")
words=[word for word in record["result"]["words"] if word["text"].strip()]
cues=[]
batch=[]
def flush():
    if not batch:return
    cues.append({"start":batch[0]["start"],"end":batch[-1]["end"],"text":" ".join(w["text"] for w in batch)})
    batch.clear()
for word in words:
    if batch and (len(" ".join(w["text"] for w in [*batch,word]))>86 or word["start"]-batch[-1]["end"]>.6):flush()
    batch.append(word)
    if word["text"].endswith((".","?","!")):flush()
flush()
def stamp(seconds,sep):
    ms=round(seconds*1000);h=ms//3600000;m=ms//60000%60;s=ms//1000%60
    return f"{h:02}:{m:02}:{s:02}{sep}{ms%1000:03}"
for index,cue in enumerate(cues):
    cue["end"]=min(cue["end"]+.18,cues[index+1]["start"]-.01 if index+1<len(cues) else 179)
    assert 0<=cue["start"]<cue["end"]<=179
    # Preserve words while wrapping caption lines to a readable length.
    pieces=cue["text"].split();lines=[];line=""
    for word in pieces:
        if len((line+" "+word).strip())>46 and line:lines.append(line);line=""
        line=(line+" "+word).strip()
    if line:lines.append(line)
    cue["text"]="\n".join(lines)
for extension,separator in [("srt",","),("vtt",".")]:
    rendered=("WEBVTT\n\n" if extension=="vtt" else "")+"\n\n".join(f"{i+1}\n{stamp(c['start'],separator)} --> {stamp(c['end'],separator)}\n{c['text']}" for i,c in enumerate(cues))+"\n"
    (ROOT/f"output/splot-demo.{extension}").write_text(rendered,encoding="utf-8")
(WORK/"reports/pitch-subtitle-check.json").write_text(json.dumps({"cueCount":len(cues),"wordCount":len(words),"firstCue":cues[0],"lastCue":cues[-1],"allBoundsWithinFilm":True,"language":"pl","alignment":str(out)},ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"cues":len(cues),"words":len(words),"lastEnd":cues[-1]["end"]}))

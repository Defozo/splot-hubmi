"""Original deterministic instrumental bed. No samples, recordings or third-party tunes.

The score, oscillator synthesis, note sequence and render are project-created assets.
"""
import datetime, hashlib, json
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"output/_video_work/audio/pitch"
DEST.mkdir(parents=True,exist_ok=True)
SR=48000
DURATION=179
COUNT=SR*DURATION
music=np.zeros((COUNT,2),dtype=np.float64)
rng=np.random.default_rng(20261003)
beat=60/104
chords=[[50,57,60,64],[46,53,57,60],[41,53,57,64],[48,55,62,64]]

def add(note,start,duration,amp,pan=0.0,kind="pluck"):
    first=round(start*SR)
    length=min(round(duration*SR),COUNT-first)
    if length<=0:return
    t=np.arange(length)/SR
    frequency=440*2**((note-69)/12)
    if kind=="pad":
        wave=np.sin(2*np.pi*frequency*t)+0.22*np.sin(2*np.pi*frequency*2*t)+0.1*np.sin(2*np.pi*frequency*.998*t)
        envelope=np.minimum(t/.3,1)*np.minimum(np.maximum(duration-t,0)/.65,1)
    elif kind=="bass":
        wave=np.sin(2*np.pi*frequency*t)+.13*np.sin(2*np.pi*frequency*2*t)
        envelope=(1-np.exp(-t*50))*np.exp(-t*1.5)*np.minimum(np.maximum(duration-t,0)/.1,1)
    else:
        wave=np.sin(2*np.pi*frequency*t)+.24*np.sin(2*np.pi*frequency*2*t)*np.exp(-t*2)+.06*np.sin(2*np.pi*frequency*3*t)*np.exp(-t*4)
        envelope=(1-np.exp(-t*300))*np.exp(-t*2.8)*np.minimum(np.maximum(duration-t,0)/.1,1)
    value=wave*envelope*amp
    stereo=np.stack([value*np.sqrt((1-pan)/2),value*np.sqrt((1+pan)/2)],axis=1)
    music[first:first+length]+=stereo
    if kind=="pluck":
        delay=round(beat*.75*SR)
        end=min(first+delay+length,COUNT)
        if end>first+delay:music[first+delay:end]+=.16*stereo[:end-first-delay,::-1]

bar=0
while bar*4*beat<172:
    start=bar*4*beat
    chord=chords[(bar//2)%len(chords)]
    dynamics=.8+.15*np.sin(bar*.33)
    for i,note in enumerate(chord):add(note+12,start,4*beat+.8,.024*dynamics,(i-1.5)*.3,"pad")
    add(chord[0]-12,start,3.9*beat,.075*dynamics,0,"bass")
    if bar%2:add(chord[0]-12,start+2*beat,1.8*beat,.055*dynamics,0,"bass")
    pattern=[0,2,1,3,2,1,3,2] if bar%4<2 else [0,1,3,2,1,2,3,1]
    for i,index in enumerate(pattern):
        if bar%8==7 and i>4:continue
        add(chord[index]+12+(12 if i in [3,7] else 0),start+i*beat/2,1.9,.053*dynamics*rng.uniform(.8,1),(-1 if i%2 else 1)*.4)
    if 4<=bar<=69:
        for i in range(8):
            at=round((start+i*beat/2)*SR)
            n=min(round(.075*SR),COUNT-at)
            if n>0:
                noise=rng.normal(size=n)
                noise=sosfilt(butter(2,4800,btype="highpass",fs=SR,output="sos"),noise)
                noise*=np.exp(-np.arange(n)/SR*55)*(.009 if i%2 else .014)
                music[at:at+n]+=noise[:,None]
    bar+=1
# Resolve the closing chord with enough natural tail before the final fade.
for note in [50,57,62,65]:add(note,172,6.3,.03,0,"pad")
envelope=np.minimum(np.arange(COUNT)/SR/2.5,1)*np.minimum((DURATION-np.arange(COUNT)/SR)/3.5,1)
music*=envelope[:,None]
music/=max(1,np.max(np.abs(music))/.65)
path=DEST/"original-instrumental.wav"
sf.write(path,music,SR,subtype="PCM_24")
manifest={"createdAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"path":str(path),"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"duration":DURATION,"sampleRate":SR,"channels":2,"title":"Splot: spotkania","origin":"Original project composition and deterministic oscillator synthesis by this script; no external recordings, samples, stock audio, borrowed melodies or artist imitations.","license":"Project-created asset supplied for unrestricted use with the Splot project; no third-party attribution requirement.","score":{"tempoBpm":104,"seed":20261003,"chordsMidi":chords,"instruments":["warm harmonic pad","plucked keys","sine bass","soft synthesized shaker"]},"scriptSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(DEST/"music-provenance.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"music":str(path),"duration":DURATION,"peak":float(np.max(np.abs(music)))}))

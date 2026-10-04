"""Bounded authorized generation, cached by the installed skill. No automatic API retry."""
import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/"output/_video_work"
script=json.loads((WORK/"audio-script.json").read_text(encoding="utf-8"))
tool=Path("C:/Users/defoz/.agents/skills/reusable-video-editing/scripts/video_tool.py")
assets=[]
for segment in script["segments"]:
    if segment["id"]=="01-potrzeba":
        record=json.loads((WORK/"assets/elevenlabs/pitch-voice-audition-v4-76dffea09e3669a5/manifest.json").read_text(encoding="utf-8"))
    else:
        result=subprocess.run([sys.executable,str(tool),"elevenlabs-generate",str(WORK/"project.yaml"),segment["request"],"--execute"],capture_output=True,text=True,encoding="utf-8",creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            print(result.stderr)
            raise RuntimeError("Voice generation failed; do not retry an ambiguous request automatically.")
        record=json.loads(result.stdout)
    assets.append({**segment,"assetPath":record["asset_path"],"manifestPath":record["manifest_path"],"durationSeconds":record["asset"]["duration_seconds"],"audioSha256":record["asset"]["sha256"]})
    (WORK/"manifests/pitch-audio-assets.json").write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f'{segment["id"]}: {record["asset"]["duration_seconds"]:.2f}s / {segment["duration"]}s',flush=True)

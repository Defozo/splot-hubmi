"""Secondary ASR check, kept separate from actual perceptual audio review."""
import datetime, hashlib, json, os, sys
from pathlib import Path
import requests

source, output = map(Path, sys.argv[1:3])
if output.exists():
    raise RuntimeError("Keep prior ASR evidence; choose a new path.")
with source.open("rb") as stream:
    response = requests.post("https://api.groq.com/openai/v1/audio/transcriptions", headers={"Authorization": "Bearer " + os.environ["GROQ_API_KEY"]}, files={"file": (source.name, stream)}, data={"model": "whisper-large-v3", "language": "pl", "response_format": "verbose_json", "timestamp_granularities[]": ["word", "segment"], "temperature": "0"}, timeout=180)
if not response.ok:
    raise RuntimeError(f"ASR HTTP {response.status_code}; response omitted")
record = {"createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "model": "whisper-large-v3", "source": str(source.resolve()), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "method": "ASR consistency and word timing check, not an auditory intelligibility or mixing judgment.", "result": response.json()}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"path": str(output), "text": record["result"].get("text")}, ensure_ascii=False))

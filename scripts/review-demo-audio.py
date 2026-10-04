"""Perceptual review of actual audio bytes, not a transcript or stream-presence check.

Usage: psst OPENAI_API_KEY -- python scripts/review-demo-audio.py AUDIO OUTPUT.json
Only the chosen generated public-demo soundtrack is uploaded. No source user recordings.
"""
import base64
import datetime
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

source, output = map(Path, sys.argv[1:3])
data = source.read_bytes()
request = {
    "model": "gpt-audio-1.5", "modalities": ["text"], "store": False,
    "messages": [{"role": "user", "content": [
        {"type": "text", "text": "Listen to the complete supplied audio. This is Polish narration for a software demo pitch. Assess what is actually audible, not what a transcript or technical signal would imply. Return JSON with: coverage_seconds, language, audible_speech_transcript, perceived_voice_character, speech_intelligibility, pronunciation_issues (exact words and timestamps or empty), pace, music_audible, music_character, music_vs_voice_balance, clipping_or_artifacts, beginning, ending (last audible words and whether cut off), actionable_findings (timestamps, concrete minimal correction), overall_pass. Do not invent problems. If no music is audible say so. Do not assume the expected script. Distinguish observations from uncertainty. JSON only."},
        {"type": "input_audio", "input_audio": {"data": base64.b64encode(data).decode(), "format": source.suffix.lstrip(".")}},
    ]}], "max_completion_tokens": 6000,
}
fingerprint = hashlib.sha256(data).hexdigest()
if output.exists():
    previous = json.loads(output.read_text(encoding="utf-8"))
    if previous.get("audioSha256") == fingerprint and previous.get("status") == "complete":
        print(json.dumps({"status": "reused", "path": str(output)}))
        sys.exit(0)
    raise RuntimeError("Existing review differs or is incomplete. Preserve it and choose a new output name.")
output.parent.mkdir(parents=True, exist_ok=True)
record = {"status": "started", "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "method": "Actual encoded audio supplied to an audio-capable model for perceptual listening. No transcript supplied.", "model": request["model"], "audio": str(source.resolve()), "audioSha256": fingerprint, "uploadedBytes": len(data)}
output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=json.dumps(request).encode(), headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"], "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=180) as response:
        result = json.load(response)
except urllib.error.HTTPError as error:
    record.update(status="failed", httpStatus=error.code)
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    raise RuntimeError(f"Audio review HTTP {error.code}; response omitted") from None
record.update(status="complete", completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), responseId=result.get("id"), actualModel=result.get("model"), usage=result.get("usage"), review=result["choices"][0]["message"]["content"])
output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"status": record["status"], "path": str(output), "review": record["review"]}, ensure_ascii=False))

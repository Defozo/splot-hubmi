"""Render deterministic Polish caption rails. Input is a capture manifest.

The rail is outside the recorded application viewport. No application content
or state is synthesized. Pillow is used because local FFmpeg lacks libass.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
destination = Path(sys.argv[2])
destination.mkdir(parents=True, exist_ok=True)
font_path = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("C:/Windows/Fonts/segoeui.ttf")
font = ImageFont.truetype(str(font_path), 29)
small = ImageFont.truetype(str(font_path), 17)
for index, scene in enumerate(manifest["scenes"]):
    rail = Image.new("RGB", (1920, 108), "#133f38")
    draw = ImageDraw.Draw(rail)
    width = 1824
    lines = []
    for paragraph in scene["caption"].splitlines():
        line = ""
        for word in paragraph.split():
            candidate = f"{line} {word}".strip()
            if draw.textlength(candidate, font=font) > width and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
    if len(lines) > 2:
        raise RuntimeError(f"Caption {scene['id']} needs {len(lines)} lines")
    draw.rectangle((0, 0, round(1920 * (index + 1) / len(manifest["scenes"])), 3), fill="#b4d9c8")
    draw.text((48, 9), f"SPLOT / HUBMI    {index + 1:02d} / {len(manifest['scenes']):02d}", fill="#d0e6dd", font=small)
    draw.text((48, 31 if len(lines) == 2 else 43), "\n".join(lines), fill="white", font=font, spacing=1)
    rail.save(destination / f"{scene['id']}.png")
print(json.dumps({"captionRails": len(manifest["scenes"]), "font": str(font_path), "size": [1920, 108]}, ensure_ascii=False))

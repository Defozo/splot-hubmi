"""Build review sheets only from decoded final output frames."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

work = Path('output/_video_work')
frames = sorted((work / 'frames').glob('*.jpg'))
font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 16)
sheet = Image.new('RGB', (1440, ((len(frames) + 2) // 3) * 294), '#f5f5f0')
draw = ImageDraw.Draw(sheet)
for i, frame in enumerate(frames):
    x, y = (i % 3) * 480, (i // 3) * 294
    image = Image.open(frame).convert('RGB')
    image.thumbnail((480, 270), Image.Resampling.LANCZOS)
    sheet.paste(image, (x, y))
    draw.text((x + 8, y + 273), frame.stem, fill='#173f35', font=font)
sheet.save(work / 'reports' / 'contact-sheet.jpg', quality=93)
print(work / 'reports' / 'contact-sheet.jpg')

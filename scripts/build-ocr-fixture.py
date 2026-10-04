"""Deterministic image-only PDF. No personal data or third-party source content."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

out=Path('artifacts/fixtures')
out.mkdir(parents=True, exist_ok=True)
lines=[
 'SPLOT: SYNTETYCZNY DOKUMENT OCR',
 'Materiał demonstracyjny, autor: DEFOZO SOFTWARE HOUSE.',
 'Nie jest raportem ROPS ani dowodem skuteczności społecznej.',
 '',
 'Potrzeba: samotni mieszkańcy chcą regularnego kontaktu.',
 'Proponowane działanie: cotygodniowe spotkania sąsiedzkie.',
 'Koordynator uzgadnia salę dostępną dla osób na wózkach.',
 'Udział w spotkaniach wymaga dobrowolnej zgody uczestnika.',
 'Koszty pozostają niewiadome do uzyskania lokalnych wycen.',
 '',
 'Miernik demonstracyjny: liczba spotkań i opinia przed i po.',
 'Próba kontrolna: 12 uczestników, 4 spotkania, rok 2026.',
 'Polskie znaki: ą ć ę ł ń ó ś ź ż.',
 'Prawa: własny materiał demonstracyjny CC BY 4.0.',
]
image=Image.new('RGB',(1800,1400),'white')
draw=ImageDraw.Draw(image)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',36)
for index,line in enumerate(lines):draw.text((70,75+index*78),line,font=font,fill='black')
image.save(out/'ocr-scan.png')
image.save(out/'ocr-scan.pdf','PDF',resolution=144)
(out/'ocr-expected.txt').write_text('\n'.join(lines),encoding='utf-8')
print('Created one-page image-only synthetic OCR fixture.')

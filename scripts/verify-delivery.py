from pathlib import Path
import datetime, hashlib, json, re, subprocess, zipfile
import xml.etree.ElementTree as ET

root=Path(__file__).resolve().parents[1]
def read(name): return json.loads((root/name).read_text('utf-8-sig'))
def sha(name): return hashlib.sha256((root/name).read_bytes()).hexdigest()
team=read('TEAM.json')
pdf=root/'output/pdf/splot-hubmi.pdf'
poppler=Path('C:/Program Files/poppler/Library/bin/pdftotext.exe')
pdf_text=subprocess.check_output([str(poppler) if poppler.exists() else 'pdftotext',str(pdf),'-'],encoding='utf-8')
pages=[page for page in pdf_text.split('\f') if page.strip()]
assert 1 <= len(pages) <= 10
normalized=' '.join(pdf_text.split())
assert team['team_name'] in normalized and team['members'][0] in normalized
notes=[];shape_counts=[]
with zipfile.ZipFile(root/'output/splot-hubmi.pptx') as archive:
    slides=sorted(name for name in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',name))
    note_files=sorted(name for name in archive.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',name))
    assert len(slides)==len(note_files)==len(pages)
    ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main','p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
    all_text=[]
    for name in slides:
        xml=ET.fromstring(archive.read(name));shape_counts.append(len(xml.findall('.//p:sp',ns)))
        all_text.extend(node.text or '' for node in xml.findall('.//a:t',ns))
    for name in note_files:
        xml=ET.fromstring(archive.read(name));notes.append(' '.join(node.text or '' for node in xml.findall('.//a:t',ns)))
    assert all(count>=4 for count in shape_counts) and all(len(note)>150 for note in notes)
    assert team['team_name'] in ' '.join(all_text) and team['members'][0] in ' '.join(all_text)
receipt=read('artifacts/presentation-verification.json');video=read('artifacts/demo-video-verification.json')
audio=read('artifacts/audio-verification.json')
visual=read('artifacts/pitch-visual-review.json')
assert sha('output/splot-hubmi.pptx')==receipt['finalSha256']
assert sha('output/splot-demo.mp4')==video['finalSha256']
assert video['durationWithin180s'] and video['decodedWithoutErrors']
assert audio['finalSha256']==video['finalSha256'] and audio['audioPresent']
assert audio['status']=='passed' and audio['technical']['decodedWithoutErrors']
assert audio['perceptual']['coverage'], 'Actual audio-input review coverage is required'
streams=video['probe']['streams']
assert any(stream['codec_type']=='audio' for stream in streams)
duration=float(video['probe']['format']['duration'])
assert 0 < duration <= 180
assert visual['pdfSha256']==sha('output/pdf/splot-hubmi.pdf')
assert visual['pptxSha256']==sha('output/splot-hubmi.pptx')
assert visual['pagesReviewed']==visual['slidesReviewed']==len(pages)
assert visual['status']=='passed'
cut=read('artifacts/final-cut-review.json')
assert cut['candidateSha256']==video['finalSha256']
assert not cut['blockingFindings'], 'Resolve material final-cut findings before delivery'
report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'team':team,'pdf':{'pages':len(pages),'selectablePolishText':True,'sha256':sha('output/pdf/splot-hubmi.pdf'),'visualReview':'See artifacts/pitch-visual-review.json for reviewed renders of this exact candidate. This is not PDF/UA certification.'},'pptx':{'slides':len(slides),'speakerNotes':len(notes),'nativeTextShapesPerSlide':shape_counts,'sha256':sha('output/splot-hubmi.pptx'),'visualReview':'All final renders reviewed; structural and layout checks recorded separately. Native Microsoft PowerPoint execution was not tested.'},'mp4':{'durationSeconds':duration,'sha256':sha('output/splot-demo.mp4'),'audioPresent':True,'audioVerification':'artifacts/audio-verification.json','visualReview':'See artifacts/demo-video-verification.json and the independent final-cut review for exact coverage.'}}
report['mp4']['independentReview']='artifacts/final-cut-review.json'
(root/'artifacts/delivery-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

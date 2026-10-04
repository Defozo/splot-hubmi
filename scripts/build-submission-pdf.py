import json, os
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

# Selectable text PDF shares the content and geometry of the native PPTX.
data = json.load(open('.local/presentation/slides.json', encoding='utf-8'))
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf'))
pdf_path=os.environ.get('SUBMISSION_PDF_OUTPUT','output/pdf/splot-hubmi.pdf')
os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
c = canvas.Canvas(pdf_path, pagesize=(1280, 720))
c.setTitle('Splot dla HubMI - DEFOZO SOFTWARE HOUSE')
c.setAuthor('Michał Kiełtyka')

def text(definition):
    value, x, top, width = (definition[key] for key in ('value','x','y','w'))
    size=definition.get('size',28)
    font='Arial-Bold' if definition.get('bold') else 'Arial'
    c.setFont(font,size)
    c.setFillColor(definition.get('color',data['colors']['ink']))
    y=720-top-size
    for paragraph in value.split('\n'):
        line=''
        for word in paragraph.split():
            possible=(line+' '+word).strip()
            if line and pdfmetrics.stringWidth(possible,font,size)>width:
                c.drawString(x,y,line)
                y-=size*1.22
                line=word
            else:
                line=possible
        c.drawString(x,y,line)
        y-=size*1.22

for i,slide in enumerate(data['slides']):
    c.setFillColor(data['colors']['background'])
    c.rect(0,0,1280,720,fill=1,stroke=0)
    for definition in slide['texts']:
        text(definition)
    for image_data in slide['images']:
        image=Image.open('artifacts/screenshots/'+image_data['name']+'.png')
        iw,ih=image.size
        factor=min(image_data['w']/iw,image_data['h']/ih)
        w,h=iw*factor,ih*factor
        c.drawImage(ImageReader(image),image_data['x']+(image_data['w']-w)/2,720-image_data['y']-(image_data['h']-h)/2-h,w,h)
    footer='Demo: agile-kiwi-698.eu-west-1.convex.site' if i in [0,9] else 'Splot dla HubMI. Scenariusz demonstracyjny.'
    text({'value':footer,'x':66,'y':668,'w':1090,'size':16,'color':data['colors']['muted']})
    text({'value':f'{i+1}/10','x':1170,'y':668,'w':64,'size':16,'color':data['colors']['muted']})
    if i in [0,9]:
        c.linkURL(data['demo'],(66,24,650,62),relative=0,thickness=0)
    c.showPage()
c.save()
print(pdf_path+': 10 pages')

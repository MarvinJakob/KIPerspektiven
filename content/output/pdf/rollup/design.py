"""850 x 2000 mm roll-up: vector typography and QR, process CMYK only.

Coordinate helpers use millimetres from the top. No assumed printer-specific
bleed or cassette extension is added; the lower 150 mm carry no information.
"""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import CMYKColor
from reportlab.graphics.barcode import qrencoder
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parent
MM = 72 / 25.4
W, H = 850, 2000
URL = 'https://marvinjakob.de/de/themen/ai-audit'
OUT = ROOT / 'rollup-85x200cm-cmyk.pdf'

# Process inks only. QR uses 100% K to avoid registration fringes.
# These unprofiled CMYK definitions retain the existing navy/orange identity;
# final media-specific color management belongs to the printer's RIP.
NAVY = CMYKColor(.69, .34, 0, .77)
PAPER = CMYKColor(0, .016, .036, .012)
ORANGE = CMYKColor(0, .50, .91, .14)
ORANGE_INK = CMYKColor(0, .548, .952, .349)
ORANGE_LIGHT = CMYKColor(0, .362, .646, .047)
BLACK = CMYKColor(0, 0, 0, 1)
WHITE = CMYKColor(0, 0, 0, 0)

pdfmetrics.registerFont(TTFont('Segoe', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold', 'C:/Windows/Fonts/segoeuib.ttf'))


def build():
    raw = ROOT / '_rollup.pdf'
    c = canvas.Canvas(str(raw), pagesize=(W*MM,H*MM), pageCompression=1,
                      enforceColorSpace='CMYK', pdfVersion=(1,4),
                      initialFontName='Segoe')
    c.setTitle('KI Readiness | Marvin Jakob | Roll-up 85 x 200 cm')
    c.setAuthor('Marvin Jakob')
    c.setSubject('KI-Readiness-Selbsteinschätzung; CMYK; 850 x 2000 mm; '+URL)

    def rect(x,y,w,h,color):
        c.setFillColor(color)
        c.rect(x*MM,(H-y-h)*MM,w*MM,h*MM,stroke=0,fill=1)

    def text(x,y,label,size,color=NAVY,bold=False):
        font='SegoeBold' if bold else 'Segoe'
        tw=pdfmetrics.stringWidth(label,font,size)/MM
        assert 50 <= x and x+tw <= W-50, (label,x,tw)
        assert 50 < y < 1850, (label,y)
        c.setFillColor(color)
        c.setFont(font,size)
        c.drawString(x*MM,(H-y)*MM,label)

    def link(x,y,w,h,target):
        c.linkURL(target,(x*MM,(H-y-h)*MM,(x+w)*MM,(H-y)*MM),thickness=0)

    def dot(x,y,color):
        c.setFillColor(color)
        c.circle(x*MM,(H-y)*MM,2.3*MM,stroke=0,fill=1)

    rect(0,0,W,H,PAPER)
    text(65,80,'marvinjakob.de',48,bold=True)
    rect(65,108,62,3,ORANGE)
    text(65,160,'KI-READINESS / SELBSTEINSCHÄTZUNG',33,bold=True)

    text(65,263,'Wie bereit ist',236,bold=True)
    text(65,358,'Ihr Unternehmen',236,bold=True)
    text(65,453,'für KI?',236,color=ORANGE_INK,bold=True)
    text(65,522,'Standort bestimmen. Potenziale erkennen.',46)
    text(65,550,'Die nächsten Schritte für Ihr Unternehmen ableiten.',46)

    rect(65,587,720,.7,ORANGE)
    text(65,646,'8 Dimensionen. Ein klarer Blick.',66,bold=True)
    dimensions=[
        (65,704,'Strategie und Wirtschaftlichkeit'),
        (65,756,'Ressourcenplanung und Kompetenzen'),
        (65,808,'Betrieb'),
        (65,860,'Governance und Compliance'),
        (445,704,'Agenten und Prozesse'),
        (445,756,'Technologie und Infrastruktur'),
        (445,808,'Daten und Wissen'),
        (445,860,'Sicherheit und Zuverlässigkeit'),
    ]
    for x,y,label in dimensions:
        dot(x+2.3,y-4,ORANGE)
        text(x+15,y,label,36)

    text(65,977,'Jetzt selbst einschätzen.',104,bold=True)
    text(65,1012,'QR-Code scannen und online starten.',36)

    # Four modules of clear paper around all sides; no extra QR frame.
    qr=qrencoder.QRCode(None,qrencoder.QRErrorCorrectLevel.Q)
    qr.addData(URL)
    qr.make()
    n=qr.getModuleCount()
    x,y,side,quiet=65,1040,230,4
    unit=side/(n+quiet*2)
    for row in range(n):
        col=0
        while col<n:
            if not qr.isDark(row,col):
                col+=1
                continue
            start=col
            while col<n and qr.isDark(row,col):
                col+=1
            rect(x+(quiet+start)*unit,y+(quiet+row)*unit,(col-start)*unit,unit,BLACK)
    link(x,y,side,side,URL)

    text(355,1090,'Ihr Ergebnis:',66,bold=True)
    for yy,label in [(1154,'Reifegrad je Bereich'),(1203,'Lücken und Potenziale'),
                     (1252,'Konkrete nächste Schritte')]:
        rect(355,yy-6,10,2,ORANGE)
        text(380,yy,label,40)
    text(65,1323,'marvinjakob.de',52,bold=True)
    text(65,1351,'/de/themen/ai-audit',32)
    link(65,1295,350,65,URL)

    rect(0,1420,W,H-1420,NAVY)
    text(65,1522,'KI verstehen.',120,color=PAPER,bold=True)
    text(65,1580,'Sinnvoll einsetzen.',120,color=ORANGE_LIGHT,bold=True)
    rect(65,1631,62,3,ORANGE)
    text(65,1715,'Marvin Jakob',62,color=PAPER,bold=True)
    text(65,1752,'Creative IT Specialist',36,color=ORANGE_LIGHT,bold=True)
    text(65,1816,'mail@marvinjakob.de',38,color=PAPER)
    link(65,1798,300,24,'mailto:mail@marvinjakob.de')
    # 1840..2000 mm intentionally remain free of essential information.
    c.showPage()
    c.save()

    reader=PdfReader(raw)
    writer=PdfWriter()
    page=reader.pages[0]
    page.trimbox=RectangleObject([0,0,W*MM,H*MM])
    page.bleedbox=RectangleObject([0,0,W*MM,H*MM])
    writer.add_page(page)
    writer.add_metadata(reader.metadata)
    with OUT.open('wb') as stream:
        writer.write(stream)
    raw.unlink()
    print(OUT)


if __name__=='__main__':
    build()

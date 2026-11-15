"""Vector business card master. Run with bundled Python + reportlab/pypdf/Pillow."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode import qrencoder
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parent
MM = 72 / 25.4
WIDTH, HEIGHT = 85, 55
URL = 'https://marvinjakob.de'
NAVY, ORANGE, WARM = '#12263a', '#dc6e14', '#fcf8f3'
# Website light theme: .display span -> --accent -> --brand-ink.
HEADLINE_ACCENT = '#a64b08'
pdfmetrics.registerFont(TTFont('Segoe', 'C:/Windows/Fonts/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('SegoeBold', 'C:/Windows/Fonts/segoeuib.ttf'))

qr = qrencoder.QRCode(None, qrencoder.QRErrorCorrectLevel.Q)
qr.addData(URL)
qr.make()


class Surface:
    """One layout definition writes PDF and an editable SVG in millimetres."""
    def __init__(self, pdf, bleed=0):
        self.pdf, self.bleed = pdf, bleed
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="85mm" height="55mm" viewBox="0 0 85 55">',
                    '<title>Marvin Jakob – Visitenkarte</title>']

    def rect(self, x, y, w, h, color):
        self.pdf.setFillColor(HexColor(color))
        self.pdf.rect((x+self.bleed)*MM, (HEIGHT+self.bleed-y-h)*MM, w*MM, h*MM, stroke=0, fill=1)
        self.svg.append(f'<rect x="{x:.5f}" y="{y:.5f}" width="{w:.5f}" height="{h:.5f}" fill="{color}"/>')

    def text(self, x, y, label, size, color=NAVY, bold=False, center=False):
        font = 'SegoeBold' if bold else 'Segoe'
        textwidth = pdfmetrics.stringWidth(label, font, size)/MM
        if center:
            x -= textwidth/2
        assert x >= 5 and x + textwidth <= 80.01, (label, x, textwidth)
        self.pdf.setFont(font, size)
        self.pdf.setFillColor(HexColor(color))
        self.pdf.drawString((x+self.bleed)*MM, (HEIGHT+self.bleed-y)*MM, label)
        self.svg.append(f'<text x="{x:.5f}" y="{y}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="{size/MM:.5f}" font-weight="{700 if bold else 400}" fill="{color}">{escape(label)}</text>')

    def link(self, x, y, w, h, target):
        self.pdf.linkURL(target, ((x+self.bleed)*MM, (HEIGHT+self.bleed-y-h)*MM,
                                 (x+w+self.bleed)*MM, (HEIGHT+self.bleed-y)*MM), relative=0, thickness=0)

    def background(self, color):
        b = self.bleed
        self.rect(-b, -b, WIDTH+2*b, HEIGHT+2*b, color)

    def qrcode(self, x=57, y=23, size=23):
        # Keep four empty modules on every edge in the card background color.
        quiet = 4
        n = qr.getModuleCount()
        unit = size/(n+2*quiet)
        self.rect(x,y,size,size,WARM)
        for row in range(n):
            # Merge adjacent modules into vector runs to avoid antialiasing seams.
            col = 0
            while col < n:
                if not qr.isDark(row,col):
                    col += 1
                    continue
                start = col
                while col < n and qr.isDark(row,col):
                    col += 1
                self.rect(x+(quiet+start)*unit, y+(quiet+row)*unit, (col-start)*unit, unit, '#000000')
        self.link(x,y,size,size,URL)

    def finish_svg(self, name):
        (ROOT/name).write_text('\n'.join(self.svg+['</svg>']), encoding='utf-8')


def front(s):
    s.background(WARM)
    s.text(6,12.2,'KI verstehen.',16.5,bold=True)
    s.text(6,19.7,'Sinnvoll einsetzen.',16.5,color=HEADLINE_ACCENT,bold=True)
    s.rect(6,23.3,8,0.8,ORANGE)
    s.text(6,31.2,'Praxiswissen für den',7.4)
    s.text(6,34.8,'professionellen Einsatz von KI.',7.4)
    s.text(6,41.2,'Mit klarem Blick auf Nutzen,',7.4)
    s.text(6,44.8,'Grenzen und Verantwortung.',7.4)
    s.qrcode()
    s.text(68.5,49.8,'marvinjakob.de',7.1,bold=True,center=True)
    s.link(56,47,24,4,URL)


def back(s):
    s.background(NAVY)
    s.rect(6,8,8,0.8,ORANGE)
    s.text(6,25,'Marvin Jakob',22,color=WARM,bold=True)
    s.text(6,31.5,'Creative IT Specialist',9.5,color='#f39b56',bold=True)
    s.text(6,46.5,'mail@marvinjakob.de',9,color=WARM)
    s.link(6,42.5,40,5,'mailto:mail@marvinjakob.de')


def create_pdf(filename, bleed):
    raw = ROOT / ('_'+filename)
    c = canvas.Canvas(str(raw),pagesize=((WIDTH+2*bleed)*MM,(HEIGHT+2*bleed)*MM),pageCompression=1)
    c.setTitle('Marvin Jakob | Visitenkarte | 85 × 55 mm')
    c.setAuthor('Marvin Jakob')
    c.setSubject('Vorderseite und Rückseite; QR-Code: '+URL)
    for draw, name in [(front,'vorderseite.svg'),(back,'rueckseite.svg')]:
        s = Surface(c,bleed)
        draw(s)
        if not bleed:
            s.finish_svg(name)
        c.showPage()
    c.save()
    reader, writer = PdfReader(raw), PdfWriter()
    for page in reader.pages:
        page.trimbox = RectangleObject([bleed*MM,bleed*MM,(bleed+WIDTH)*MM,(bleed+HEIGHT)*MM])
        page.bleedbox = RectangleObject([0,0,(WIDTH+2*bleed)*MM,(HEIGHT+2*bleed)*MM])
        writer.add_page(page)
    writer.add_metadata(reader.metadata)
    with (ROOT/filename).open('wb') as f:
        writer.write(f)
    raw.unlink()


if __name__ == '__main__':
    create_pdf('visitenkarte-85x55.pdf',0)
    create_pdf('visitenkarte-87x57mm-1mm-druckzugabe.pdf',1)
    create_pdf('visitenkarte-druck-3mm-beschnitt.pdf',3)
    print('Created three two-page vector PDFs and editable SVG masters.')

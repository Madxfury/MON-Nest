"""Render the README's finite booking animation. Requires Python 3 and Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'docs/media'
W, H, SCALE = 1200, 480, 2
BG, GRID, PAPER, MUTED = '#17131f', '#24202e', '#fbfaf8', '#b9b2c5'
PURPLE, LIME, BORDER = '#a98aff', '#d8ff5f', '#443b54'

def font(name, size):
    files = {'brand': ROOT / 'src/app/fonts/SpaceGrotesk-Bold.ttf',
             'body': ROOT / 'public/fonts/dm-sans.ttf',
             'serif': ROOT / 'public/fonts/newsreader-italic.ttf'}
    return ImageFont.truetype(str(files[name]), size * SCALE)

FONTS = {k: font(n, s) for k, n, s in [('brand', 'brand', 26), ('title', 'brand', 68),
          ('italic', 'serif', 76), ('body', 'body', 18), ('small', 'body', 13),
          ('label', 'brand', 17), ('stat', 'brand', 32)]}
LOGO = Image.open(ROOT / 'public/brand/mon-nest-logo.png').convert('RGBA')
LOGO = LOGO.resize((220*SCALE, 220*SCALE), Image.Resampling.LANCZOS)

def render(progress):
    im = Image.new('RGB', (W*SCALE, H*SCALE), BG)
    d = ImageDraw.Draw(im)
    def line(points, fill, width=1):
        d.line([(int(x*SCALE), int(y*SCALE)) for x,y in points], fill=fill, width=width*SCALE)
    def box(coords, fill, outline=None, radius=18, width=1):
        d.rounded_rectangle(tuple(int(v*SCALE) for v in coords), radius=radius*SCALE,
                            fill=fill, outline=outline, width=width*SCALE)
    def text(pos, value, key='body', color=PAPER):
        d.text((pos[0]*SCALE,pos[1]*SCALE), value, font=FONTS[key], fill=color)
    def circle(x,y,r,color):
        d.ellipse(((x-r)*SCALE,(y-r)*SCALE,(x+r)*SCALE,(y+r)*SCALE), fill=color)
    for x in range(0,W,48): line([(x,0),(x,H)],GRID)
    for y in range(0,H,48): line([(0,y),(W,y)],GRID)
    # Center the supplied brand asset between the headline and catalog statistics.
    im.paste(LOGO, (600*SCALE, 76*SCALE), LOGO)
    text((50,28),'MON', 'brand'); text((116,28),'—', 'brand', PURPLE); text((150,28),'Nest','brand',PURPLE)
    text((838,36),'RENTAL RAILS / MONAD TESTNET','small',MUTED)
    text((48,92),'Rent without','title')
    text((48,168),'the trust gap.','italic',PURPLE)
    text((52,262),'A familiar experience. A shared onchain answer.','body',MUTED)
    for x,number,label in [(830,'58','ILLUSTRATIVE HOMES'),(1020,'8','CITIES')]:
        text((x,130),number,'stat'); text((x,178),label,'small',MUTED)
    circle(838,229,5,LIME); text((854,219),'DISCOVER · SIGN · VERIFY','small',LIME)
    xs = [50,330,610,890]
    labels = ['DISCOVER','CONNECT','CONFIRM','VERIFY']
    details = ['Choose your nest','Passkey or wallet','Review & sign','Shared booking record']
    stage = min(3,int(progress*4))
    for i,x in enumerate(xs):
        if i<3:
            line([(x+248,375),(x+280,375)],BORDER,2)
            line([(x+272,371),(x+278,375),(x+272,379)],BORDER,2)
        box((x,326,x+248,434),'#211b2d',LIME if i==stage else BORDER,18,2 if i==stage else 1)
        text((x+18,345),f'0{i+1}','small',LIME if i==stage else MUTED)
        text((x+52,343),labels[i],'label')
        text((x+18,391),details[i],'body',MUTED)
        # Small native vector symbols: home, wallet, receipt, verification.
        ix,iy=x+218,356
        if i==0:
            line([(ix-10,iy),(ix,iy-8),(ix+10,iy),(ix+10,iy+10),(ix-10,iy+10),(ix-10,iy)],PURPLE,2)
        elif i==1:
            box((ix-12,iy-6,ix+10,iy+10),None,PURPLE,3,2); line([(ix,iy),(ix+10,iy)],PURPLE,2)
        elif i==2:
            box((ix-10,iy-9,ix+9,iy+12),None,PURPLE,2,2)
            line([(ix-5,iy-2),(ix+4,iy-2)],PURPLE,2); line([(ix-5,iy+4),(ix+2,iy+4)],PURPLE,2)
        else:
            circle(ix,iy+2,12,PURPLE); line([(ix-6,iy+2),(ix-1,iy+7),(ix+7,iy-3)],BG,2)
    # One moving signal follows the four stages; the sequence ends after two loops.
    px=50+progress*1088
    line([(50,454),(1138,454)],BORDER,1)
    line([(50,454),(px,454)],PURPLE,2)
    circle(px,454,4,LIME)
    return im.resize((W,H),Image.Resampling.LANCZOS)

MEDIA.mkdir(parents=True,exist_ok=True)
cover = render(1)
cover.save(MEDIA/'rental-rails.png',optimize=True)
palette=cover.quantize(colors=256)
frames=[render(i/71).quantize(palette=palette,dither=Image.Dither.NONE) for i in range(72)]
frames[0].save(MEDIA/'rental-rails.gif',save_all=True,append_images=frames[1:],
               duration=100,loop=1,optimize=True,disposal=1)
print('Rendered 72 frames; 7.2 seconds per loop, two loops, with a static alternative.')

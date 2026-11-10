"""Extract PDF paint operations as compound SVG paths, preserving glyph holes.

The PDF path operators h/v/y are not SVG H/V/Y. A paint operation owns all its
subpaths until f/f*/B/S, so they must not be exported as independently filled
pdfplumber curves. No image generation or network access is used here.
"""
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import os
import shutil
from xml.sax.saxutils import escape
import json, math, re, subprocess
from collections import Counter
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('BLACK_FRIDAY_SOURCE_PDF', str(Path.home() / 'Desktop/Broshura BF nentor/Broshura BF nentor.pdf')))
PUB = ROOT / 'public/brochure-presets/black-friday'
OUT = ROOT / 'artifacts/bf-reference'
IDENTITY = (1., 0., 0., 1., 0., 0.)

def matrix_product(a, b):
    aa,ab,ac,ad,ae,af = a; ba,bb,bc,bd,be,bf = b
    return (aa*ba+ac*bb, ab*ba+ad*bb, aa*bc+ac*bd, ab*bc+ad*bd,
            aa*be+ac*bf+ae, ab*be+ad*bf+af)

def transformed(m, p):
    a,b,c,d,e,f=m; x,y=p
    return (a*x+c*y+e, b*x+d*y+f)

def raw_rgb(values, color_space):
    v=[float(n) for n in values if isinstance(n,(int,float))]
    if not v:return '#000000'
    if color_space in ['/DeviceGray','/G'] or len(v)==1:
        a=[1-v[0]]*3 if color_space=='/Black' else v*3
    elif color_space=='/DeviceCMYK' or len(v)==4:
        a=[(1-v[i])*(1-v[3]) for i in range(3)]
    else:a=v[:3]
    return '#'+''.join(f'{max(0,min(255,round(x*255))):02x}' for x in a)

def device_color_space(name, resources):
    if name in ['/DeviceGray','/DeviceRGB','/DeviceCMYK']:return name
    spaces=resources.get('/ColorSpace',{}); value=spaces.get(name)
    if value is None:return name
    value=value.get_object()
    if isinstance(value,list) and value:
        if value[0]=='/DeviceN' and '/Black' in value[1]:return '/Black'
        if value[0]=='/Separation' and value[1]=='/Black':return '/Black'
        if value[0]=='/ICCBased':
            return {1:'/DeviceGray',3:'/DeviceRGB',4:'/DeviceCMYK'}.get(value[1].get_object().get('/N'),name)
    return name

@dataclass
class Paint:
    commands: list
    points: list
    fill: str | None
    stroke: str | None
    evenodd: bool
    width: float
    alpha: float
    linecap: int
    linejoin: int

class PdfPaint:
    def __init__(self, source=SOURCE):
        self.source=Path(source); self.reader=PdfReader(source); self.cache={}

    def page(self,index):
        if index in self.cache:return self.cache[index]
        page=self.reader.pages[index]; height=float(page.mediabox.height)
        output=[]
        def walk(stream, resources, initial, depth=0):
            if depth>30:raise ValueError('Unexpected PDF form recursion')
            state=deepcopy(initial); stack=[]; commands=[]; points=[]; current=None; start=None
            def point(x,y):
                px,py=transformed(state['matrix'],(float(x),float(y)))
                return px,height-py
            def add(op,ps):
                commands.append((op,ps)); points.extend(ps)
            for args,op in ContentStream(stream,self.reader).operations:
                if op==b'q':stack.append(deepcopy(state))
                elif op==b'Q':
                    if stack:state=stack.pop()
                elif op==b'cm':state['matrix']=matrix_product(state['matrix'],tuple(map(float,args)))
                elif op==b'w':state['width']=float(args[0])
                elif op==b'J':state['linecap']=int(args[0])
                elif op==b'j':state['linejoin']=int(args[0])
                elif op in [b'cs',b'CS']:
                    state['fill_space' if op==b'cs' else 'stroke_space']=device_color_space(str(args[0]),resources)
                elif op in [b'g',b'G',b'rg',b'RG',b'k',b'K',b'sc',b'SC',b'scn',b'SCN']:
                    fill=op[0] in b'grks'; key='fill' if fill else 'stroke'
                    space={b'g':'/DeviceGray',b'G':'/DeviceGray',b'rg':'/DeviceRGB',b'RG':'/DeviceRGB',b'k':'/DeviceCMYK',b'K':'/DeviceCMYK'}.get(op,state[key+'_space'])
                    state[key]=raw_rgb(args,space)
                elif op==b'gs':
                    ext=resources.get('/ExtGState',{}).get(args[0])
                    if ext:
                        ext=ext.get_object();state['fill_alpha']=float(ext.get('/ca',state['fill_alpha']));state['stroke_alpha']=float(ext.get('/CA',state['stroke_alpha']))
                elif op==b'Do':
                    xobject=resources.get('/XObject',{}).get(args[0])
                    if xobject:
                        xobject=xobject.get_object()
                        if xobject.get('/Subtype')=='/Form':
                            inner=deepcopy(state);inner['matrix']=matrix_product(state['matrix'],tuple(map(float,xobject.get('/Matrix',IDENTITY))))
                            walk(xobject,xobject.get('/Resources',resources),inner,depth+1)
                elif op==b'm':
                    current=start=point(*args);add('M',[current])
                elif op==b'l':
                    current=point(*args);add('L',[current])
                elif op==b'c':
                    ps=[point(*args[i:i+2]) for i in range(0,6,2)];current=ps[-1];add('C',ps)
                elif op==b'v':
                    if current is not None:
                        ps=[current,point(*args[:2]),point(*args[2:])];current=ps[-1];add('C',ps)
                elif op==b'y':
                    ps=[point(*args[:2]),point(*args[2:]),point(*args[2:])];current=ps[-1];add('C',ps)
                elif op==b'h':
                    add('Z',[]);current=start
                elif op==b're':
                    x,y,w,h=map(float,args); ps=[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)]
                    add('M',[ps[0]])
                    for p in ps[1:]:add('L',[p])
                    add('Z',[]);current=start=ps[0]
                elif op in [b'f',b'F',b'f*',b'B',b'B*',b'b',b'b*',b'S',b's',b'n']:
                    if op in [b's',b'b',b'b*']:add('Z',[])
                    if op!=b'n' and commands and points:
                        fill=state['fill'] if op not in [b'S',b's'] else None
                        stroke=state['stroke'] if op in [b'S',b's',b'B',b'B*',b'b',b'b*'] else None
                        m=state['matrix'];scale=math.sqrt(abs(m[0]*m[3]-m[1]*m[2]))
                        output.append(Paint(commands,points,fill,stroke,op.endswith(b'*'),state['width']*scale,state['fill_alpha'] if fill else state['stroke_alpha'],state['linecap'],state['linejoin']))
                    commands=[];points=[];current=start=None
        walk(page.get_contents(),page['/Resources'],dict(matrix=IDENTITY,fill='#000000',stroke='#000000',fill_space='/DeviceGray',stroke_space='/DeviceGray',width=1,fill_alpha=1,stroke_alpha=1,linecap=0,linejoin=0))
        self.cache[index]=output;return output

    @lru_cache(maxsize=13)
    def raster(self,index):
        dest=OUT/f'native-colors-{index+1:02}'
        if not dest.with_suffix('.png').exists():
            subprocess.run(['pdftoppm','-f',str(index+1),'-singlefile','-r','72','-png',str(self.source),str(dest)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        return Image.open(dest.with_suffix('.png')).convert('RGB')

    def source_color(self,color,index,bounds):
        # Saturated source CMYK/spot colors are sampled from the rendered PDF,
        # rather than using a naive unprofiled CMYK→RGB conversion.
        rgb=tuple(int(color[i:i+2],16) for i in [1,3,5])
        if max(rgb)-min(rgb)<25:return color
        page=self.reader.pages[index];im=self.raster(index)
        sx=im.width/float(page.mediabox.width);sy=im.height/float(page.mediabox.height)
        x0,y0,x1,y1=bounds; crop=im.crop((max(0,math.floor(x0*sx)),max(0,math.floor(y0*sy)),min(im.width,math.ceil(x1*sx)),min(im.height,math.ceil(y1*sy))))
        candidates=[(v,n) for v,n in Counter(crop.getdata()).most_common(100) if max(v)-min(v)>30 and n>=2]
        if not candidates:return color
        best=min(candidates,key=lambda item:sum((item[0][i]-rgb[i])**2 for i in range(3)))
        return '#'+''.join(f'{v:02x}' for v in best[0])

    def write(self,index,bounds,dest):
        b=list(map(float,bounds)); selected=[]
        for paint in self.page(index):
            xs=[p[0] for p in paint.points];ys=[p[1] for p in paint.points]
            pb=(min(xs),min(ys),max(xs),max(ys))
            if pb[0]<b[0]-.7 or pb[1]<b[1]-.7 or pb[2]>b[2]+.7 or pb[3]>b[3]+.7:continue
            if paint.alpha<=0:continue
            # Native PDF coordinates are transformed before being serialized;
            # compound subpaths remain in one path with the original fill rule.
            parts=[]
            for op,ps in paint.commands:
                parts.append(op+' '.join(f'{x-b[0]:.6f} {y-b[1]:.6f}' for x,y in ps))
            attrs={'d':' '.join(parts),'fill':self.source_color(paint.fill,index,pb) if paint.fill else 'none','fill-rule':'evenodd' if paint.evenodd else 'nonzero'}
            if paint.stroke:
                attrs.update(stroke=self.source_color(paint.stroke,index,pb),**{'stroke-width':f'{paint.width:.6f}','stroke-linecap':['butt','round','square'][min(paint.linecap,2)],'stroke-linejoin':['miter','round','bevel'][min(paint.linejoin,2)]})
            if paint.alpha<1:attrs['opacity']=str(paint.alpha)
            selected.append('<path '+' '.join(f'{k}="{escape(v)}"' for k,v in attrs.items())+'/>')
        if not selected:return False
        dest=Path(dest);dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {b[2]-b[0]:.6f} {b[3]-b[1]:.6f}">'+''.join(selected)+'</svg>')
        return True

EXTRACTOR=None
SOURCE_LG_LOGOS={'p01-01.svg','p02-05.svg','p02-06.svg','p03-01.svg','p03-02.svg','p03-04.svg','p06-05.svg','p07-03.svg','p10-04.svg'}
def write_pdf_svg(page,bounds,dest):
    global EXTRACTOR
    if EXTRACTOR is None:EXTRACTOR=PdfPaint()
    index=page.page_number-1 if hasattr(page,'page_number') else int(page)
    written=EXTRACTOR.write(index,bounds,dest)
    path=Path(dest)
    if written and path.parent.name=='brands' and path.name in SOURCE_LG_LOGOS:
        preserve_visible_lg_wordmark(path)
    return written

def preserve_visible_lg_wordmark(dest):
    """Drop the source's clipped-out alternate G, not the visible LG artwork.

    These nine marks contain both an alternate even-odd G in a clipped PDF
    form and the final nonzero G. The source raster shows only the latter.
    A path-only export otherwise superimposes them. Keep the source bounds,
    compound face cutouts and visible L/G paths verbatim.
    """
    dest=Path(dest);svg=dest.read_text()
    paths=re.findall(r'<path\b[^>]+/>',svg)
    if len(paths)!=4:return
    commands=[re.search(r'd="([^"]+)"',path).group(1) for path in paths]
    if (commands[0].count('M')>=4 and commands[1].count('M')==1
        and 'fill-rule="evenodd"' in paths[1]
        and all('fill-rule="nonzero"' in path for path in paths[2:])):
        dest.write_text(svg.replace(paths[1], '', 1))

def rebuild_all():
    profile=json.loads((ROOT/'src/features/brochure/blackFridayReference.json').read_text())
    products=json.loads((ROOT/'src/features/brochure/blackFridaySourceManifest.json').read_text())['products']
    layout=json.loads((OUT/'idml-layout.json').read_text())
    extractor=PdfPaint(); done=[];fail=[]
    for dest in sorted((PUB/'brands').glob('*.svg')):
        match=re.fullmatch(r'p(\d+)-(\d+)\.svg',dest.name)
        if not match:continue
        n,order=map(int,match.groups());frame=next(f for f in profile['pages'][n-1]['frames'] if f['order']==order)
        prod=next(p for p in products if p['page']==n and p['order']==order); f=prod['sourceBounds'];r=frame['brand'];w=f[2]-f[0];h=f[3]-f[1]
        b=[f[0]+r['x']/100*w,f[1]+r['y']/100*h,f[0]+(r['x']+r['width'])/100*w,f[1]+(r['y']+r['height'])/100*h]
        written=extractor.write(n-1,b,dest)
        if written and prod.get('brand')=='LG':preserve_visible_lg_wordmark(dest)
        (done if written else fail).append(str(dest.relative_to(ROOT)))
    for dest in sorted((PUB/'artwork').glob('*.svg')):
        if dest.name == 'footer-service.svg':
            # Reuse the approved outlined service logo; its embedded PDF text
            # operators are not reconstructed by a path-only paint exporter.
            shutil.copyfile(ROOT/'public/brochure-presets/october/service.svg', dest)
            done.append(str(dest.relative_to(ROOT)))
            continue
        match=re.fullmatch(r'p(\d+)-(\d+)-(u.+)\.svg',dest.name)
        if match:
            n,order,source_id=match.groups();n=int(n)
            src=next((a for a in layout['pages'][n-1]['items'] if a['id']==source_id),None)
            if not src:fail.append(str(dest));continue
            b=src['bounds']
        else:
            art=next(((p,a) for p in profile['pages'] for a in p['artworks'] if a.get('imageUrl','').endswith('/'+dest.name) or a.get('image','').endswith('/'+dest.name)),None)
            if not art:fail.append(str(dest));continue
            page,a=art;n=page['number'];w,h=layout['pages'][n-1]['width'],layout['pages'][n-1]['height'];b=[a['x']/100*w,a['y']/100*h,(a['x']+a['width'])/100*w,(a['y']+a['height'])/100*h]
        (done if extractor.write(n-1,b,dest) else fail).append(str(dest.relative_to(ROOT)))
    report={'rebuilt':len(done),'failed':fail,'files':done}
    (OUT/'native-svg-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'rebuilt':len(done),'failed':fail}))

if __name__=='__main__':rebuild_all()

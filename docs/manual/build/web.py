# -*- coding: utf-8 -*-
"""[MANUAL] La version de pantalla, para leer el manual en el telefono.

NO es un manual paralelo: se reutiliza el MISMO `manual.html`, se le cambia la hoja de estilo y se le meten las
imagenes dentro. Escribir el texto dos veces seria garantizar que las dos versiones se separen.

Todo va empotrado -imagenes en `data:`- porque la pagina publicada no puede pedir nada a ningun servidor.
"""
import base64, io, json, os, re, sys
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
DIR  = os.path.dirname(AQUI)
ANCHO_MAX = 1300          # a 2x de lo que mide un telefono; por encima solo es peso

def imagen_empotrada(ruta):
    im = Image.open(ruta)
    if im.width > ANCHO_MAX:
        im = im.resize((ANCHO_MAX, round(im.height * ANCHO_MAX / im.width)), Image.LANCZOS)
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA')
    # El logotipo es blanco sobre TRANSPARENTE: aplanarlo a RGB lo convertia en un cuadrado blanco sobre la
    # cabecera oscura. Si la imagen trae alfa, se respeta y no se cuantiza.
    tiene_alfa = im.mode == 'RGBA' and im.getchannel('A').getextrema()[0] < 255
    if tiene_alfa:
        buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
    # Capturas de interfaz: PNG con paleta conserva los bordes del texto nitidos y pesa una fraccion.
    plano = im.convert('RGB')
    buf = io.BytesIO()
    plano.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(buf, 'PNG', optimize=True)
    b = buf.getvalue()
    buf2 = io.BytesIO(); plano.save(buf2, 'PNG', optimize=True)
    if len(buf2.getvalue()) < len(b):
        b = buf2.getvalue()
    return 'data:image/png;base64,' + base64.b64encode(b).decode('ascii')

CSS = u"""
:root{
  --ink:#15181A; --ink-2:#4C5257; --ink-3:#787F84; --rule:#DEE2E4;
  --accent:#5E7A3A; --accent-soft:#EEF2E7; --warn:#8C4A2B; --warn-soft:#F8EEE8;
  --paper:#fff; --panel:#F4F6F4; --shot:#0E1012;
}
/* PAPEL BLANCO, SIEMPRE. Es un documento, no una interfaz: se lee como la version impresa y no se invierte con
   el tema del telefono. Por eso se reafirman los mismos valores bajo `data-theme=dark` — el visor estampa ese
   atributo en la raiz y ganaria a una simple consulta de medios. */
:root[data-theme=dark], :root[data-theme=light]{
  --ink:#15181A; --ink-2:#4C5257; --ink-3:#787F84; --rule:#DEE2E4;
  --accent:#5E7A3A; --accent-soft:#EEF2E7; --warn:#8C4A2B; --warn-soft:#F8EEE8;
  --paper:#fff; --panel:#F4F6F4; --shot:#0E1012;
}
html{background:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:17px/1.66 Georgia,"Times New Roman",serif;-webkit-text-size-adjust:100%}
.wrap{max-width:44rem;margin:0 auto;padding:0 1.15rem 5rem}
h1,h2,h3,h4,.ui,.kbd,th,figcaption,.lead,.toc,.hero,dt,nav{
  font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif}
p{margin:0 0 .8em}
a{color:var(--accent)}

/* ── portadilla: pagina de titulo impresa, no cabecera de sitio web ── */
.hero{background:var(--paper);color:var(--ink);padding:3.4rem 1.15rem 2.2rem;margin-bottom:2rem;
  position:relative;overflow:hidden;border-bottom:2px solid var(--ink)}
.hero .disc{position:absolute;right:-42%;top:6%;width:118%;padding-bottom:118%;border-radius:50%;
  border:1px solid var(--rule)}
.hero .disc::before,.hero .disc::after{content:"";position:absolute;border:1px solid var(--rule);border-radius:50%}
.hero .disc::before{inset:14%}.hero .disc::after{inset:30%}
.hero .in{position:relative;max-width:44rem;margin:0 auto}
.hero img{width:60px;display:block;margin-bottom:1.5rem}
.hero h1{font-size:1.95rem;line-height:1.14;font-weight:600;letter-spacing:-.02em;margin:0 0 .5rem}
.hero .sub{font-family:Georgia,serif;color:var(--ink-2);font-size:1rem;line-height:1.5;max-width:28rem}
.hero .meta{margin-top:2rem;font-size:.72rem;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-3)}

/* ── indice ── */
.toc{border:1px solid var(--rule);border-radius:10px;padding:1rem 1.1rem;margin:0 0 2.4rem;background:var(--panel)}
.toc h2{margin:0 0 .5rem;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.toc .tpart{font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);
  font-weight:700;margin:1.1rem 0 .35rem}
.toc .tpart:first-of-type{margin-top:.3rem}
.toc a{display:flex;gap:.6rem;padding:.3rem 0;text-decoration:none;color:var(--ink)}
.toc a.r1{font-size:.97rem;font-weight:600;margin-top:.7rem}
.toc a.r2{font-size:.88rem;color:var(--ink-2);padding-left:.9rem}
.toc a .n{color:var(--ink-3);width:2.1rem;flex:none;font-variant-numeric:tabular-nums;font-size:.82rem}

/* ── partes y capitulos ── */
.part{margin:3.2rem 0 0;padding:1.4rem 0 .2rem;border-top:2px solid var(--ink)}
.part .pnum{font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:700}
.part h1{font-size:1.6rem;font-weight:600;letter-spacing:-.02em;margin:.35rem 0 .5rem}
.part .blurb{color:var(--ink-2);font-size:1rem;line-height:1.6}
.part .chlist{display:none}
h1.ch{font-size:1.5rem;font-weight:600;letter-spacing:-.015em;line-height:1.2;
  margin:3rem 0 1.1rem;padding-bottom:.5rem;border-bottom:2px solid var(--ink);scroll-margin-top:.6rem}
h1.ch .n{display:block;font-size:.68rem;letter-spacing:.15em;text-transform:uppercase;
  color:var(--accent);font-weight:700;margin-bottom:.4rem}
h2{font-size:1.13rem;font-weight:600;margin:2rem 0 .5rem;letter-spacing:-.01em}
h3{font-size:1rem;font-weight:600;margin:1.4rem 0 .3rem}
h4{font-size:.75rem;font-weight:700;margin:1.2rem 0 .25rem;color:var(--ink-2);
  text-transform:uppercase;letter-spacing:.09em}
.lead{font-size:1.08rem;line-height:1.58;color:var(--ink-2);margin:0 0 1.3rem}

ul,ol{margin:0 0 .9em;padding-left:1.2em}
li{margin:.28em 0}
dl{margin:0 0 .9em}
dt{font-weight:600;font-size:.95rem;margin-top:.9em}
dd{margin:.1em 0 0;padding-left:.9rem;border-left:2px solid var(--rule)}

.ui{font-family:"Segoe UI",system-ui,sans-serif;font-size:.86em;font-weight:600;background:var(--panel);
  border:1px solid var(--rule);border-radius:4px;padding:.05em .35em;white-space:nowrap}
.kbd{font-size:.78em;font-weight:600;background:#2A2E31;color:#fff;border-radius:4px;
  padding:.1em .42em;white-space:nowrap}
.path{font-family:"Segoe UI",system-ui,sans-serif;font-size:.93em;color:var(--ink-2)}

/* ── figuras ── */
.fig{margin:1.3rem 0 1.6rem}
.fig .frame{border:1px solid var(--rule);border-radius:8px;background:var(--shot);overflow:hidden;line-height:0}
.fig img{width:100%;display:block}
.fig figcaption{font-size:.82rem;line-height:1.5;color:var(--ink-3);margin-top:.5rem;font-family:"Segoe UI",system-ui,sans-serif}
.fig figcaption b{color:var(--ink-2)}
.figrow{display:flex;flex-direction:column;gap:0}
.figrow .fig{flex:1}
@media (min-width:38rem){.figrow{flex-direction:row;gap:1rem}}

/* ── avisos ── */
.note,.warn{border-left:3px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0;
  padding:.85rem 1rem;margin:1.2rem 0;font-size:.95rem;line-height:1.6}
.warn{border-left-color:var(--warn);background:var(--warn-soft)}
.note .t,.warn .t{font-family:"Segoe UI",system-ui,sans-serif;font-weight:700;font-size:.68rem;
  text-transform:uppercase;letter-spacing:.11em;color:var(--accent);display:block;margin-bottom:.3rem}
.warn .t{color:var(--warn)}
.note p:last-child,.warn p:last-child{margin-bottom:0}

/* ── tablas: se desplazan ELLAS, nunca la pagina ── */
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:.8rem 0 1.4rem}
table{width:100%;border-collapse:collapse;font-size:.9rem;min-width:19rem}
th{font-size:.66rem;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-2);font-weight:700;
  text-align:left;border-bottom:2px solid var(--ink);padding:.4rem .5rem}
td{border-bottom:1px solid var(--rule);padding:.5rem .5rem;vertical-align:top;line-height:1.5}
td.k{font-family:"Segoe UI",system-ui,sans-serif;font-weight:600}
td.s{white-space:nowrap}

/* La lista que corresponde a los numeros naranjas de la captura. */
ol.callouts{list-style:none;padding-left:0;margin:.8rem 0 1.6rem;counter-reset:c;font-size:.95rem}
ol.callouts>li{counter-increment:c;position:relative;padding-left:2rem;margin:0 0 .55rem;line-height:1.55}
ol.callouts>li::before{content:counter(c);position:absolute;left:0;top:.12em;width:1.35rem;height:1.35rem;
  border-radius:50%;background:#FF7A1A;color:#fff;font-family:"Segoe UI",system-ui,sans-serif;
  font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center}
.intro{font-size:1.06rem;line-height:1.58;color:var(--ink-2);margin:0 0 1.2rem}
.note{border-left:2.5px solid var(--ink-3);background:none;border-radius:0;padding:0 0 0 .9rem;
  margin:1.1rem 0;font-size:.95rem;line-height:1.6;color:var(--ink-2)}
.note b{color:var(--ink)}
ol.steps{counter-reset:s;list-style:none;padding-left:0;margin:1rem 0 1.4rem}
ol.steps>li{counter-increment:s;position:relative;padding-left:2.1rem;margin:0 0 .7rem}
ol.steps>li::before{content:counter(s);position:absolute;left:0;top:.12em;width:1.5rem;height:1.5rem;
  border-radius:50%;background:var(--accent);color:#fff;font-family:"Segoe UI",system-ui,sans-serif;
  font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center}

/* ── impreso desde el navegador ── */
@media print{
  @page{margin:16mm}
  body{font-size:10.5pt}
  .hero{padding:0 0 1.5rem;margin-bottom:1.5rem;break-after:page}
  .hero .disc{display:none}
  .pdfbar,.toc{break-after:page}
  .wrap{max-width:none;padding:0}
  h1.ch{break-before:page}
  .fig,.note,.warn,tr,ol.steps>li{break-inside:avoid}
  h1,h2,h3,h4{break-after:avoid}
  a{color:var(--ink)}
}
.colophon{margin-top:3.5rem;padding-top:1.4rem;border-top:1px solid var(--rule);color:var(--ink-2);font-size:.92rem}
.colophon h2{margin-top:0}
.small{font-size:.85rem;color:var(--ink-3)}
.pdfbar{margin:0 0 2rem;padding:.9rem 1rem;border:1px solid var(--rule);border-radius:10px;
  font-family:"Segoe UI",system-ui,sans-serif;font-size:.9rem;color:var(--ink-2);background:var(--panel)}
"""

fuente = io.open(os.path.join(DIR, 'manual.html'), encoding='utf-8').read()

# el cuerpo, sin la portada de imprenta ni el hueco del indice paginado
cuerpo = fuente.split('</style>', 1)[1]
cuerpo = re.sub(r'<section class="cover">.*?</section>', '', cuerpo, flags=re.S)
cuerpo = re.sub(r'<section class="toc">.*?</section>', '', cuerpo, flags=re.S)
cuerpo = cuerpo.split('<script src="data.js">')[0]

# las tablas, envueltas para que se desplacen solas
# `<table ...>` con atributos existe (hay una con `style`), asi que se envuelve por expresion regular: con
# reemplazo literal tres tablas recibian el `</div>` de cierre sin haber recibido su apertura.
cuerpo = re.sub('<table' + chr(92) + 'b', '<div class="tw"><table', cuerpo)
cuerpo = cuerpo.replace('</table>', '</table></div>')

# imagenes dentro del propio fichero
usadas = set(re.findall(r'src="img/([^"]+)"', cuerpo))
for n in sorted(usadas):
    cuerpo = cuerpo.replace('src="img/%s"' % n, 'src="%s"' % imagen_empotrada(os.path.join(DIR, 'img', n)))
def logo_en_tinta(ruta):
    """El logotipo del programa es BLANCO sobre transparente, hecho para la portada oscura del PDF. Sobre papel
       blanco no se veria nada, asi que se invierte el color y se conserva el alfa: mismo dibujo, en tinta."""
    im = Image.open(ruta).convert('RGBA')
    r, g, b, a = im.split()
    inv = Image.merge('RGBA', (r.point(lambda v: 255 - v), g.point(lambda v: 255 - v),
                               b.point(lambda v: 255 - v), a))
    buf = io.BytesIO(); inv.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')

logo = logo_en_tinta(os.path.join(DIR, 'img', 'logo.png'))

datos = json.load(io.open(os.path.join(AQUI, 'datos.json'), encoding='utf-8'))
inyec = json.dumps({'comandos': datos['comandos'], 'efectos': datos['efectos']}, ensure_ascii=False)

guion = fuente.split('<script src="data.js"></script>', 1)[1]
guion = guion.replace("window.MANDATA || {comandos:[],efectos:[]}", "window.MANDATA")
# en pantalla el indice son ENLACES, no numeros de pagina
# El indice del PDF lleva numero de pagina; en pantalla ese numero no significa nada, asi que las filas se
# convierten en ENLACES al capitulo o apartado.
r1 = ("h+='<div class=\"r1\"><span class=\"n\">'+c.n+'</span><span>'+c.titulo+"
      "'</span><span class=\"d\"></span><span class=\"p\">'+(PG['ch'+c.n]||'')+'</span></div>';")
r2 = ("h+='<div class=\"r2\"><span class=\"n\">'+s.n+'</span><span>'+s.t+"
      "'</span><span class=\"d\"></span><span class=\"p\">'+(PG[s.n]||'')+'</span></div>';")
assert r1 in guion and r2 in guion, 'las filas del indice han cambiado de forma'
guion = guion.replace(r1, "h+='<a class=\"r1\" href=\"#ch'+c.n+'\"><span class=\"n\">'+c.n+'</span><span>'+c.titulo+'</span></a>';")
guion = guion.replace(r2, "h+='<a class=\"r2\" href=\"#ch'+c.n+'\"><span class=\"n\">'+s.n+'</span><span>'+s.t+'</span></a>';")
guion = guion.replace(".innerHTML=f;\n})();", ".innerHTML=f;\n  document.querySelectorAll('#fx table,#keys table').forEach(t=>{const w=document.createElement('div');w.className='tw';t.parentNode.insertBefore(w,t);w.appendChild(t);});\n})();")

pagina = (u'<title>Immersive Studio Pro — User Manual</title>\n<style>%s</style>\n'
          u'<div class="hero"><div class="disc"></div><div class="in">'
          u'<img src="%s" alt="Immersive Studio Pro">'
          u'<h1>Immersive Studio Pro</h1>'
          u'<div class="sub">User manual — editing for fulldome domes, flat screens and 360° rooms.</div>'
          u'<div class="meta">Alma Digital Studio · Version 1.0 · August 2026</div></div></div>\n'
          u'<div class="wrap">\n'
          # Sin banda de presentacion: el manual describe el programa, no se describe a si mismo.
          u'<nav class="toc"><h2>Contents</h2><div id="tocbody"></div></nav>\n'
          u'%s\n</div>\n'
          u'<script>window.MANDATA=%s;window.MANPAGES={};</script>\n%s'
          ) % (CSS, logo, cuerpo, inyec, guion)

destino = os.path.join(DIR, 'manual-web.html')
io.open(destino, 'w', encoding='utf-8').write(pagina)
print('%s   %.1f MB   %d imagenes' % (os.path.basename(destino), len(pagina.encode('utf-8'))/1048576.0, len(usadas)))

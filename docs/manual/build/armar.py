# -*- coding: utf-8 -*-
"""[MANUAL] Arma el PDF final.

Dos pasadas, porque un indice sin numeros de pagina no es un indice: Chromium no sabe en que pagina cae cada
capitulo, asi que se imprime una vez, se BUSCAN los titulos en el PDF resultante, y se vuelve a imprimir con los
numeros ya puestos. Al final se pegan portada y cuerpo y se escriben los marcadores del PDF.
"""
import io, json, os, subprocess, sys, fitz

AQUI = os.path.dirname(os.path.abspath(__file__))          # docs/manual/build
DOCS = os.path.dirname(os.path.dirname(AQUI))              # docs
RAIZ = os.path.dirname(DOCS)                               # el repositorio
DIR  = os.path.dirname(AQUI)
OUT  = os.path.join(AQUI, 'salida')
FINAL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DOCS, 'Immersive Studio Pro - User Manual.pdf')

CAPS = [
 (1,'Welcome to Immersive Studio Pro'), (2,'Installing and launching'), (3,'Immersive concepts'),
 (4,'Your first project'), (5,'The workspace at a glance'), (6,'The media panel'), (7,'The viewer'),
 (8,'The timeline'), (9,'The inspector'), (10,'Importing and managing media'),
 (11,'Editing in the timeline'), (12,'Placing clips in the dome'), (13,'2D sequences'),
 (14,'The 360'), (15,'Sequences and nests'), (16,'Compose'), (17,'Effects and masks'), (18,'Colour'),
 (19,'Motion, keyframes and automation'), (20,'Reactive FX'), (21,'Audio'), (22,'Exporting'),
 (23,'Corner data'), (24,'Live output'), (25,'Menu reference'), (26,'Keyboard shortcuts'),
 (27,'Compose reference'), (28,'Effects reference'), (29,'Performance and troubleshooting'),
]

def escribir_datos(paginas):
    d = json.load(io.open(os.path.join(AQUI, 'datos.json'), encoding='utf-8'))
    datos = {'comandos': d['comandos'], 'efectos': d['efectos']}
    js = (u"/* Generado por man-armar.py — datos leidos de la aplicacion viva, no escritos a mano. */\n"
          u"window.MANDATA=" + json.dumps(datos, ensure_ascii=False) + ";\n"
          u"window.MANPAGES=" + json.dumps(paginas) + ";\n")
    io.open(os.path.join(DIR, 'data.js'), 'w', encoding='utf-8').write(js)

def imprimir():
    r = subprocess.run(['npx', 'electron', os.path.join(AQUI,'imprimir.js'), OUT],
                       cwd=RAIZ, capture_output=True, text=True, shell=True)
    if not os.path.exists(os.path.join(OUT, '_cuerpo.pdf')):
        print(r.stdout[-2000:]); print(r.stderr[-2000:]); raise SystemExit('no se genero el PDF')
    print('   ' + (r.stdout.strip().splitlines() or [''])[-1])

def paginas_de_capitulos():
    """La pagina IMPRESA de cada capitulo. El cuerpo empieza en la pagina 2 del documento, asi que el indice
       del PDF de cuerpo mas 2 es el numero que sale en el pie.

       Se identifica por el TAMANO DE FUENTE del titulo, no por la altura del rectangulo que devuelve
       `search_for`: esa altura es la de la linea, y un parrafo destacado a 11,6 pt con interlineado 1,55 mide
       lo mismo que un titular. Con ese criterio cuatro capitulos apuntaban a la pagina equivocada.
       El titular de capitulo va a 21 pt; los de PARTE a 27 y el cuerpo por debajo de 12."""
    doc = fitz.open(os.path.join(OUT, '_cuerpo.pdf'))
    titulares = []
    for i in range(doc.page_count):
        txt = []
        for b in doc[i].get_text('dict')['blocks']:
            for l in b.get('lines', []):
                for s in l.get('spans', []):
                    if 19.0 <= s['size'] <= 24.0:
                        txt.append(s['text'])
        titulares.append(' '.join(txt))
    doc.close()
    pg, desde = {}, 0
    for n, titulo in CAPS:
        for i in range(desde, len(titulares)):
            if titulo.lower() in titulares[i].lower():
                pg['ch%d' % n] = i + 2
                desde = i + 1          # los capitulos van en orden: nunca hacia atras
                break
    return pg

print('pasada 1 — imprimir para medir')
escribir_datos({})
imprimir()
pg = paginas_de_capitulos()
faltan = [n for n, _ in CAPS if ('ch%d' % n) not in pg]
print('   capitulos localizados: %d de %d%s' % (len(pg), len(CAPS), ('   SIN LOCALIZAR: ' + str(faltan)) if faltan else ''))

print('pasada 2 — imprimir con el indice numerado')
escribir_datos(pg)
imprimir()

print('armar')
doc = fitz.open(os.path.join(OUT, '_portada.pdf'))
doc.insert_pdf(fitz.open(os.path.join(OUT, '_cuerpo.pdf')))

PARTES = [(1,'Part one - Getting started'), (5,'Part two - The workspace'), (10,'Part three - Editing'),
          (16,'Part four - Creative tools'), (22,'Part five - Delivery'), (25,'Part six - Reference')]
toc, prim = [], {p[0]: p[1] for p in PARTES}
toc.append([1, 'Contents', 2])
for n, titulo in CAPS:
    p = pg.get('ch%d' % n)
    if not p:
        continue
    if n in prim:
        toc.append([1, prim[n], max(1, p - 1)])
    toc.append([2, '%d. %s' % (n, titulo), p])
doc.set_toc(toc)
doc.set_metadata({'title': 'Immersive Studio Pro - User Manual',
                  'author': 'Alma Digital Studio', 'subject': 'User manual for version 1.0',
                  'keywords': 'fulldome, dome, immersive, 360, video editing'})
doc.save(FINAL, deflate=True, garbage=3)
n = doc.page_count
doc.close()
print('   %s   %d paginas   %.1f MB' % (os.path.basename(FINAL), n, os.path.getsize(FINAL)/1048576.0))

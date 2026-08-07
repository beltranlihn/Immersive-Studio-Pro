# -*- coding: utf-8 -*-
"""[MANUAL] Arma el PDF final.

Dos pasadas, porque un indice sin numeros de pagina no es un indice: Chromium no sabe en que pagina cae cada
capitulo, asi que se imprime una vez, se BUSCAN los titulares en el PDF resultante, y se vuelve a imprimir con
los numeros ya puestos. Al final se pegan portada y cuerpo y se escriben los marcadores del PDF.

Los titulares se leen del PROPIO `manual.html`. Antes vivian en una lista aqui dentro y basto renombrar los
capitulos para que nueve dejaran de encontrarse en silencio.
"""
import io, json, os, re, subprocess, sys, fitz

AQUI = os.path.dirname(os.path.abspath(__file__))          # docs/manual/build
DOCS = os.path.dirname(os.path.dirname(AQUI))              # docs
RAIZ = os.path.dirname(DOCS)                               # el repositorio
DIR  = os.path.dirname(AQUI)                               # docs/manual
OUT  = os.path.join(AQUI, 'salida')
FINAL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(DOCS, 'Immersive Studio Pro - User Manual.pdf')

def limpiar(h):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).strip()

def titulares():
    """(clave, texto, nivel) en orden de documento. Nivel 1 = capitulo, 2 = apartado."""
    s = io.open(os.path.join(DIR, 'manual.html'), encoding='utf-8').read()
    s = s.split('<script')[0]
    out, cap, sec = [], 0, 0
    for m in re.finditer(r'<h1 class="ch"[^>]*>(.*?)</h1>|<h2[^>]*>(.*?)</h2>', s, re.S):
        if m.group(1) is not None:
            cap += 1; sec = 0
            out.append(('ch%d' % cap, limpiar(m.group(1)), 1))
        elif cap:
            sec += 1
            out.append(('%d.%d' % (cap, sec), limpiar(m.group(2)), 2))
    return out

def escribir_datos(paginas):
    d = json.load(io.open(os.path.join(AQUI, 'datos.json'), encoding='utf-8'))
    datos = {'comandos': d['comandos'], 'efectos': d['efectos']}
    js = (u"/* Generado por armar.py — datos leidos de la aplicacion viva, no escritos a mano. */\n"
          u"window.MANDATA=" + json.dumps(datos, ensure_ascii=False) + ";\n"
          u"window.MANPAGES=" + json.dumps(paginas) + ";\n")
    io.open(os.path.join(DIR, 'data.js'), 'w', encoding='utf-8').write(js)

def imprimir():
    r = subprocess.run(['npx', 'electron', os.path.join(AQUI, 'imprimir.js'), OUT],
                       cwd=RAIZ, capture_output=True, text=True, shell=True)
    if not os.path.exists(os.path.join(OUT, '_cuerpo.pdf')):
        print(r.stdout[-2000:]); print(r.stderr[-2000:]); raise SystemExit('no se genero el PDF')
    print('   ' + (r.stdout.strip().splitlines() or [''])[-1])

def paginas(tit):
    """La pagina IMPRESA de cada titular. El cuerpo empieza en la pagina 2 del documento, asi que el indice del
       PDF de cuerpo mas 2 es el numero que sale en el pie.

       Se identifica por el TAMANO DE FUENTE, no por la altura del rectangulo que devuelve `search_for`: esa
       altura es la de la linea, y un parrafo destacado mide lo mismo que un titular. Ademas se avanza en orden:
       un apartado nunca cae antes que su capitulo."""
    doc = fitz.open(os.path.join(OUT, '_cuerpo.pdf'))
    grande, medio = [], []
    for i in range(doc.page_count):
        g, m = [], []
        for b in doc[i].get_text('dict')['blocks']:
            for l in b.get('lines', []):
                for s in l.get('spans', []):
                    if 19.0 <= s['size'] <= 22.5: g.append(s['text'])
                    elif 12.0 <= s['size'] <= 13.5: m.append(s['text'])
        grande.append(' '.join(g).lower()); medio.append(' '.join(m).lower())
    doc.close()
    pg, desde = {}, 0
    for clave, texto, nivel in tit:
        fuente = grande if nivel == 1 else medio
        t = texto.lower()
        for i in range(desde, len(fuente)):
            if t and t in fuente[i]:
                pg[clave] = i + 2
                # El cursor NO avanza de pagina: el primer apartado de un capitulo comparte hoja con su titulo,
                # y avanzando se perdian todos los «N.1» -y con ellos el resto del capitulo, en cascada-.
                desde = i
                break
    return pg

TIT = titulares()
caps = [t for t in TIT if t[2] == 1]
print('titulares leidos del HTML: %d capitulos, %d apartados' % (len(caps), len(TIT) - len(caps)))

print('pasada 1 - imprimir para medir')
escribir_datos({})
imprimir()
pg = paginas(TIT)
faltan = [c[0] for c in TIT if c[0] not in pg]
print('   localizados: %d de %d%s' % (len(pg), len(TIT), ('   SIN LOCALIZAR: ' + str(faltan[:12])) if faltan else ''))

print('pasada 2 - imprimir con el indice numerado')
escribir_datos(pg)
imprimir()

print('armar')
doc = fitz.open(os.path.join(OUT, '_portada.pdf'))
doc.insert_pdf(fitz.open(os.path.join(OUT, '_cuerpo.pdf')))
toc = [[1, 'Contents', 2]]
n = 0
for clave, texto, nivel in TIT:
    p = pg.get(clave)
    if not p:
        continue
    if nivel == 1:
        n += 1
        toc.append([1, '%d. %s' % (n, texto), p])
    else:
        toc.append([2, '%s  %s' % (clave, texto), p])
doc.set_toc(toc)
doc.set_metadata({'title': 'Immersive Studio Pro - User Manual',
                  'author': 'Alma Digital Studio', 'subject': 'User manual for version 1.0',
                  'keywords': 'fulldome, dome, immersive, 360, video editing'})
doc.save(FINAL, deflate=True, garbage=3)
paginas_totales = doc.page_count
doc.close()
print('   %s   %d paginas   %.1f MB' % (os.path.basename(FINAL), paginas_totales,
                                        os.path.getsize(FINAL) / 1048576.0))

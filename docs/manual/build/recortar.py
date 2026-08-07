# -*- coding: utf-8 -*-
"""[MANUAL] Quita el vacio del pie de las capturas altas.

El panel del inspector mide 850 px de alto y su contenido acaba mucho antes; a ancho de columna esa proporcion
se sale de la hoja y el capitulo abria con una pagina en blanco. Se recorta la franja inferior de color uniforme
y se deja un margen, en vez de aplastar la imagen por hoja de estilo.

Se recorta SOLO por abajo: las marcas numeradas se miden al capturar, en coordenadas desde la esquina superior
izquierda, y quitar pie no las mueve.
"""
import os, sys
from PIL import Image

DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'img')
MARGEN = 26          # pixeles de aire que se conservan bajo el ultimo contenido
MIN_ALTO = 120

def fila_uniforme(px, x0, x1, y, ref, tol=6):
    for x in range(x0, x1, max(1, (x1 - x0) // 90)):
        c = px[x, y]
        if abs(c[0] - ref[0]) > tol or abs(c[1] - ref[1]) > tol or abs(c[2] - ref[2]) > tol:
            return False
    return True

def recortar(ruta):
    orig = Image.open(ruta)
    # Una imagen con transparencia -el logotipo- no es una captura: aplanarla a RGB la vuelve uniforme entera y
    # el recorte se la comeria. La primera version se dejo el logotipo en 65 px de alto.
    if orig.mode in ('RGBA', 'LA') and orig.getchannel('A').getextrema()[0] < 255:
        return 0
    im = orig.convert('RGB')
    w, h = im.size
    px = im.load()
    # Los bordes laterales del panel son mas claros que el fondo; midiendo desde la columna 0 ninguna fila
    # parecia uniforme y no se recortaba nada.
    x0, x1 = max(1, int(w * 0.04)), max(2, int(w * 0.96))
    ref = px[(x0 + x1) // 2, h - 2]
    y = h - 2
    while y > MIN_ALTO and fila_uniforme(px, x0, x1, y, ref):
        y -= 1
    nuevo = min(h, y + MARGEN)
    if nuevo >= h - 4:
        return 0
    im.crop((0, 0, w, nuevo)).save(ruta, optimize=True)
    return h - nuevo

objetivos = sys.argv[1:] or [n for n in sorted(os.listdir(DIR))
                             if n.endswith('.png') and not n.endswith('-m.png')]
total = 0
for n in objetivos:
    ruta = os.path.join(DIR, n) if not os.path.isabs(n) else n
    if not os.path.exists(ruta):
        continue
    q = recortar(ruta)
    if q:
        print('   %-28s -%d px' % (os.path.basename(ruta), q))
        total += 1
print('%d imagenes recortadas' % total)

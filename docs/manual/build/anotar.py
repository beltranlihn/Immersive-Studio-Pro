# -*- coding: utf-8 -*-
"""[MANUAL] Numera los controles sobre las capturas.

Es el modelo del manual de Ableton: se marca cada parte con un numero sobre la propia imagen y se explica en una
lista debajo. Asi el texto puede decir «3» en vez de «el segundo grupo de botones empezando por la izquierda».

Las coordenadas NO se estiman: las mide `capturar.mjs` sobre el DOM vivo y las deja en un fichero al lado de
cada PNG. Un manual con flechas que apuntan al sitio equivocado es peor que uno sin flechas.
"""
import io, json, os, sys
from PIL import Image, ImageDraw, ImageFont

DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'img')
TINTA = (255, 122, 26)          # naranja: la interfaz es azul grisacea y verde oliva, asi que no se confunde
BLANCO = (255, 255, 255)

def fuente(px):
    for n in ('segoeuib.ttf', 'arialbd.ttf', 'DejaVuSans-Bold.ttf'):
        try:
            return ImageFont.truetype(n, px)
        except Exception:
            pass
    return ImageFont.load_default()

def anotar(png, marcas, discos=False):
    """`discos`: solo el numero, sin rectangulo. Es lo que necesita una vista GENERAL de la ventana — dos zonas
       contiguas dibujan dos filetes paralelos que se leen como un error de encuadre, y a tamaño de lectura ocho
       rectangulos grandes son ruido. El rectangulo sirve cuando lo marcado es un control pequeño."""
    im = Image.open(png).convert('RGB')
    d = ImageDraw.Draw(im)
    # El grosor se escala con la imagen: un trazo de 3 px se pierde en una captura de 3000 px de ancho.
    g = max(3, round(im.width / 620))
    r = max(14, round(im.width / 88))          # radio del disco del numero
    f = fuente(int(r * 1.3))
    puestos = []
    for m in marcas:
        x0, y0 = m['x'] - g, m['y'] - g
        x1, y1 = m['x'] + m['w'] + g, m['y'] + m['h'] + g
        if discos:
            # El disco se mete DENTRO de la zona, junto a su esquina, para que se lea a quien pertenece.
            cx = m['x'] + r + int(r * 0.5)
            cy = m['y'] + r + int(r * 0.5)
        else:
            d.rectangle([x0, y0, x1, y1], outline=TINTA, width=g)
            # El disco va en la esquina superior IZQUIERDA, por fuera del rectangulo.
            cx, cy = x0, y0
        # Si el disco se saldria de la imagen se mete para dentro: en un control pegado al borde quedaria
        # cortado a la mitad.
        cx = min(max(cx, r + 1), im.width - r - 1)
        cy = min(max(cy, r + 1), im.height - r - 1)
        # Dos zonas contiguas -la barra de herramientas y las cabeceras de pista- dejaban un numero encima del
        # otro y solo se leia el ultimo. Si el sitio esta ocupado, el disco baja por el borde de SU rectangulo.
        for _ in range(12):
            if all((cx - px) ** 2 + (cy - py) ** 2 >= (2.15 * r) ** 2 for px, py in puestos):
                break
            cy = min(cy + int(2.3 * r), im.height - r - 1)
        puestos.append((cx, cy))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TINTA, outline=BLANCO, width=max(2, g // 2))
        t = str(m['n'])
        b = d.textbbox((0, 0), t, font=f)
        d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), t, font=f, fill=BLANCO)
    salida = png[:-4] + '-m.png'
    im.save(salida, optimize=True)
    return salida

hechas = 0
for n in sorted(os.listdir(DIR)):
    if not n.endswith('.marcas.json'):
        continue
    base = os.path.join(DIR, n[:-len('.marcas.json')] + '.png')
    if not os.path.exists(base):
        print('   -- sin captura para ' + n)
        continue
    marcas = json.load(io.open(os.path.join(DIR, n), encoding='utf-8'))
    if not marcas:
        print('   -- ' + n + ' no trae marcas')
        continue
    # `capturar.mjs` deja la bandera dentro del primer elemento; asi el modo viaja con la toma.
    discos = bool(marcas[0].get('discos'))
    s = anotar(base, marcas, discos)
    print('   ok ' + os.path.basename(s) + '   ' + str(len(marcas)) + ' marcas' + ('  (solo numeros)' if discos else ''))
    hechas += 1
print('%d imagenes numeradas' % hechas)

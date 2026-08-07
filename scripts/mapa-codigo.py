# -*- coding: utf-8 -*-
"""[GUIA DE CODIGO] Deriva la estructura REAL de app.js.

El fichero no lleva marcas de seccion regulares, asi que el orden se obtiene listando las declaraciones de
PRIMER NIVEL (columna 0) con su linea. Escribir la guia de memoria daria un mapa que no coincide con el codigo.
"""
import io, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # scripts/ -> el repositorio
RUTA = os.path.join(RAIZ, sys.argv[1] if len(sys.argv) > 1 else 'app.js')
PASO = int(sys.argv[2]) if len(sys.argv) > 2 else 500

lineas = io.open(RUTA, encoding='utf-8').read().splitlines()
DECL = re.compile(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|'
                  r'^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=')
items = []
for i, l in enumerate(lineas, 1):
    m = DECL.match(l)
    if m:
        items.append((i, m.group(1) or m.group(2), bool(m.group(1))))

print('%s: %d lineas, %d declaraciones de primer nivel (%d funciones)'
      % (os.path.basename(RUTA), len(lineas), len(items), sum(1 for x in items if x[2])))
print()
bloque = {}
for i, n, esf in items:
    bloque.setdefault((i - 1) // PASO, []).append(n)
for k in sorted(bloque):
    nombres = bloque[k]
    print('L%-6d %2d  %s' % (k * PASO + 1, len(nombres), ' '.join(nombres[:14]) + ('  …' if len(nombres) > 14 else '')))

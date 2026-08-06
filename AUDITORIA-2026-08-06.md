# Auditoría independiente de la ronda R276–R278 · 2026-08-06

**Auditor:** Fable, como agente independiente, sobre el rango `f33b658..HEAD`. No tocó ningún archivo: sólo leyó
y reportó. Los arreglos son míos (R278b) y van todos verificados.

**Resultado corto:** encontró **un fallo grave que podía borrar clips en silencio**, una duplicación de función
que anulaba lo que esta ronda prometía, y ocho cosas menores. Todo aplicado.

---

## Los tres graves

### 1 · `slot` viajaba al pegar atributos, y el re-layout borraba el clip
Dejé fuera `group`/`groupId` («pertenecer a un grupo es una relación, no un atributo») pero **no `slot`**, que es
la otra mitad de esa misma relación: el índice del miembro dentro de la composición.

Copias atributos de un miembro de una composición de 12 elementos (`slot:7`), los pegas sobre un miembro de una
de 4, y ese clip se queda con un índice que su composición no tiene. Al siguiente cambio de disposición, el
código que rehace el grupo **elimina en silencio** todo miembro cuyo índice se salga. Sin re-layout de por medio
el daño no se ve: queda latente en el proyecto guardado, que es lo peor que puede pasar.

**Arreglado:** `slot` va a la lista de exclusiones.

### 2 · Había DOS «Copiar atributos» en el mismo menú, con el mismo rótulo y distinta semántica
El programa ya tenía un par de copiar/pegar atributos desde R80. Añadí el mío sin retirar aquél, y quedaron los
dos en el menú contextual del clip con rótulos idénticos. El viejo **fusiona** propiedades en vez de
reemplazarlas, y **no recorta la automatización** ni acota la longitud del bucle. Elegir la entrada equivocada
daba exactamente lo que esta ronda dice haber impedido.

**Arreglado:** el par viejo se retira (archivado en `_backup/deprecated/`) y sus dos entradas de menú desaparecen.

### 3 · El pegado era asimétrico: sobrevivía lo que el origen no traía
Asignar las claves del origen sólo pisa las que el origen tiene. Las opcionales — máscaras de pluma, bucle,
velocidad, modificadores — sólo existen si alguna vez se usaron. Resultado: pegar los atributos de un clip
«limpio» sobre uno con máscara y bucle le borraba la automatización pero **le dejaba la máscara huérfana, el
bucle puesto y la velocidad**. Ni reemplazo ni fusión: una mezcla de dos clips.

**Arreglado:** ahora se retira todo lo que sí es atributo antes de asignar. Reemplazo simétrico de verdad.

---

## Los ocho menores, todos aplicados

| # | Qué encontró | Qué hice |
|---|---|---|
| 4 | Pegar atributos no reprogramaba audio ni desechaba las instancias de vídeo, aunque copia velocidad, volumen, bucle y fundidos: un clip sonando seguía con los valores viejos | Se añade la misma secuencia que ya usaba el cambio de velocidad |
| 5 | Mi comentario decía que Ctrl+Alt+C/V ganaban «por mirar primero», y era **falso**: delante había tres manejadores de puntos de curva que no miraban Alt, así que con puntos seleccionados copiaba la curva | Esos tres exigen ahora que Alt no esté pulsado |
| 6 | Cancelar el renombrado de una pestaña con Escape la dejaba ancha, rompiendo el «tres exactas» | La anchura se devuelve al perder el foco, que ocurre en todos los casos |
| 7 | Los mandos del panel de Motion nacían con la pista **vacía** (se reconstruyen sin pasar por el inspector), y el maestro de mezcla escribía el valor a mano sin repintar | Se pintan al construir la lista y al refrescar |
| 8 | Con el puntito retirado, en los mandos **bipolares** (pitch, luminancia, giro del tejido) «cero» se leía como «a la mitad» | El relleno sale del cero hacia el lado que toque; en los normales, igual que antes |
| 9 | `React to audio` quedó **encendido sin apagador**: quité su fila pero el motor lo seguía leyendo, y un proyecto guardado con eso puesto seguía pulsando sin forma de pararlo | El motor deja de leerlo. El dato sigue en el `.isp` por si hubiera que revivirlo |
| 10 | El aviso de «automatización recortada» saltaba siempre que el origen fuera más largo, aunque no se perdiera ni un punto | Sólo avisa si de verdad se perdió algo |
| 11 | Al borrar la última máscara de puntos, el desplegable seguía diciendo «Pen» | Se pone al día a mano |
| 12 | El fader del cuadro de Compose perdió el teclado al ocultar el mando nativo | Recupera flechas (con Mayúsculas, paso ×10) y foco visible |

También comprobó y **no** encontró nada en: ids del DOM huérfanos tras las retiradas, fugas de escuchadores en el
panel de máscaras, el botón «+» fuera de la tira de pestañas, el orden de deshacer, y la compatibilidad con
proyectos guardados antes de la ronda.

Dos cosas que dejó marcadas como **no confirmadas** y que no toqué: si los ids de efectos podrían mezclarse entre
clips por alguna ruta que no encontró, y si la caja de forma podría quedar apuntando a algo inexistente. Ambas
quedan anotadas aquí por si aparecen.

---

## Verificación

`scratchpad/r278b-auditoria.mjs` reproduce el escenario de cada hallazgo, no una versión cómoda de él: el `slot`
del destino se queda en el suyo, la máscara y el bucle del destino desaparecen al pegar de un clip limpio, el par
viejo ya no existe, el bipolar rellena de 25 % a 50 % en −45 y no rellena nada en 0, y las referencias vivas a
keyframes se sueltan. Además se volvieron a pasar las tres pruebas de la ronda (atributos, pestañas, inspector)
para comprobar que no rompí nada al arreglar.

---

## Adenda · code review sobre estos mismos arreglos (R278c)

La revisión de código repasó el commit de arreglos y encontró **siete** cosas más, **cuatro introducidas por
los propios arreglos**. La peor: al hacer simétrico el reemplazo, pegar atributos de un clip sin bucle sobre
uno loopeado le quitaba el bucle y le dejaba la duración — un clip estirado a 60 s sobre un archivo de 5 s
quedaba con 55 segundos de fotograma congelado. Ahora el bucle se conserva cuando es lo único que lo evita, y
se avisa. Detalle completo en `PLAN.md`, ronda 278c; verificación en `scratchpad/r278c-review.mjs`.

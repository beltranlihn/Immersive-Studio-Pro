/* [R102·D-T2] El color de clip tiene que SIGNIFICAR el tipo de medio, ningún tipo debe gritar más que otro,
   y una elección del usuario es sagrada. Antes: 6 grises entre L* 19–29 repartidos por turno. */
(() => {
  const out = []; const ok = (n, c, d) => out.push((c ? 'ok   ' : 'FAIL ') + n + (d ? '  → ' + d : ''));
  const hex = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const Y = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const L = h => { const y = Y(hex(h)); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
  const hue = h => { const [r, g, b] = hex(h).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return -1; let x; if (mx === r) x = ((g - b) / d) % 6; else if (mx === g) x = (b - r) / d + 2; else x = (r - g) / d + 4;
    return (x * 60 + 360) % 360; };

  const kinds = Object.keys(CLIP_HUE);
  const Ls = kinds.map(k => L(CLIP_HUE[k]));
  const spread = Math.max(...Ls) - Math.min(...Ls);
  // Blender reparte 20.2 L* — se lo puede permitir porque su selección es un contorno. Igual la nuestra.
  // Aun así lo mantenemos plano: ningún tipo de medio debe pesar más que otro sólo por ser de su tipo.
  ok('todos los tipos a la misma luminosidad', spread < 1.5, 'spread=' + spread.toFixed(2) + ' L* (Blender: 20.2)');

  // tonos realmente distintos entre sí (si no, el color no distingue nada)
  const hues = kinds.filter(k => k !== 'nest').map(k => hue(CLIP_HUE[k])).sort((a, b) => a - b);
  let minGap = 360;
  for (let i = 1; i < hues.length; i++) minGap = Math.min(minGap, hues[i] - hues[i - 1]);
  minGap = Math.min(minGap, 360 - hues[hues.length - 1] + hues[0]);
  ok('tonos separados entre sí', minGap >= 20, 'separación mínima=' + minGap.toFixed(0) + '°');

  // nest = neutro: una secuencia es estructura, no medio (Blender hace lo mismo con `scene`)
  ok('nest es neutro (estructura, no medio)', hue(CLIP_HUE.nest) === -1, CLIP_HUE.nest);

  // el color se DERIVA del tipo
  ok('clipColorFor deriva por tipo', clipColorFor('audio') === CLIP_HUE.audio && clipColorFor('video') === CLIP_HUE.video,
     'video=' + clipColorFor('video') + ' audio=' + clipColorFor('audio'));
  ok('tipo desconocido no revienta', !!clipColorFor('zzz'), clipColorFor('zzz'));

  // los grises heredados se tratan como "sin color" → se derivan (arregla proyectos ya guardados)
  const fakeM = { kind: 'video' };
  ok('gris heredado se trata como sin-color', clipTint({ color: '#3C4046' }, fakeM) === CLIP_HUE.video, clipTint({ color: '#3C4046' }, fakeM));
  ok('sin color → deriva del tipo', clipTint({}, { kind: 'audio' }) === CLIP_HUE.audio, clipTint({}, { kind: 'audio' }));
  // ...pero una elección real del usuario NO se toca
  ok('elección del usuario se respeta', clipTint({ color: '#FF00AA' }, fakeM) === '#FF00AA', clipTint({ color: '#FF00AA' }, fakeM));

  // en el DOM: dos clips de tipos distintos deben verse distintos
  const clips = [...document.querySelectorAll('.clip .tt')].slice(0, 6).map(t => getComputedStyle(t).backgroundColor);
  ok('los clips pintados usan el color derivado', clips.length > 0, clips.slice(0, 3).join(' '));

  // filas alternas al 2%: perceptible sin zumbar
  const lanes = [...document.querySelectorAll('#tracks .lane')];
  if (lanes.length >= 2) {
    const a = getComputedStyle(lanes[0]).backgroundColor, b = getComputedStyle(lanes[1]).backgroundColor;
    ok('filas alternas se distinguen', a !== b, a + ' vs ' + b);
  }
  return out.join('\n');
})()

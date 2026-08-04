/* [R247c · retirado 2026-08-04] TEJIDO SOBRE LA ESFERA — el primer intento, sustituido por el tejido en plano 1:1.
   Colocaba cada clip directamente en el domo, con las tiras trazadas en el plano del ojo de pez y envueltas por su
   cuerda. Funcionaba (proporciones intactas, viaje infinito) pero se veía ESCALONADO, en diente de sierra: en una
   proyección azimutal-equidistante la unica banda recta que es un circulo maximo es la que pasa por el centro del
   disco; el resto se curva, asi que dos clips vecinos de la misma tira no llegan a alinearse nunca y el borde entre
   tiras se quiebra. La cura no era mas matematica esferica sino cambiar de sitio el problema: montar el tejido en un
   plano 1:1 (donde los vecinos se juntan a 90 exactos por construccion) y deformar UNA sola vez al final, entrando
   en el domo como fuente fulldome con ojo de pez. Ver ADR-0007 y PLAN.md R247c.
   Se archiva junto con lo que lo acompanaba: f2azelUnclamped, props.alignBand / bandHalf / bandAxis en drawClip,
   y compWeaveAnim en su version de ejes fx/fy. */
  /* [R247] TEJIDO. Familias de TIRAS rectas que cruzan el disco de lado a lado — «un grid es una tira de clips que
     cruza de lado a lado», definición de Beltrán. Se trabaja en el PLANO DEL OJO DE PEZ (lo que ve el espectador),
     que es donde las tiras son rectas; cada posición se lleva a az/el al final. Las tiras van a 0° y 90° porque el
     desplazamiento con envoltura de R246 trata los ejes por separado: en diagonal la envoltura daría un salto.

     LA PROPORCIÓN NUNCA SE TOCA (petición explícita de Beltrán: los clips vendrán en 1:1, 16:9 y lo que sea, y
     ninguno puede salir estirado ni achatado). El parche ya deriva su alto del ancho por `h/w`, así que lo único
     que hay que elegir es CÓMO ENCAJA en la tira, y eso es `fit`:
       · 'across' → el lado LARGO cruza la tira, ocupando todo su ancho (el clip se ve grande y pasa de canto);
       · 'along'  → el lado largo va A LO LARGO de la tira, tumbado en su dirección de avance.
     De esa elección salen las dos cosas que quedan: el TAMAÑO (se ajusta para que el lado que cruza mida
     exactamente el ancho de la tira) y `alignBand` (a qué ángulo mira el eje ancho del clip). */
  else if(g.kind==='weave'){
    const B=Math.max(1,Math.min(12,Math.round(g.bands||4)));      // tiras por familia
    const modo=g.weaveMode||'weave';
    const fams=(modo==='h')?[0]:(modo==='v')?[90]:[0,90];
    const covDeg=curCovHalf()*R2D;                                // el radio del disco vale esto en grados
    const th=2/B, bandAng=th*covDeg;                              // grosor de la tira: en unidades del disco y en grados
    const across=(g.fit||'across')==='across';
    const dens=Math.max(0.25,Math.min(3,(g.density!=null?g.density:1)));
    /* [R247] UNA FUENTE POR TIRA, y la tira se rellena con ELLA sola. Es lo que hace que el tejido se lea como
       tejido teniendo material de proporciones distintas: dentro de una tira todos los clips miden lo mismo, así
       que encajan borde con borde y la envoltura cierra sin costura. Repartir las fuentes clip a clip —lo primero
       que hice— mezclaba un 16:9 y un 9:16 en la misma tira, con lo que el paso uniforme dejaba hueco tras uno y
       solape tras el otro, y el resultado parecía un collage en vez de una cestería.
       Las tiras van tomando fuentes por turno, así que con cuatro medios y cinco tiras se reparten y la quinta
       repite la primera. */
    const asp=(g._aspects&&g._aspects.length)?g._aspects:[Math.max(0.01,g._aspect||1)];
    let kGlobal=0;
    for(const th0 of fams){
      for(let k=0;k<B;k++,kGlobal++){
        const A=Math.max(0.01,asp[kGlobal%asp.length]);            // la proporción DE ESTA tira
        /* tamaño para que el lado que CRUZA la tira mida justo su grosor; el otro sale solo por la proporción */
        const size=across?(A>1?bandAng:bandAng*A):(A>1?bandAng*A:bandAng);
        const largoAng=(A>1)?size:size/A, cortoAng=(A>1)?size/A:size;
        const alongAng=across?cortoAng:largoAng;                   // lo que ocupa el clip EN LA DIRECCIÓN de la tira
        /* cuántos caben a lo largo para que encajen justos: el diámetro del disco son 2 unidades = 2·covDeg grados.
           `density` los aprieta (>1, se solapan) o los separa (<1, dejan aire) a propósito. */
        const objetivo=across?(th0+90):th0;                        // hacia dónde mira el lado largo
        const alignBand=((A>1)?objetivo:(objetivo-90));            // el eje ANCHO del clip (ver drawClip)
        const c0=-1+th*(k+0.5);
        /* [R247b] La tira sólo existe DENTRO del disco: su media cuerda es √(1−c²). Los clips se reparten en ese
           tramo y envuelven en él, así que la tira nace y muere en el borde del domo y no hay viaje invisible. */
        const H=Math.sqrt(Math.max(0.02,1-c0*c0));
        const alongUn=Math.max(0.02,alongAng/covDeg);              // lo que ocupa el clip, en unidades de disco
        const P=Math.max(1,Math.min(40,Math.round((2*H/alongUn)*dens)));
        for(let j=0;j<P;j++){ const a0=-H+(2*H/P)*(j+0.5);
          const nx=(th0===0)?a0:c0, ny=(th0===0)?c0:a0;
          const q=f2azelUnclamped(nx,ny);
          out.push({ az:q.az, el:q.el, size, _weave:1, _rotAlign:((alignBand%360)+360)%360,
                     _axis:(th0===0)?'fx':'fy', _dir:(g.alternate!==false&&(kGlobal%2))?-1:1,
                     _alongAng:alongAng, _band:kGlobal, _fam:th0, _src:kGlobal, _half:H }); } } } }

/* --- [R247c] retirado de drawClip: el andamiaje que sólo servía al tejido esférico --- */
  /* [R247b] La envoltura NO puede ser en ±1. Ese es el borde del CUADRADO que envuelve al disco, y una tira a
     media altura sólo cruza el círculo hasta ±√(1−y²): al llegar ahí el clip se hunde bajo el horizonte y seguía
     viajando INVISIBLE hasta dar la vuelta al cuadrado — de ahí el agujero que recorría la tira, y la sensación
     de que los clips desaparecen antes de llegar al final. Cada clip envuelve ahora en los extremos de SU cuerda
     (`bandHalf`), así que sale por un lado del disco y entra por el otro en el mismo instante: infinito de verdad.
     Sin `bandHalf` (un clip con fx/fy puesto a mano) se conserva el ±1 de antes. */
  if(c.anim&&c.anim.length){ const fdx=animOffset(c,'fx',t), fdy=animOffset(c,'fy',t);
    if(fdx||fdy){ const P=azel2f(az,el); const H=(c.props.bandHalf>0)?c.props.bandHalf:1;
      const w=(x,lim)=>{ const s=2*lim; let v=(x+lim)%s; if(v<0)v+=s; return v-lim; };
      const ax2=c.props.bandAxis, nx=(ax2==='fy')?(P[0]+fdx):w(P[0]+fdx,H), ny=(ax2==='fy')?w(P[1]+fdy,H):(P[1]+fdy);
      const q=f2azelUnclamped(nx,ny); az=q.az; el=q.el; } } // sin acotar: lo que sale del disco se va bajo el horizonte, no se apelotona en el borde
  const fr=frame(az,el); const ax=(size*0.5)*D2R, ay=ax*(m.h/m.w); // la proporción del medio manda: `ay` sale de `ax` por h/w, así que un clip NUNCA se estira ni se achata
  /* [R247] `alignBand` = a qué ángulo del plano del ojo de pez debe apuntar el eje ANCHO del clip. Existe porque el
     marco del parche sigue la ESFERA, no el plano: el eje `u` apunta al ángulo `az`, que cambia mientras el clip
     recorre una tira recta. Con un `rot` fijo, el clip iría girando solo a lo largo del viaje y la tira dejaría de
     leerse como una tira. Compensar con `alignBand − az` en el momento de dibujar lo deja alineado en todo el
     recorrido. El `rot` que ponga el usuario se SUMA, así que sigue pudiendo inclinarlo a mano. */
  const _bandRot=(c.props.alignBand!=null)?(c.props.alignBand-az):0;

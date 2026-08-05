/* [R276c] Fila «React to audio» del inspector, retirada a peticion de Beltran (la sustituye la pestana
   Reactive FX). Vivia en _renderInspectorMain, justo despues de la fila Blend. */
  // React to audio (deterministic envelope — also bakes into export)
  const rrow=document.createElement('div'); rrow.className='prow';
  rrow.innerHTML=`<span class="kf" style="cursor:default;"></span><span class="lab">${T('React to audio','Reaccionar al audio')}</span>
    <select class="selsel" id="reactSel" style="flex:1;height:18px;"><option value="none">${T('Off','No')}</option><option value="audio">${T('Pulse size','Pulsar tamaño')}</option></select>
    <input type="number" id="reactAmt" value="${c.props.reactAmt!=null?c.props.reactAmt:60}" min="0" max="100" title="${T('Amount','Cantidad')}" style="width:50px;height:18px;background:var(--s2);border:.5px solid rgba(255,255,255,0.12);border-radius:2px;color:var(--ink);text-align:center;">`;
  $('#fxRows').appendChild(rrow);
  rrow.querySelector('#reactSel').value=c.props.react||'none';
  const reReact=()=>{const cc=selClip();if(cc){pushUndo();cc.props.react=$('#reactSel').value;cc.props.reactAmt=+$('#reactAmt').value||0;render();}};
  rrow.querySelector('#reactSel').onchange=reReact; rrow.querySelector('#reactAmt').onchange=reReact;

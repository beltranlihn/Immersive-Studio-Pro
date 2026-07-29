(function(){
  var els = document.querySelectorAll('#landingOv button, #landingOv [id]');
  var out = [];
  for (var i=0;i<els.length;i++){
    var b = els[i];
    out.push((b.id||'')+'|'+(b.textContent||'').trim().slice(0,40));
  }
  return out.join('\n');
})()

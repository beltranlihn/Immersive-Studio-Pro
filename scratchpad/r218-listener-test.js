(function(){
  window.__probe = function(){};
  document.addEventListener('keydown', window.__probe, true);
  var l = getEventListeners(document).keydown || [];
  return l.length;
})()

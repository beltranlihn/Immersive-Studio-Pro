(function(){
  var before = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  var ov = document.getElementById('alertOv');
  ov.remove();
  var ev = new KeyboardEvent('keydown', {key:' ', code:'Space', bubbles:true, cancelable:true});
  document.dispatchEvent(ev);
  var after = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  return {before: before, defaultPrevented: ev.defaultPrevented, after: after};
})()

(function(){
  var before = (typeof state !== 'undefined') ? !!state.playing : null;
  var ev = new KeyboardEvent('keydown', {key:' ', code:'Space', bubbles:true, cancelable:true});
  document.dispatchEvent(ev);
  var after = (typeof state !== 'undefined') ? !!state.playing : null;
  return {before: before, after: after, defaultPrevented: ev.defaultPrevented};
})()

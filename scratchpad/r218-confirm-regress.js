(function(){
  var before = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  var result = null;
  appConfirm('R218 regression test confirm', v => { result = v; });
  var present = !!document.getElementById('confirmOv');
  var afterOpen = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  document.getElementById('cfOk').click(); // normal close path
  var afterClose = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  var stillThere = !!document.getElementById('confirmOv');
  return {before, present, afterOpen, result, afterClose, stillThere};
})()

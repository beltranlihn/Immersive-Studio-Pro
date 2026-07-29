(function(){
  var before = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  startTour('dome');
  var present = !!document.getElementById('tourOv');
  var afterOpen = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  document.getElementById('tourSkip').click(); // normal close path
  var afterClose = getEventListeners(document).keydown ? getEventListeners(document).keydown.length : 0;
  var stillThere = !!document.getElementById('tourOv');
  return {before, present, afterOpen, afterClose, stillThere};
})()

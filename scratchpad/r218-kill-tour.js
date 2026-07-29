(function(){
  var ov = document.getElementById('tourOv');
  if(!ov) return 'no tourOv';
  ov.remove(); // programmatic removal, bypassing end() — simulates the "destroyed via another path" scenario
  return 'removed, isConnected=' + ov.isConnected;
})()

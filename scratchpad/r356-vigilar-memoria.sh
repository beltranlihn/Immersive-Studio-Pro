#!/bin/zsh
# muestrea la memoria por TIPO de proceso hasta que el renderer desaparezca
for i in {1..200}; do
  T=$(date +%H:%M:%S)
  LINE=$(ps -Ao rss,command | grep "Immersive Studio Pro" | grep -v grep | awk '
    { rss=$1; tipo="main";
      if (index($0,"type=renderer")) tipo="renderer";
      else if (index($0,"type=gpu-process")) tipo="gpu";
      else if (index($0,"type=utility")) tipo="utility";
      else if (index($0,"type=network")) tipo="network";
      else if (index($0,"type=audio")) tipo="audio";
      s[tipo]+=rss; tot+=rss }
    END { printf "renderer=%.2f gpu=%.2f utility=%.2f otros=%.2f TOTAL=%.2f", s["renderer"]/1048576, s["gpu"]/1048576, s["utility"]/1048576, (s["main"]+s["network"]+s["audio"])/1048576, tot/1048576 }')
  HAYR=$(ps -Ao command | grep "Immersive Studio Pro" | grep -c "type=renderer")
  echo "$T $LINE  (procesos renderer: $HAYR)"
  if [ "$i" -gt 4 ] && [ "$HAYR" -eq 0 ]; then echo ">>> EL RENDERER HA DESAPARECIDO <<<"; break; fi
  sleep 3
done

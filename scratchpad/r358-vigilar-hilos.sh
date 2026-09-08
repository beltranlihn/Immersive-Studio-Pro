#!/bin/zsh
for i in {1..120}; do
  PID=$(ps -Ao pid,command | grep "Immersive Studio Pro" | grep -v grep | grep "type=renderer" | awk '{print $1}' | head -1)
  if [ -z "$PID" ]; then echo "$(date +%H:%M:%S) sin renderer"; [ "$i" -gt 4 ] && { echo ">>> RENDERER MUERTO <<<"; break; }; sleep 3; continue; fi
  NH=$(ps -M "$PID" 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
  RSS=$(ps -o rss= -p "$PID" | tr -d ' ')
  echo "$(date +%H:%M:%S) hilos=$NH rss=$(echo "scale=2;$RSS/1048576"|bc)GB"
  sleep 3
done

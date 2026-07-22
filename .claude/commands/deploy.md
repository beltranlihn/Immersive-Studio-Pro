---
description: Build del .exe, deploy a las 3 instalaciones y push a GitHub
---

Compila el `.exe`, deploya el `app.asar` a las 3 instalaciones y pushea a GitHub. Esto SÍ se ejecuta solo cuando el usuario lo pide.

Pasos:
1. **Verificar antes de compilar:** `node --check app.js && node --check main.js`. Si falla, PARA y avisa.
2. **Commit local** de cualquier cambio pendiente (ver `/commit`) si el árbol no está limpio.
3. **Matar TODAS las instancias** de la app antes de tocar los asar (single-instance re-enfoca la ventana vieja):
   ```
   Get-Process | Where-Object { $_.ProcessName -like '*Immersive*' -or $_.ProcessName -like '*Dome*' -or $_.ProcessName -like 'electron' } | Stop-Process -Force -ErrorAction SilentlyContinue
   ```
4. **Build:** `npm run dist` (electron-builder → `dist/win-unpacked/…`).
5. **Deploy del `app.asar`** (`dist\win-unpacked\resources\app.asar`) a las 3 instalaciones:
   - `C:\Users\beltr\AppData\Local\Programs\Immersive Studio Pro\resources\app.asar`  ← canónica
   - `C:\Users\beltr\AppData\Local\Programs\dome studio pro\resources\app.asar`  ← legacy
   - `C:\Program Files\Dome Studio Pro\resources\app.asar`  ← legacy (requiere elevación: `Start-Process powershell -Verb RunAs`)
   - Si hay `.node` en `app.asar.unpacked` (NDI/Spout), copiar también esa carpeta, no solo el asar.
6. **Push:** `git push` a `github.com/beltranlihn/Immersive-Studio-Pro` (`main`).
7. Reporta: hash del commit pusheado, tamaño del asar, y confirmación de las 3 copias + push OK.

Recordatorios:
- Nada de flags Chromium agresivos (ponen el 3D negro).
- El deploy con `&` estilo bash rompe PowerShell; usar `;` o `if ($?) { }`.
- No `--no-verify` ni saltarse hooks salvo que el usuario lo pida.

Argumentos opcionales (`$ARGUMENTS`): si el usuario pide "sin push" o "solo build", ajusta y salta ese paso.

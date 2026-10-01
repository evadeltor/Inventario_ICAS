# Publicar Inventario PCB en GitHub Pages (gratis)

1. Crea una cuenta en https://github.com (si no tienes).
2. Pulsa **New repository** → nombre `inventario-pcb` → Public → **Create repository**.
3. En el repositorio: **Add file › Upload files** y arrastra TODO el contenido de esta carpeta (incluida la carpeta `_ds`). **Commit changes**.
4. **Settings › Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → **Save**.
5. En 1–2 minutos la app estará en `https://TU-USUARIO.github.io/inventario-pcb/`.
6. Abre esa dirección en el móvil con cobertura → menú del navegador → **Añadir a pantalla de inicio**.
7. En el proyecto, abre **Cartel QR**, pon esa dirección en *appUrl* e imprímelo.
8. Conecta la hoja de Google desde *Inventario › Hoja de cálculo* (instrucciones dentro de la app).

Para actualizar la app más adelante, sube de nuevo los archivos cambiados y cambia `pcbinv-v1` por `pcbinv-v2` en `sw.js` para que los móviles descarguen la versión nueva.

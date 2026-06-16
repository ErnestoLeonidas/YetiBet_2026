# YetiBet Apps Script

## Flujo simple

1. Copia los archivos `.gs` y `.html` en el proyecto de Apps Script vinculado al Google Sheet.
   El codigo ya apunta al spreadsheet `17cxW60GGFbIVhXzJFFe3ZwDi6vwv8mRwlCirrDnoq4k`.
2. Ejecuta `inicializarHoja()` una vez para crear `Resultados` y `Cartillas`.
   La pestaña `Resultados` se genera desde `openfootball/worldcup.json`.
3. Ejecuta `actualizarResultados()` o usa el menu `Polla > Actualizar resultados ahora`.
   El script lee marcadores desde `openfootball/worldcup.json` en GitHub.
4. Si un marcador no existe en el JSON, puedes escribir manualmente `GolesLocal` y `GolesVisita` en `Resultados` y volver a ejecutar `actualizarResultados()`.
5. Publica como Web App y usa la URL `/exec` en `app.js`.

## API que usa la web

- `?recurso=todo` devuelve `{ actualizado, partidos, cartillas }`.
- `?recurso=partidos` devuelve solo partidos.
- `?recurso=cartillas` devuelve solo cartillas.
- `?grupo=A` o `?partido=1` filtran partidos.

## Carga de cartillas

El modal lee el `.xlsx` en el navegador y envia solo las predicciones a Apps Script. No requiere que el archivo exista en el servidor ni en Apps Script.

`Drive API` solo es necesaria si decides usar las funciones legacy de conversion server-side (`procesarExcel` / `procesarArchivoDrive`).

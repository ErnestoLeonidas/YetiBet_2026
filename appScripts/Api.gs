/**
 * ============================================================
 *  API.GS — API JSON extendida para YetiBet 2026
 * ============================================================
 *  ⚠️ IMPORTANTE: ELIMINA la función doGet() que está en
 *  Code.gs (solo puede existir un doGet por proyecto).
 *  Este doGet la reemplaza y agrega las cartillas.
 *
 *  Endpoints:
 *    .../exec                    → partidos (compatibilidad)
 *    .../exec?recurso=todo       → partidos + cartillas  ← usa esto el sitio
 *    .../exec?recurso=cartillas  → solo cartillas
 *    .../exec?grupo=A            → partidos del grupo A
 *    .../exec?partido=19         → un partido
 *
 *  Después de agregar este archivo: Implementar →
 *  Administrar implementaciones → ✏️ → Nueva versión.
 *  (Si no creas nueva versión, la URL sigue sirviendo el código viejo.)
 * ============================================================
 */

function doGet(e) {
  var recurso = (e && e.parameter && e.parameter.recurso) || 'partidos';
  var salida = { actualizado: new Date().toISOString() };

  if (recurso === 'todo' || recurso === 'partidos') {
    salida.partidos = obtenerPartidosJson();
  }
  if (recurso === 'todo' || recurso === 'cartillas') {
    salida.cartillas = obtenerCartillasJson();
  }

  // filtros opcionales sobre partidos
  if (salida.partidos && e && e.parameter) {
    if (e.parameter.grupo) {
      salida.partidos = salida.partidos.filter(function(p) {
        return String(p.grupo).toUpperCase() === e.parameter.grupo.toUpperCase();
      });
    }
    if (e.parameter.partido) {
      salida.partidos = salida.partidos.filter(function(p) {
        return String(p.partido) === String(e.parameter.partido);
      });
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(salida))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------ */
function obtenerPartidosJson() {
  var ss = obtenerSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.SHEET_NAME);
  var partidos = [];
  if (!hoja) {
    inicializarHoja();
    hoja = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  if (!hoja) return partidos;

  var datos = hoja.getDataRange().getValues();
  var ahora = new Date();
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var golesLocal = normalizarGol(f[5]);
    var golesVisita = normalizarGol(f[6]);
    var p = {
      partido: Number(f[0]),
      grupo: String(f[1]).replace(/^Grupo\s*/i, '').trim(),
      local: f[2],
      visita: f[3],
      fecha: fechaIso(f[4]),
      golesLocal: golesLocal,
      golesVisita: golesVisita,
      estado: calcularEstadoPartido(f[4], f[5], f[6], ahora),
      banderaLocal:  urlBandera(f[2]),
      banderaVisita: urlBandera(f[3])
    };
    if (p.golesLocal !== null && p.golesVisita !== null) {
      p.resultado = p.golesLocal > p.golesVisita ? 'LOCAL'
                  : p.golesLocal < p.golesVisita ? 'VISITA' : 'EMPATE';
    } else {
      p.resultado = null;
    }
    partidos.push(p);
  }
  return partidos;
}

/* ------------------------------------------------------------
 *  { "Ernesto": [ {partido, grupo, local, visita, prediccion}, ... ], ... }
 * ------------------------------------------------------------ */
function obtenerCartillasJson() {
  var ss = obtenerSpreadsheet();
  var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();
  var cartillas = {};
  if (!hoja || hoja.getLastRow() < 2) return cartillas;

  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var f = datos[i];
    var nombre = String(f[0]).trim();
    if (!nombre) continue;
    if (!cartillas[nombre]) cartillas[nombre] = [];
    cartillas[nombre].push({
      partido: Number(f[1]),
      grupo: String(f[2]).replace(/^Grupo\s*/i, '').trim(),
      local: f[3],
      visita: f[4],
      prediccion: f[5]
    });
  }
  return cartillas;
}

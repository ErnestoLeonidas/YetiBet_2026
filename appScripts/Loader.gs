/**
 * ============================================================
 *  LOADER.GS — Cargador de cartillas Excel → Google Sheets
 * ============================================================
 *  Agrega un menú "🏆 Polla" al Sheet con la opción
 *  "Cargar cartilla Excel". Abre un formulario (Bootstrap 5.3)
 *  donde se indica Nombre + archivo .xlsx, lo procesa y
 *  carga las predicciones en la hoja "Cartillas".
 *
 *  ⚙️ CONFIGURACIÓN OBLIGATORIA (1 vez):
 *  En el editor de Apps Script:
 *    Servicios (+) → "Drive API" → Agregar  (versión v3)
 *  Esto permite convertir el .xlsx a Google Sheets para leerlo.
 * ============================================================
 */

var LOADER_CONFIG = {
  HOJA_CARTILLAS: 'Cartillas',
  HOJA_ORIGEN_EXCEL: 'Calendario Fase de Grupos Mundi', // pestaña dentro del .xlsx
  TOTAL_PARTIDOS: 72
};

function abrirCargador() {
  var html = HtmlService.createHtmlOutputFromFile('cargar')
    .setWidth(560)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(html, 'Cargar cartilla');
}

/* ============================================================
 *  PROCESAR EXCEL — recibe el archivo en base64 desde el HTML
 *  1. Convierte el .xlsx a Google Sheets temporal (Drive API)
 *  2. Lee la pestaña de la cartilla
 *  3. Extrae nombre + 72 predicciones (x en LOCAL/EMPATE/VISITA)
 *  4. Escribe en la hoja "Cartillas"
 *  5. Borra el archivo temporal
 * ============================================================ */
function procesarExcel(nombre, base64, nombreArchivo) {
  var temporalId = null;
  try {
    if (!nombre || !nombre.trim()) throw new Error('Debes indicar un nombre.');
    if (!base64) throw new Error('No se recibió el archivo.');

    // 1) base64 → blob → convertir a Google Sheets
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, MimeType.MICROSOFT_EXCEL, nombreArchivo || 'cartilla.xlsx');

    var recurso = {
      name: 'TMP_cartilla_' + nombre.trim(),
      mimeType: MimeType.GOOGLE_SHEETS
    };
    var archivo = Drive.Files.create(recurso, blob);   // requiere Drive API (servicio avanzado)
    temporalId = archivo.id;

    // 2) abrir y ubicar la pestaña de la cartilla
    var ssTemp = SpreadsheetApp.openById(temporalId);
    var hojaExcel = ssTemp.getSheetByName(LOADER_CONFIG.HOJA_ORIGEN_EXCEL) || ssTemp.getSheets()[0];
    var datos = hojaExcel.getDataRange().getValues();

    // 3) extraer predicciones
    var resultado = extraerPredicciones(datos);
    if (resultado.predicciones.length === 0) {
      throw new Error('No se encontraron predicciones en el archivo. ' +
                      '¿Es el formato correcto de la cartilla?');
    }

    // nombre del formulario manda; si viene vacío en el Excel no importa
    var participante = nombre.trim();

    // 4) escribir en hoja Cartillas
    var stats = guardarCartilla(participante, resultado.predicciones);

    return {
      ok: true,
      participante: participante,
      cargadas: resultado.predicciones.length,
      sinPrediccion: resultado.sinPrediccion,
      reemplazo: stats.reemplazo
    };

  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  } finally {
    // 5) limpiar temporal
    if (temporalId) {
      try { Drive.Files.remove(temporalId); }
      catch (e2) { try { DriveApp.getFileById(temporalId).setTrashed(true); } catch (e3) {} }
    }
  }
}

/* ------------------------------------------------------------
 *  Busca la fila de encabezados ("Partido") y lee las filas
 *  siguientes: Partido | Grupo | Local | Visita | Fecha | Hora |
 *  x LOCAL | x EMPATE | x VISITA
 * ------------------------------------------------------------ */
function extraerPredicciones(datos) {
  // ubicar fila de encabezados buscando "Partido" en cualquier columna A-C
  var filaHeader = -1, colInicio = -1;
  for (var i = 0; i < Math.min(datos.length, 20); i++) {
    for (var j = 0; j < Math.min(datos[i].length, 4); j++) {
      if (String(datos[i][j]).trim().toLowerCase() === 'partido') {
        filaHeader = i; colInicio = j; break;
      }
    }
    if (filaHeader >= 0) break;
  }
  if (filaHeader < 0) throw new Error('No se encontró la fila de encabezados ("Partido").');

  // offsets relativos a la columna "Partido":
  // 0 Partido, 1 Grupo, 2 Local, 3 Visita, 4 Fecha, 5 Hora, 6 xLocal, 7 xEmpate, 8 xVisita
  var predicciones = [];
  var sinPrediccion = [];

  for (var f = filaHeader + 1; f < datos.length; f++) {
    var fila = datos[f];
    var numPartido = Number(fila[colInicio]);
    if (!numPartido || isNaN(numPartido)) continue;   // fila vacía o fin de tabla

    var marcaLocal  = String(fila[colInicio + 6] || '').trim().toLowerCase();
    var marcaEmpate = String(fila[colInicio + 7] || '').trim().toLowerCase();
    var marcaVisita = String(fila[colInicio + 8] || '').trim().toLowerCase();

    var prediccion = null;
    if (marcaLocal === 'x')       prediccion = 'LOCAL';
    else if (marcaEmpate === 'x') prediccion = 'EMPATE';
    else if (marcaVisita === 'x') prediccion = 'VISITA';

    if (!prediccion) sinPrediccion.push(numPartido);

    predicciones.push({
      partido: numPartido,
      grupo: String(fila[colInicio + 1] || '').replace(/^Grupo\s*/i, '').trim(),
      local: String(fila[colInicio + 2] || '').trim(),
      visita: String(fila[colInicio + 3] || '').trim(),
      prediccion: prediccion || ''
    });
  }

  return { predicciones: predicciones, sinPrediccion: sinPrediccion };
}

/* ------------------------------------------------------------
 *  Guarda en la hoja "Cartillas".
 *  Formato largo: una fila por (Participante, Partido).
 *  Si el participante ya existía, sus filas se reemplazan.
 * ------------------------------------------------------------ */
function guardarCartilla(participante, predicciones) {
  var ss = obtenerSpreadsheet();   // helper definido en Code.gs
  var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();

  // ¿ya existía? → borrar sus filas (recarga/corrección de cartilla)
  var reemplazo = false;
  var datos = hoja.getDataRange().getValues();
  for (var i = datos.length - 1; i >= 1; i--) {
    if (String(datos[i][0]).trim().toLowerCase() === participante.toLowerCase()) {
      hoja.deleteRow(i + 1);
      reemplazo = true;
    }
  }

  // insertar filas nuevas
  var ahora = new Date();
  var filas = predicciones.map(function(p) {
    return [participante, p.partido, p.grupo, p.local, p.visita, p.prediccion, ahora];
  });
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);

  return { reemplazo: reemplazo };
}

/* ============================================================
 *  Lista de participantes ya cargados (para mostrar en el form)
 * ============================================================ */
function listarParticipantes() {
  var ss = obtenerSpreadsheet();
  var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();
  if (!hoja || hoja.getLastRow() < 2) return [];

  var nombres = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  var unicos = {};
  nombres.forEach(function(n) { if (n[0]) unicos[n[0]] = true; });
  return Object.keys(unicos).sort();
}

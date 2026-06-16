/**
 * ============================================================
 *  LOADER.GS — Cargador de cartillas Excel → Google Sheets
 * ============================================================
 *  Agrega un menú "🏆 Polla" al Sheet con la opción
 *  "Cargar cartilla Excel". Abre un formulario (Bootstrap 5.3)
 *  donde se indica Nombre + archivo .xlsx, lo procesa y
 *  carga las predicciones en la hoja "Cartillas".
 *
 *  El flujo principal lee el .xlsx en el navegador y envia solo las
 *  predicciones a Apps Script. Drive API queda solo para funciones legacy
 *  de conversion server-side.
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
  return {
    ok: false,
    error: 'Estás ejecutando el cargador antiguo. Copia el cargar.html actualizado: ahora el Excel se lee en el navegador y debe llamar a procesarPredicciones(), no a procesarExcel().'
  };
}

function procesarPredicciones(nombre, predicciones) {
  try {
    if (!nombre || !nombre.trim()) throw new Error('Debes indicar un nombre.');
    if (!predicciones || !predicciones.length) throw new Error('No se recibieron predicciones.');

    var limpias = normalizarPrediccionesCliente(predicciones);
    if (!limpias.length) throw new Error('No se encontraron predicciones válidas.');

    var stats = guardarCartilla(nombre.trim(), limpias);
    var sinPrediccion = limpias
      .filter(function(p) { return !p.prediccion; })
      .map(function(p) { return p.partido; });

    return {
      ok: true,
      participante: nombre.trim(),
      cargadas: limpias.length,
      sinPrediccion: sinPrediccion,
      reemplazo: stats.reemplazo
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function diagnosticarCargaCartillas() {
  try {
    var ss = obtenerSpreadsheet();
    var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();
    return {
      ok: true,
      spreadsheet: ss.getName(),
      hoja: hoja.getName(),
      filas: hoja.getLastRow()
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function normalizarPrediccionesCliente(predicciones) {
  var validas = { LOCAL: true, EMPATE: true, VISITA: true, '': true };
  return predicciones.map(function(p) {
    var partido = Number(p.partido);
    if (!partido || isNaN(partido)) return null;
    var pred = String(p.prediccion || '').trim().toUpperCase();
    if (!validas[pred]) pred = '';
    return {
      partido: partido,
      grupo: String(p.grupo || '').replace(/^Grupo\s*/i, '').trim(),
      local: String(p.local || '').trim(),
      visita: String(p.visita || '').trim(),
      prediccion: pred
    };
  }).filter(Boolean);
}

function procesarArchivoDrive(nombre, archivoUrlOId) {
  var temporalId = null;
  try {
    if (!nombre || !nombre.trim()) throw new Error('Debes indicar un nombre.');

    var fileId = extraerDriveId(archivoUrlOId);
    if (!fileId) throw new Error('Pega una URL o ID válido de Google Drive / Google Sheets.');

    var file = DriveApp.getFileById(fileId);
    var mime = file.getMimeType();
    var ssTemp;

    if (mime === MimeType.GOOGLE_SHEETS || mime === 'application/vnd.google-apps.spreadsheet') {
      ssTemp = SpreadsheetApp.openById(fileId);
    } else {
      var recurso = {
        name: 'TMP_cartilla_' + nombre.trim(),
        mimeType: MimeType.GOOGLE_SHEETS
      };
      var archivo = crearSpreadsheetTemporal(recurso, file.getBlob());
      temporalId = archivo.id;
      ssTemp = abrirSpreadsheetConvertido(temporalId);
    }

    var hojaExcel = ssTemp.getSheetByName(LOADER_CONFIG.HOJA_ORIGEN_EXCEL) || ssTemp.getSheets()[0];
    var datos = hojaExcel.getDataRange().getValues();
    var resultado = extraerPredicciones(datos);

    if (resultado.predicciones.length === 0) {
      throw new Error('No se encontraron predicciones. Revisa que el archivo tenga encabezado "Partido" y marcas "x".');
    }

    var participante = nombre.trim();
    var stats = guardarCartilla(participante, resultado.predicciones);
    return {
      ok: true,
      participante: participante,
      cargadas: resultado.predicciones.length,
      sinPrediccion: resultado.sinPrediccion,
      reemplazo: stats.reemplazo
    };
  } catch (e) {
    return { ok: false, error: mensajeCargaExcel(e) };
  } finally {
    if (temporalId) {
      try { Drive.Files.remove(temporalId); }
      catch (e2) { try { DriveApp.getFileById(temporalId).setTrashed(true); } catch (e3) {} }
    }
  }
}

function extraerDriveId(valor) {
  var texto = String(valor || '').trim();
  if (!texto) return '';

  var patrones = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (var i = 0; i < patrones.length; i++) {
    var m = texto.match(patrones[i]);
    if (m) return m[1];
  }
  return '';
}

function crearSpreadsheetTemporal(recurso, blob) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.create) {
    throw new Error('Drive API no está habilitada. En Apps Script ve a Servicios (+) y agrega Drive API.');
  }

  try {
    return Drive.Files.create(recurso, blob);
  } catch (e) {
    throw new Error('No se pudo convertir el Excel con Drive API. Revisa permisos de Drive y vuelve a autorizar el script. Detalle: ' + String(e.message || e));
  }
}

function abrirSpreadsheetConvertido(fileId) {
  var ultimoError = null;

  for (var intento = 1; intento <= 8; intento++) {
    try {
      return SpreadsheetApp.openById(fileId);
    } catch (e) {
      ultimoError = e;
      Utilities.sleep(1000 + intento * 500);
    }
  }

  throw new Error('El archivo se convirtió, pero Apps Script no pudo abrirlo desde Drive. Reintenta en unos segundos o revisa permisos del archivo temporal. Detalle: ' + String(ultimoError && (ultimoError.message || ultimoError)));
}

function mensajeCargaExcel(e) {
  var msg = String(e && (e.message || e));
  if (/PERMISSION_DENIED/i.test(msg)) {
    return 'Permiso denegado al leer el Excel convertido. Revisa que Drive API esté habilitada, vuelve a autorizar el script y confirma que la implementación se ejecuta como tú.';
  }
  return msg;
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

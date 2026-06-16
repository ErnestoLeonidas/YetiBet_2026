/**
 * ============================================================
 *  ADMIN.GS — Administración de cartillas (eliminar / modificar)
 * ============================================================
 *  ⚠️ IMPORTANTE: ELIMINA la función onOpen() de Loader.gs.
 *  Este archivo trae el menú completo actualizado.
 *
 *  Archivos HTML requeridos en el proyecto:
 *    cargar.html · eliminar.html · modificar.html
 * ============================================================
 */

/* ---------- menú completo (reemplaza al de Loader.gs) ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏆 Polla')
    .addItem('📤 Cargar cartilla Excel', 'abrirCargador')
    .addSeparator()
    .addItem('🗑️ Eliminar participante', 'abrirEliminador')
    .addItem('✏️ Modificar cartilla', 'abrirModificador')
    .addSeparator()
    .addItem('🔄 Actualizar resultados ahora', 'actualizarResultados')
    .addToUi();
}

function abrirEliminador() {
  var html = HtmlService.createHtmlOutputFromFile('eliminar')
    .setWidth(480).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, 'Eliminar participante');
}

function abrirModificador() {
  var html = HtmlService.createHtmlOutputFromFile('modificar')
    .setWidth(720).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, 'Modificar cartilla');
}

/* ============================================================
 *  ELIMINAR — borra todas las filas del participante
 * ============================================================ */
function eliminarParticipante(nombre) {
  try {
    if (!nombre) throw new Error('Nombre vacío.');
    var ss = obtenerSpreadsheet();
    var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();

    var datos = hoja.getDataRange().getValues();
    var eliminadas = 0;
    for (var i = datos.length - 1; i >= 1; i--) {
      if (String(datos[i][0]).trim().toLowerCase() === nombre.trim().toLowerCase()) {
        hoja.deleteRow(i + 1);
        eliminadas++;
      }
    }
    if (!eliminadas) throw new Error('No se encontró al participante "' + nombre + '".');
    return { ok: true, eliminadas: eliminadas };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* ============================================================
 *  MODIFICAR — leer y guardar predicciones de un participante
 * ============================================================ */
function obtenerCartillaParaEditar(nombre) {
  try {
    var ss = obtenerSpreadsheet();
    var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();

    var datos = hoja.getDataRange().getValues();
    var picks = [];
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).trim().toLowerCase() === nombre.trim().toLowerCase()) {
        picks.push({
          fila: i + 1,                 // fila real en el Sheet (para escribir de vuelta)
          partido: datos[i][1],
          grupo: datos[i][2],
          local: datos[i][3],
          visita: datos[i][4],
          prediccion: datos[i][5]
        });
      }
    }
    if (!picks.length) throw new Error('Sin cartilla para "' + nombre + '".');
    picks.sort(function(a, b) { return a.partido - b.partido; });
    return { ok: true, picks: picks };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * cambios = [ {fila: 12, prediccion: 'LOCAL'}, ... ]
 * Solo se envían las filas que realmente cambiaron.
 */
function guardarCambiosCartilla(nombre, cambios) {
  try {
    if (!cambios || !cambios.length) return { ok: true, guardados: 0 };
    var ss = obtenerSpreadsheet();
    var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS) || asegurarHojaCartillas();

    var validas = ['LOCAL', 'EMPATE', 'VISITA', ''];
    var ahora = new Date();
    var guardados = 0;

    cambios.forEach(function(c) {
      if (validas.indexOf(c.prediccion) === -1) return;
      // verificación de seguridad: la fila debe pertenecer al participante
      var dueno = String(hoja.getRange(c.fila, 1).getValue()).trim().toLowerCase();
      if (dueno !== nombre.trim().toLowerCase()) return;

      hoja.getRange(c.fila, 6).setValue(c.prediccion);  // col F = Prediccion
      hoja.getRange(c.fila, 7).setValue(ahora);          // col G = FechaCarga
      guardados++;
    });

    return { ok: true, guardados: guardados };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

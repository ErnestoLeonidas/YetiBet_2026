/**
 * ============================================================
 *  POLLA MUNDIALERA 2026 — OpenFootball como fuente de verdad
 * ============================================================
 *  Fuente:
 *    https://github.com/openfootball/worldcup.json/tree/master/2026
 *
 *  La hoja Resultados se construye desde el JSON de OpenFootball.
 *  Los partidos de fase de grupos se numeran 1..72 por fecha/hora
 *  real. Los marcadores salen de `score.ft` cuando existen.
 * ============================================================
 */

var CONFIG = {
  SPREADSHEET_ID: '17cxW60GGFbIVhXzJFFe3ZwDi6vwv8mRwlCirrDnoq4k',
  SHEET_NAME: 'Resultados',
  RESULTS_SOURCE_URL: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  GROUPS_SOURCE_URL: 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.groups.json',
  FLAG_SIZE: 'w80',
  TIMEZONE: 'America/Santiago'
};

var TEAM_ES = {
  'Mexico': 'México',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Czech Republic': 'República Checa',
  'Canada': 'Canadá',
  'Bosnia & Herzegovina': 'Bosnia y Herzegovina',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'USA': 'Estados Unidos',
  'United States': 'Estados Unidos',
  'Qatar': 'Catar',
  'Switzerland': 'Suiza',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Haiti': 'Haití',
  'Scotland': 'Escocia',
  'Australia': 'Australia',
  'Turkey': 'Turquía',
  'Germany': 'Alemania',
  'Curaçao': 'Curazao',
  'Curacao': 'Curazao',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Spain': 'España',
  'Cape Verde': 'Cabo Verde',
  'Belgium': 'Bélgica',
  'Egypt': 'Egipto',
  'Saudi Arabia': 'Arabia Saudí',
  'Uruguay': 'Uruguay',
  'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Norway': 'Noruega',
  'Argentina': 'Argentina',
  'Algeria': 'Argelia',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Portugal': 'Portugal',
  'DR Congo': 'RD Congo',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Ghana': 'Ghana',
  'Panama': 'Panamá',
  'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia'
};

var TEAM_EN = invertirMapa(TEAM_ES);

var BANDERAS = {
  'México': 'mx',
  'Sudáfrica': 'za',
  'Corea del Sur': 'kr',
  'República Checa': 'cz',
  'Canadá': 'ca',
  'Bosnia y Herzegovina': 'ba',
  'Estados Unidos': 'us',
  'Paraguay': 'py',
  'Catar': 'qa',
  'Suiza': 'ch',
  'Brasil': 'br',
  'Marruecos': 'ma',
  'Haití': 'ht',
  'Escocia': 'gb-sct',
  'Australia': 'au',
  'Turquía': 'tr',
  'Alemania': 'de',
  'Curazao': 'cw',
  'Países Bajos': 'nl',
  'Japón': 'jp',
  'Costa de Marfil': 'ci',
  'Ecuador': 'ec',
  'Suecia': 'se',
  'Túnez': 'tn',
  'España': 'es',
  'Cabo Verde': 'cv',
  'Bélgica': 'be',
  'Egipto': 'eg',
  'Arabia Saudí': 'sa',
  'Uruguay': 'uy',
  'Irán': 'ir',
  'Nueva Zelanda': 'nz',
  'Francia': 'fr',
  'Senegal': 'sn',
  'Irak': 'iq',
  'Noruega': 'no',
  'Argentina': 'ar',
  'Argelia': 'dz',
  'Austria': 'at',
  'Jordania': 'jo',
  'Portugal': 'pt',
  'RD Congo': 'cd',
  'Inglaterra': 'gb-eng',
  'Croacia': 'hr',
  'Ghana': 'gh',
  'Panamá': 'pa',
  'Uzbekistán': 'uz',
  'Colombia': 'co'
};

function invertirMapa(mapa) {
  var salida = {};
  Object.keys(mapa).forEach(function(k) {
    salida[normalizarNombre(mapa[k])] = k;
  });
  return salida;
}

function obtenerSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  var props = PropertiesService.getScriptProperties();
  var idGuardado = props.getProperty('SPREADSHEET_ID');
  if (idGuardado) {
    try { return SpreadsheetApp.openById(idGuardado); } catch (e) {}
  }

  ss = SpreadsheetApp.create('Polla Mundialera 2026 - Resultados');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('Sheet creado: ' + ss.getUrl());
  return ss;
}

function inicializarHoja() {
  sincronizarCalendario(true);
}

function actualizarResultados() {
  return sincronizarCalendario(false);
}

function sincronizarCalendario(recrear) {
  var ss = obtenerSpreadsheet();
  var hoja = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  var partidos = obtenerPartidosGrupoOpenFootball();
  var existentes = recrear ? {} : leerResultadosExistentes(hoja);
  var ahora = new Date();
  var filas = [];
  var encontrados = 0;

  partidos.forEach(function(p) {
    var marcador = obtenerMarcadorFinal(p.match);
    var manual = existentes[p.n] || {};
    var golesLocal = marcador ? marcador.golesLocal : manual.golesLocal;
    var golesVisita = marcador ? marcador.golesVisita : manual.golesVisita;
    var estado = calcularEstadoPartido(p.fecha, golesLocal, golesVisita, ahora);
    if (marcador) encontrados++;

    filas.push([
      p.n,
      p.grupo,
      p.local,
      p.visita,
      p.fecha,
      valorHoja(golesLocal),
      valorHoja(golesVisita),
      estado,
      new Date()
    ]);
  });

  hoja.clear();
  var encabezados = ['Partido','Grupo','Local','Visita','Fecha','GolesLocal','GolesVisita','Estado','UltimaActualizacion'];
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.getRange(1, 1, 1, encabezados.length)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('white');
  if (filas.length) hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, encabezados.length);
  asegurarHojaCartillas();

  Logger.log('OpenFootball sincronizado. Partidos: ' + filas.length + '. Marcadores encontrados: ' + encontrados);
  return { ok: true, partidos: filas.length, encontrados: encontrados };
}

function leerResultadosExistentes(hoja) {
  var salida = {};
  if (!hoja || hoja.getLastRow() < 2) return salida;

  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var n = Number(datos[i][0]);
    if (!n) continue;
    salida[n] = {
      golesLocal: normalizarGol(datos[i][5]),
      golesVisita: normalizarGol(datos[i][6])
    };
  }
  return salida;
}

function obtenerPartidosGrupoOpenFootball() {
  var datos = cargarJson(CONFIG.RESULTS_SOURCE_URL);
  var matches = datos && datos.matches ? datos.matches : [];
  var grupos = matches.filter(function(m) {
    return /^Group\s+[A-L]$/i.test(String(m.group || ''));
  });

  grupos.sort(function(a, b) {
    return fechaMatch(a).getTime() - fechaMatch(b).getTime() ||
           normalizarNombre(a.group).localeCompare(normalizarNombre(b.group)) ||
           normalizarNombre(a.team1).localeCompare(normalizarNombre(b.team1));
  });

  return grupos.map(function(m, idx) {
    return {
      n: idx + 1,
      grupo: letraGrupo(m.group),
      local: nombreEs(m.team1),
      visita: nombreEs(m.team2),
      fecha: fechaLocal(m),
      match: m
    };
  });
}

function cargarJson(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() !== 200) {
    throw new Error('No se pudo cargar JSON (' + resp.getResponseCode() + '): ' + url);
  }
  return JSON.parse(resp.getContentText());
}

function fechaMatch(m) {
  var offset = extraerOffset(m.time);
  return new Date(m.date + 'T' + extraerHora(m.time) + ':00' + offset);
}

function fechaLocal(m) {
  return Utilities.formatDate(fechaMatch(m), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
}

function extraerHora(time) {
  var m = String(time || '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : '00:00';
}

function extraerOffset(time) {
  var m = String(time || '').match(/UTC([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return 'Z';
  var hh = ('0' + Number(m[2])).slice(-2);
  var mm = m[3] || '00';
  return m[1] + hh + ':' + mm;
}

function letraGrupo(groupName) {
  return String(groupName || '').replace(/^Group\s*/i, '').trim().toUpperCase();
}

function nombreEs(nombre) {
  return TEAM_ES[nombre] || nombre;
}

function obtenerMarcadorFinal(match) {
  if (!match || !match.score || !match.score.ft) return null;
  return {
    golesLocal: Number(match.score.ft[0]),
    golesVisita: Number(match.score.ft[1])
  };
}

function probarScrapingPartido(numeroPartido) {
  var partidos = obtenerPartidosGrupoOpenFootball();
  var partido = partidos.filter(function(p) { return p.n === Number(numeroPartido || 1); })[0];
  if (!partido) throw new Error('No existe el partido ' + numeroPartido);

  var marcador = obtenerMarcadorFinal(partido.match);
  Logger.log(marcador
    ? ('Resultado encontrado: ' + partido.local + ' ' + marcador.golesLocal + '-' + marcador.golesVisita + ' ' + partido.visita)
    : ('Sin resultado en OpenFootball: ' + partido.local + ' vs ' + partido.visita));
  return marcador;
}

function calcularEstadoPartido(fecha, golesLocal, golesVisita, ahora) {
  if (tieneValor(golesLocal) && tieneValor(golesVisita)) return 'FINALIZADO';
  var inicio = parseFecha(fecha);
  if (!inicio) return 'PENDIENTE';
  return ahora.getTime() > inicio.getTime() + 2 * 60 * 60 * 1000 ? 'SIN RESULTADO' : 'PENDIENTE';
}

function tieneValor(valor) {
  if (valor === '' || valor === null || valor === undefined) return false;
  return !isNaN(Number(valor));
}

function valorHoja(valor) {
  return tieneValor(valor) ? Number(valor) : '';
}

function normalizarGol(valor) {
  return tieneValor(valor) ? Number(valor) : null;
}

function parseFecha(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
  if (!valor) return null;

  var texto = String(valor).trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(texto)) texto += ':00';

  var fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? null : fecha;
}

function fechaIso(valor) {
  var fecha = parseFecha(valor);
  return fecha ? fecha.toISOString() : '';
}

function urlBandera(equipo) {
  var codigo = BANDERAS[equipo];
  return codigo ? 'https://flagcdn.com/' + CONFIG.FLAG_SIZE + '/' + codigo + '.png' : null;
}

function normalizarNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function asegurarHojaCartillas() {
  var ss = obtenerSpreadsheet();
  var hoja = ss.getSheetByName(LOADER_CONFIG.HOJA_CARTILLAS);
  if (hoja) return hoja;

  hoja = ss.insertSheet(LOADER_CONFIG.HOJA_CARTILLAS);
  var enc = ['Participante','Partido','Grupo','Local','Visita','Prediccion','FechaCarga'];
  hoja.appendRow(enc);
  hoja.getRange(1, 1, 1, enc.length)
      .setFontWeight('bold')
      .setBackground('#0d6efd')
      .setFontColor('white');
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, enc.length);
  return hoja;
}

function crearTriggerHorario() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'actualizarResultados') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('actualizarResultados').timeBased().everyHours(1).create();
  Logger.log('Trigger simple creado: actualizarResultados() cada 1 hora.');
}

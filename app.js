/* ============================================================
   YetiBet 2026 — datos y helpers compartidos
   ============================================================ */

/* 👉 PEGA AQUÍ la URL de tu Web App de Apps Script (termina en /exec) */
const API_URL = 'https://script.google.com/macros/s/AKfycbyWqQv5wXPwOOMqUfqsUghXZDCbCOlle20upDgOBmRnYdR_BqlupxlzBaOL0sJ_gUtI/exec';

/* Puntos por acierto 1X2 (regla de la polla) */
const PUNTOS_POR_ACIERTO = 3;

const CACHE_KEY = 'yetibet_datos';
const CACHE_MS = 2 * 60 * 1000;   // 2 minutos

/* ------------------------------------------------------------
   Trae {partidos, cartillas} desde Apps Script (con caché corto)
------------------------------------------------------------ */
async function cargarDatos(forzar = false) {
  if (!forzar) {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - c.t < CACHE_MS) return c.datos;
    }
  }
  const resp = await fetch(API_URL + '?recurso=todo');
  if (!resp.ok) throw new Error('No se pudo conectar con la API (' + resp.status + ')');
  const datos = await resp.json();
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), datos }));
  return datos;
}

/* ------------------------------------------------------------
   Ranking: por participante, cuenta aciertos sobre partidos
   FINALIZADOS y calcula puntos
------------------------------------------------------------ */
function calcularRanking(datos) {
  const resultadoPorPartido = {};
  datos.partidos.forEach(p => {
    if (p.estado === 'FINALIZADO' && p.resultado) resultadoPorPartido[p.partido] = p.resultado;
  });

  const tabla = Object.entries(datos.cartillas || {}).map(([nombre, picks]) => {
    let aciertos = 0, evaluados = 0;
    picks.forEach(pk => {
      const real = resultadoPorPartido[pk.partido];
      if (!real || !pk.prediccion) return;
      evaluados++;
      if (pk.prediccion === real) aciertos++;
    });
    return {
      nombre,
      aciertos,
      evaluados,
      puntos: aciertos * PUNTOS_POR_ACIERTO,
      efectividad: evaluados ? Math.round(aciertos / evaluados * 100) : 0
    };
  });

  tabla.sort((a, b) => b.puntos - a.puntos || b.efectividad - a.efectividad || a.nombre.localeCompare(b.nombre));
  return tabla;
}

/* ------------------------------------------------------------ helpers UI */
function badgePred(pred) {
  if (!pred) return '<span class="text-muted small">—</span>';
  const clase = pred.toLowerCase();
  const texto = pred === 'LOCAL' ? 'L' : pred === 'EMPATE' ? 'E' : 'V';
  return `<span class="pred ${clase}" title="${pred}">${texto}</span>`;
}

function imgBandera(url, alt) {
  return url
    ? `<span class="lamina"><img src="${url}" alt="${alt}" width="34" height="24" loading="lazy"></span>`
    : '';
}

function fechaCorta(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) +
         ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function mostrarError(contenedor, mensaje) {
  contenedor.innerHTML = `
    <div class="alert alert-warning my-4">
      <b>No se pudieron cargar los datos.</b><br>${mensaje}<br>
      <span class="small">Revisa que la URL de la API esté configurada en <code>app.js</code>.</span>
    </div>`;
}

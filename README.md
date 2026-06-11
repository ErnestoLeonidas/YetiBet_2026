# ❄️⚽ YetiBet 2026

**La polla mundialera de México, Canadá y Estados Unidos 2026.**

72 partidos de fase de grupos, una cartilla, cero excusas. YetiBet permite a un grupo de amigos competir prediciendo el resultado 1X2 de cada partido del Mundial, con ranking en vivo, revisión de cartillas y los marcadores actualizados automáticamente.

## 🌐 Ver en línea

👉 **[https://TU_USUARIO_GITHUB.github.io/TU_REPO/](https://TU_USUARIO_GITHUB.github.io/TU_REPO/)**

## 🏔️ Qué incluye

| Página | Descripción |
|---|---|
| **Inicio** | Estadísticas en vivo, últimos marcadores y próximos partidos |
| **Ranking** | Pizarra de posiciones: aciertos, partidos evaluados, efectividad y puntos (3 pts por acierto 1X2) |
| **Cartillas** | La cartilla de cada participante, comparada acierto por acierto contra los resultados reales |
| **Resultados** | Los marcadores del Mundial, grupo por grupo (A–L) |

## ⚙️ Arquitectura

```
Google Apps Script (scraper + API)
  ├── Cada partido tiene un trigger ~15 min después del pitazo final
  ├── Scrapea el marcador y lo guarda en Google Sheets
  ├── Las cartillas se cargan subiendo el Excel desde un formulario en el Sheet
  └── doGet() publica todo como JSON
            ↓
GitHub Pages (este repo)
  └── HTML + CSS + JS estático (Bootstrap 5.3) que consume el JSON
```

- **Sin servidor propio**: Google hostea la API, GitHub hostea el frontend.
- **Banderas**: [flagcdn.com](https://flagcdn.com), tratadas como láminas de álbum 📋.
- **Datos**: caché de 2 minutos en `sessionStorage` para no saturar la API.

## 🛠️ Configuración

1. Despliega el Apps Script (Web App, acceso: cualquier persona) y copia la URL `/exec`
2. Pégala en la primera línea de [`app.js`](app.js):
   ```js
   const API_URL = 'https://script.google.com/macros/s/TU_ID/exec';
   ```
3. Activa GitHub Pages: *Settings → Pages → Deploy from branch → main /(root)*

## 📊 Reglas de la polla

- Cada participante marca **L / E / V** (Local, Empate, Visita) en los 72 partidos
- **3 puntos por acierto** (configurable en `app.js` → `PUNTOS_POR_ACIERTO`)
- Solo cuentan partidos finalizados; los desempates van por efectividad

---

<p align="center">
  <a href="https://github.com/TU_USUARIO_GITHUB">🪽🩸🪽 Forjado en Baal | Ernesto Velasquez</a>
</p>

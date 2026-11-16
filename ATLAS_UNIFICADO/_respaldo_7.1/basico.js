/* Phyllobytes · versión para principiantes.
 *
 * Usa el MISMO servidor y el MISMO análisis que la versión para expertos (POST /api/start, GET /api/status):
 * aquí no se calcula ninguna estadística nueva, solo se eligen valores habituales por defecto
 * (1 lugar, satélite IMERG, 20 años, día lluvioso ≥ 1 mm) y se presentan pocos resultados en palabras sencillas.
 * Lo único que se cuenta en el navegador son los días que superan 50/100/150/200/300 mm, a partir de la serie
 * diaria real que devuelve el servidor (nunca se inventan datos: sin servidor no hay resultado).
 */
(function () {
"use strict";
const { t, aplicar, setLang, onLang, getLang } = PHY.i18n;
const { $, el, ESTADO, fmt } = PHY.util;
const a11y = PHY.a11y;
const FIN = new Date().getFullYear() - 1;                       // último año completo
const MINIMO = { gpm: 2001, chirps_auto: 1981, era5: 1981 };    // «Todos»: desde aquí (ERA5 se limita a 1981 para no tardar)
const CAPITALES = [
  { pais: "Guatemala", name: "Ciudad de Guatemala", lat: 14.634, lon: -90.507 },
  { pais: "Belize", name: "Belmopán", lat: 17.251, lon: -88.759 },
  { pais: "El Salvador", name: "San Salvador", lat: 13.692, lon: -89.218 },
  { pais: "Honduras", name: "Tegucigalpa", lat: 14.072, lon: -87.192 },
  { pais: "Nicaragua", name: "Managua", lat: 12.114, lon: -86.236 },
  { pais: "Costa Rica", name: "San José", lat: 9.935, lon: -84.091 },
  { pais: "Panama", name: "Ciudad de Panamá", lat: 8.983, lon: -79.517 },
];
const NIVELES = [50, 100, 150, 200, 300];
const S = { lugar: null, anios: "20", manual: false, resultado: null, servidor: false, mapa: null, marcador: null, fronteras: null, ocupado: false };
let asistente;

/* ---------- utilidades ---------- */
const lento = () => document.documentElement.dataset.movimiento === "reducido" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ir = (id) => $(id)?.scrollIntoView({ behavior: lento() ? "auto" : "smooth", block: "start" });
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const pais = (id) => (id ? window.atlasNombrePais(id) : "");
const meses = () => t("bs.months").split(",");
const mesesLargos = () => t("bs.months_long").split(",");
const traducirServidor = (s) => (getLang() === "en" && PHY.traductor ? PHY.traductor.traducir(String(s)) : String(s));
function fecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(getLang() === "en" ? "en-GB" : "es-CR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const redondo = (n) => (n >= 1000 ? Math.round(n / 10) * 10 : Math.round(n));

/* ---------- servidor ---------- */
async function revisarServidor() {
  S.servidor = false;
  if (location.protocol.startsWith("http")) {
    try { const r = await fetch("/api/health", { cache: "no-store" }); const h = await r.json(); S.servidor = r.ok && h.status === "ok"; } catch { /* sin servidor */ }
  }
  const chip = $("chip-servidor");
  chip.classList.toggle("ok", S.servidor);
  chip.querySelector("span").textContent = t(S.servidor ? "srv.ok" : "srv.off");
  $("aviso-servidor").hidden = S.servidor;
}

/* ---------- paso 2: años ---------- */
function periodo() {
  const fuente = $("fuente").value, min = MINIMO[fuente] ?? 2001;
  if (S.manual) return [+$("desde").value, +$("hasta").value];
  const n = S.anios === "todos" ? FIN - min + 1 : +S.anios;
  return [Math.max(min, FIN - n + 1), FIN];
}
function pintarPeriodos() {
  const min = MINIMO[$("fuente").value] ?? 2001;
  document.querySelectorAll("#periodos button").forEach((b) => {
    const n = b.dataset.anios === "todos" ? FIN - min + 1 : +b.dataset.anios;
    b.querySelector(".rango").textContent = t("bs.p2.range", { a: Math.max(min, FIN - n + 1), b: FIN });
    b.setAttribute("aria-checked", String(!S.manual && b.dataset.anios === S.anios));
  });
  if (!S.manual) { const [a, b] = periodo(); $("desde").value = a; $("hasta").value = b; }
  $("desde").min = min;
}

/* ---------- paso 1: lugar ---------- */
async function elegir(p) {
  const lat = +p.lat, lon = +p.lon;
  S.lugar = { name: p.name, lat, lon, ok: false, pais: null, km: null };
  const caja = $("elegido");
  caja.className = "bs-elegido";
  caja.replaceChildren(el("span", {}, t("bs.p1.checking")));
  marcar(lat, lon);
  document.querySelectorAll("#capitales button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === p.name)));
  if (!S.servidor) { caja.replaceChildren(el("span", {}, t("bs.run.need_server"))); return; }
  try {
    const qs = new URLSearchParams({ lat, lon, source: $("fuente").value, area: "cell" });
    const r = await fetch("/api/cell?" + qs); const d = await r.json();
    if (S.lugar?.lat !== lat || S.lugar?.lon !== lon) return;      // el usuario ya eligió otro
    if (!r.ok) throw Error(d.error || "");
    const c = d.cell || {};
    S.lugar.ok = !!d.accepted; S.lugar.pais = d.country || null;
    S.lugar.km = c.available ? `${fmt(c.width_km, 0)} × ${fmt(c.height_km, 0)}` : null;
    pintarElegido();
  } catch (e) {
    caja.className = "bs-elegido mal";
    caja.replaceChildren(el("span", {}, traducirServidor(e.message || t("bs.err.p"))));
  }
}
function pintarElegido() {
  const L = S.lugar, caja = $("elegido");
  if (!L) { caja.className = "bs-elegido"; caja.replaceChildren(el("span", {}, t("bs.p1.none"))); return; }
  if (!L.ok) { caja.className = "bs-elegido mal"; caja.replaceChildren(el("b", { "aria-hidden": "true" }, "✕"), el("span", {}, t("bs.p1.bad"))); return; }
  caja.className = "bs-elegido bien";
  caja.replaceChildren(el("b", { "aria-hidden": "true" }, "✓"), el("span", {}, t("bs.p1.ok", { lugar: L.name, pais: pais(L.pais), km: L.km ?? "—" })));
}
function pintarCapitales() {
  $("capitales").replaceChildren(...CAPITALES.map((c) => el("button", { type: "button", class: "bs-chip", "data-name": c.name, "aria-pressed": String(S.lugar?.name === c.name), onclick: () => elegir(c) },
    el("strong", {}, c.name), el("small", {}, pais(c.pais)))));
}
async function buscar(ev) {
  ev.preventDefault();
  const q = $("buscar").value.trim();
  if (q.length < 3) return;
  if (!S.servidor) { $("elegido").replaceChildren(el("span", {}, t("bs.run.need_server"))); return; }
  $("elegido").className = "bs-elegido"; $("elegido").replaceChildren(el("span", {}, t("bs.p1.checking")));
  try {
    const r = await fetch("/api/geocode?name=" + encodeURIComponent(q)); const d = await r.json();
    if (!r.ok) throw Error();
    await elegir({ name: d.name || q, lat: d.lat, lon: d.lon });
    S.mapa?.setView([+d.lat, +d.lon], 9);
  } catch { $("elegido").className = "bs-elegido mal"; $("elegido").replaceChildren(el("span", {}, t("bs.p1.notfound"))); }
}
async function cargarLugares() {
  if (!S.servidor) return;
  try { const r = await fetch("/api/places"); const d = await r.json(); $("lugares").replaceChildren(...(d.places || []).map((p) => el("option", { value: p.name }))); } catch { /* opcional */ }
}

/* ---------- mapa (Leaflet + OpenStreetMap, igual que la versión experta) ---------- */
const CA = ["Guatemala", "Belize", "El Salvador", "Honduras", "Nicaragua", "Costa Rica", "Panama"];
function marcar(lat, lon) {
  if (!S.mapa || !window.L) return;
  if (S.marcador) S.marcador.setLatLng([lat, lon]);
  else S.marcador = L.circleMarker([lat, lon], { radius: 9, color: "#ffffff", weight: 2, fillColor: "#ff8a24", fillOpacity: 1 }).addTo(S.mapa);
}
function crearMapa() {
  if (!window.L || S.mapa) return;
  const m = L.map("bs-mapa", { zoomControl: true, scrollWheelZoom: false, minZoom: 5, maxBounds: [[3, -97], [21.5, -74]] }).setView([12.6, -85.5], 6);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 13, attribution: "© OpenStreetMap" }).addTo(m);
  m.on("click", (e) => elegir({ name: `${t("bs.p1.point")} (${e.latlng.lat.toFixed(2)}, ${e.latlng.lng.toFixed(2)})`, lat: e.latlng.lat, lon: e.latlng.lng }));
  m.on("focus click", () => m.scrollWheelZoom.enable());
  S.mapa = m;
  if (S.fronteras) dibujarFronteras();
  if (S.lugar) marcar(S.lugar.lat, S.lugar.lon);
}
function dibujarFronteras() {
  if (!S.mapa || !window.L || !S.fronteras) return;
  L.geoJSON(S.fronteras, { interactive: false, style: (f) => CA.includes(f.properties.name) ? { color: "#6cc8e8", weight: 1.6, fillColor: "#6cc8e8", fillOpacity: 0.06 } : { color: "#8a97a8", weight: 0.8, fillColor: "#55606e", fillOpacity: 0.25 } }).addTo(S.mapa);
}
function cargarLeaflet() {
  const s = document.createElement("script");
  s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.async = true; s.onload = crearMapa;
  document.head.appendChild(s);
}
async function cargarFronteras() {
  try { const r = await fetch("assets/borders.geojson"); S.fronteras = await r.json(); heroMapa(S.fronteras); dibujarFronteras(); } catch { /* sin servidor: no hay mapa pequeño */ }
}
function heroMapa(countries) {
  const NS = "http://www.w3.org/2000/svg", E = (tag, at = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); return e; };
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
  const lon0 = -92.6, lon1 = -76.8, lat0 = 7.0, lat1 = 18.6, W = 1000, H = Math.round(((merc(lat1) - merc(lat0)) / (lon1 - lon0)) * W);
  const P = (lon, lat) => [((lon - lon0) / (lon1 - lon0)) * W, ((merc(lat1) - merc(lat)) / (merc(lat1) - merc(lat0))) * H];
  const ruta = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((poly) => poly.map((ring) => "M" + ring.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(",")).join("L") + "Z").join("")).join("");
  const svg = E("svg", { viewBox: `0 0 ${W} ${H}`, class: "hero-ca", role: "group" });
  svg.setAttribute("aria-label", t("bs.hero.note"));
  const vecinos = E("g", { class: "hero-vecinos", "aria-hidden": "true" }), paises = E("g", { class: "hero-paises" });
  for (const f of countries.features) {
    const nombre = f.properties.name, path = E("path", { d: ruta(f.geometry) });
    if (!CA.includes(nombre)) { vecinos.append(path); continue; }
    Object.entries({ class: "hero-pais", tabindex: "0", role: "button" }).forEach(([k, v]) => path.setAttribute(k, v));
    const tit = E("title"); tit.textContent = pais(nombre); path.append(tit); path.dataset.pais = nombre;
    const go = () => { const c = CAPITALES.find((x) => x.pais === nombre); if (c) elegir(c); ir("mapa-seccion"); if (S.mapa && window.L) try { S.mapa.fitBounds(L.geoJSON(f).getBounds(), { padding: [20, 20] }); } catch { /* */ } };
    path.addEventListener("click", go);
    path.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    paises.append(path);
  }
  svg.append(vecinos, paises);
  $("hero-mapa").replaceChildren(el("div", { class: "hero-mapa-caja" }, svg, el("img", { class: "marca-agua marca-agua-mapa mini", src: "assets/marca-agua.png", alt: "", "aria-hidden": "true", draggable: "false" })));
}

/* ---------- paso 3: análisis (mismo servidor que la versión experta) ---------- */
function mensaje(tipo, titulo, texto) {
  const e = $("estado"); e.hidden = false; e.className = "status-card " + tipo;
  e.replaceChildren(el("span", { class: "status-icon", "aria-hidden": "true" }, tipo === "error" ? "!" : tipo === "progress" ? "◌" : "i"), el("div", {}, el("strong", {}, titulo), el("p", {}, texto)));
}
function ocupado(b) { S.ocupado = b; $("ver").disabled = b; $("ver").firstElementChild.textContent = t(b ? "bs.run.busy" : "bs.run"); }
async function ver() {
  if (S.ocupado) return;
  if (!S.servidor) return mensaje("error", t("bs.err.t"), t("bs.run.need_server"));
  if (!S.lugar || !S.lugar.ok) { mensaje("error", t("bs.err.t"), t(S.lugar ? "bs.p1.bad" : "bs.run.need_place")); return ir("mapa-seccion"); }
  const [y0, y1] = periodo();
  if (!Number.isFinite(y0) || !Number.isFinite(y1) || y1 - y0 < 9 || y0 < (MINIMO[$("fuente").value] ?? 1981) || y1 > FIN + 1) return mensaje("error", t("bs.err.t"), t("bs.run.years_bad"));
  const datos = { source: $("fuente").value, start_year: y0, end_year: y1, ref_start: y0, ref_end: Math.min(y0 + 19, y1), wet_min: 1, population: "wet", area_mode: "cell", robustness: "off",
    points: [{ name: S.lugar.name, lat: S.lugar.lat, lon: S.lugar.lon }] };
  ocupado(true);
  const t0 = Date.now();
  const tic = () => mensaje("progress", t("bs.wait.t"), `${t("bs.wait.p")} ${t("bs.wait.time", { s: Math.round((Date.now() - t0) / 1000) })}`);
  tic();
  try {
    const r = await fetch("/api/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
    const p = await r.json(); if (!r.ok) throw Error(p.error || t("bs.err.p"));
    for (;;) {
      await new Promise((ok) => setTimeout(ok, 1200));
      const rs = await fetch("/api/status?id=" + encodeURIComponent(p.job_id)); const job = await rs.json();
      if (!rs.ok) throw Error(job.error || t("bs.err.p"));
      if (job.state === "error") throw Error(job.error || t("bs.err.p"));
      if (job.state === "done") { S.resultado = job.result; break; }
      tic();
    }
    $("estado").hidden = true;
    pintarResultado();
    ir("resultados");
  } catch (e) {
    mensaje("error", t("bs.err.t"), traducirServidor(e.message || t("bs.err.p")));
  } finally { ocupado(false); }
}

/* ---------- resultado en palabras sencillas ---------- */
const estadoDe = (tr) => tr?.estado || (tr?.slope_per_decade == null ? "datos_insuficientes" : "no_concluyente");
const CONFIG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["zoom2d", "pan2d", "select2d", "lasso2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d", "hoverClosestCartesian", "hoverCompareCartesian", "toggleSpikelines"], toImageButtonOptions: { format: "png", scale: 2, filename: "Phyllobytes_lluvia" } };
function base(ytitulo) {
  const letra = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  return { height: 300, margin: { l: 58, r: 16, t: 18, b: 44 }, font: { size: 14 * letra }, showlegend: false, bargap: 0.25,
    xaxis: { fixedrange: true, showgrid: false, linecolor: "rgba(255,255,255,.3)" },
    yaxis: { fixedrange: true, title: { text: ytitulo, font: { size: 13 * letra } }, gridcolor: "rgba(255,255,255,.09)", rangemode: "tozero" }, hovermode: "closest" };
}
function lineaPromedio(valor, texto, color) {
  return { shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: valor, y1: valor, line: { color, width: 2, dash: "dot" } }],
    annotations: [{ xref: "paper", x: 1, xanchor: "right", y: valor, yanchor: "bottom", text: texto, showarrow: false, font: { color, size: 13 }, bgcolor: "rgba(12,26,46,.75)" }] };
}
function tendencia(caja, clave, tr, frase) {
  const e = estadoDe(tr), col = { creciente: ESTADO.creciente.color, decreciente: ESTADO.decreciente.color }[e] || css("--c-nc");
  const sim = { creciente: "▲", decreciente: "▼", no_concluyente: "●", datos_insuficientes: "?" }[e];
  const titulo = frase ? t(`bs.tr.rain.${e}`) : t(`bs.tr.${e}`);
  const tituloOk = titulo.startsWith("bs.") ? t(`bs.tr.${e}`) : titulo;
  const icono = el("span", { class: "bs-tr-ico", "aria-hidden": "true" }, sim); icono.style.background = col;
  $(caja).replaceChildren(icono, el("div", {}, el("strong", {}, tituloOk), el("span", {}, t(`bs.tr.${e}.d`))));
}

function pintarResultado() {
  const R = S.resultado; if (!R) return;
  const pt = R.points[0], sm = pt.summary || {}, L = S.lugar || {};
  const anual = (pt.annual || []).filter((a) => a.total != null && a.fixed_days && a.fixed_days["50.8"] != null);
  const diario = (pt.daily || []).filter((d) => d.mm != null && Number.isFinite(+d.mm));
  const km = pt.cell_report?.cell?.available ? `${fmt(pt.cell_report.cell.width_km, 0)} × ${fmt(pt.cell_report.cell.height_km, 0)}` : "—";
  $("res-vacio").hidden = true; $("res").hidden = false;
  $("t-res").textContent = t("bs.res.h", { lugar: pt.name });
  $("res-sub").textContent = t("bs.res.sub", { pais: pais(pt.cell_report?.country), a: R.start_year, b: R.end_year, f: traducirServidor(pt.source_label || R.source_label || "") });

  /* semáforo */
  const tl = pt.traffic_light || {}, color = ["verde", "amarillo", "rojo"].includes(tl.color) ? tl.color : "amarillo";
  const motivos = [...(tl.red || []), ...(tl.yellow || [])];
  const luz = el("div", { class: "bs-luz", "aria-hidden": "true" }, ...["rojo", "amarillo", "verde"].map((c) => el("i", { class: c === color ? `on ${c}` : c })));
  const cuerpo = el("div", {}, el("p", { class: "sobretitulo" }, t("bs.tl.q")), el("h3", {}, t(`bs.tl.${color}`)), el("p", {}, t(`bs.tl.${color}.d`)));
  if (motivos.length) cuerpo.append(el("details", {}, el("summary", {}, t("bs.tl.why")), el("ul", {}, ...motivos.map((m) => el("li", {}, traducirServidor(m))))));
  $("semaforo").className = `panel bs-semaforo ${color}`; $("semaforo").replaceChildren(luz, cuerpo);

  /* tres cifras */
  const media = sm.mean_annual_mm, lluviosos = sm.dry_day_pct != null ? Math.round((100 - sm.dry_day_pct) / 10) : null;
  const max = diario.reduce((a, d) => (+d.mm > (a?.mm ?? -1) ? { mm: +d.mm, date: d.date } : a), null);
  const cifra = (titulo, valor, unidad, texto) => el("div", { class: "panel bs-cifra" }, el("p", { class: "sobretitulo" }, titulo), el("p", { class: "bs-numero" }, valor, unidad ? el("small", {}, unidad) : null), el("p", { class: "sub" }, texto));
  $("cifras").replaceChildren(
    cifra(t("bs.k.year"), fmt(redondo(media), 0), " mm", t("bs.k.year.d", { l: fmt(redondo(media), 0) })),
    cifra(t("bs.k.days"), lluviosos == null ? "—" : lluviosos >= 10 ? t("bs.k.days.all") : t("bs.k.days.v", { n: lluviosos }), "", lluviosos == null ? "" : lluviosos >= 10 ? t("bs.k.days.all.d") : t("bs.k.days.d", { n: lluviosos })),
    cifra(t("bs.k.max"), max ? fmt(max.mm, 0) : "—", " mm", max ? t("bs.k.max.d", { fecha: fecha(max.date) }) : ""));

  /* 1. meses */
  const clim = (pt.climatology || []).slice().sort((a, b) => a.month - b.month), M = meses(), ML = mesesLargos();
  const orden = clim.slice().sort((a, b) => b.mean - a.mean);
  if (orden.length >= 4) $("g1-txt").textContent = t("bs.g1.read", { a: ML[orden[0].month - 1], b: ML[orden[1].month - 1], c: ML[orden[2].month - 1], d: ML[orden[orden.length - 1].month - 1] });
  const top = new Set(orden.slice(0, 3).map((c) => c.month));
  Plotly.newPlot("g1", [{ type: "bar", x: clim.map((c) => M[c.month - 1]), y: clim.map((c) => c.mean),
    marker: { color: clim.map((c) => (top.has(c.month) ? "#6cc8e8" : "#3f6f9c")) },
    hovertemplate: clim.map((c) => t("bs.g1.hover", { m: ML[c.month - 1], v: fmt(c.mean, 0) }) + "<extra></extra>") }], base(t("bs.g1.y")), CONFIG);

  /* 2. días de lluvia fuerte (≥ 50,8 mm, el mismo umbral del análisis experto) */
  const media50 = sm.fixed_threshold_mean_days?.["50.8"];
  Plotly.newPlot("g2", [{ type: "bar", x: anual.map((a) => a.year), y: anual.map((a) => a.fixed_days["50.8"]), marker: { color: "#6cc8e8" },
    hovertemplate: anual.map((a) => t("bs.g2.hover", { y: a.year, v: a.fixed_days["50.8"] }) + "<extra></extra>") }],
    { ...base(t("bs.g2.y")), ...(media50 != null ? lineaPromedio(media50, t("bs.g2.avg", { n: fmt(media50, 1) }), "#ffb366") : {}) }, CONFIG);
  $("g2-txt").textContent = media50 != null ? t("bs.g2.read", { n: fmt(media50, 1) }) : "";
  tendencia("g2-tr", "g2", sm.fixed_threshold_trends?.["50.8"], false);

  /* 3. escala de lluvia en un día: frecuencia contada en la serie diaria real */
  const anosValidos = diario.length / 365.25, nAnos = R.end_year - R.start_year + 1;
  $("g3-sub").textContent = t("bs.g3.sub", { n: nAnos });
  const maxN = Math.max(1, ...NIVELES.map((n) => diario.filter((d) => +d.mm >= n).length));
  $("g3").replaceChildren(...NIVELES.map((n, i) => {
    const c = diario.filter((d) => +d.mm >= n).length, porAno = anosValidos > 0 ? c / anosValidos : 0;
    let frec;
    if (c === 0) frec = t("bs.fq.never", { n: nAnos });
    else if (porAno >= 1.5) frec = t("bs.fq.year", { n: fmt(porAno, porAno < 10 ? 1 : 0) });
    else if (porAno >= 0.75) frec = t("bs.fq.one");
    else frec = t("bs.fq.every", { n: fmt(1 / porAno, 0) });
    const gotas = el("span", { class: "bs-gotas", "aria-hidden": "true" }, ...NIVELES.map((_, k) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", k <= i ? "gota on" : "gota"); s.innerHTML = '<use href="#i-gota"/>'; return s; }));
    const barra = el("span", { class: "bs-barra", "aria-hidden": "true" }, el("i", { style: `width:${c ? Math.max(3, Math.sqrt(c / maxN) * 100) : 0}%` }));
    return el("li", { class: `nivel n${i + 1}` }, gotas,
      el("div", { class: "bs-nivel-txt" }, el("strong", {}, `${n} mm · ${t(`bs.lv.${n}`)}`), el("span", { class: "sub" }, t(`bs.lv.${n}.d`))),
      el("div", { class: "bs-frec" }, el("strong", {}, frec), barra, el("small", {}, t("bs.fq.count", { c }))));
  }));

  /* 4. lluvia de cada año */
  const mediaA = anual.length ? anual.reduce((s, a) => s + a.total, 0) / anual.length : null;
  Plotly.newPlot("g4", [{ type: "bar", x: anual.map((a) => a.year), y: anual.map((a) => a.total), marker: { color: "#3f6f9c" },
    hovertemplate: anual.map((a) => t("bs.g4.hover", { y: a.year, v: fmt(a.total, 0) }) + "<extra></extra>") }],
    { ...base(t("bs.g4.y")), ...(mediaA != null ? lineaPromedio(mediaA, t("bs.g4.avg", { v: fmt(redondo(mediaA), 0) }), "#ffb366") : {}) }, CONFIG);
  $("g4-txt").textContent = mediaA != null ? t("bs.g4.read", { v: fmt(redondo(mediaA), 0) }) : "";
  tendencia("g4-tr", "g4", sm.annual_trend, true);

  $("nota1").textContent = t("bs.note.1", { km });
  pintarPie();
}

/* ---------- Aprende y Método ---------- */
function pintarAprende() {
  const ico = (id) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ico"); s.setAttribute("aria-hidden", "true"); s.innerHTML = `<use href="#${id}"/>`; return s; };
  const escala = NIVELES.map((n, i) => el("li", { class: `nivel n${i + 1}` }, el("b", {}, `${n} mm`), el("div", {}, el("strong", {}, t(`bs.lv.${n}`)), el("span", { class: "sub" }, t(`bs.lv.${n}.d`)))));
  const flujo = [["i-satelite", 1], ["i-compu", 2], ["i-datos", 3]].map(([i, n]) => el("li", {}, el("span", { class: "bs-flujo-ico" }, ico(i)), el("p", {}, t(`bs.apr.flow.${n}`))));
  const gl = ["sat", "cell", "avg", "trend", "heavy"].map((k) => el("div", {}, el("dt", {}, t(`bs.apr.g.${k}.t`)), el("dd", {}, t(`bs.apr.g.${k}.d`))));
  const luz = (c, k) => el("li", {}, el("i", { class: `bs-punto ${c}`, "aria-hidden": "true" }), el("span", {}, t(k)));
  $("aprende-contenido").replaceChildren(el("div", { class: "aprende-grid bs-aprende" },
    el("div", { class: "panel bs-mm" }, el("div", { class: "bs-caja-mm", "aria-hidden": "true" }, el("span", {}, "1 m²"), el("i"), el("b", {}, "1 mm = 1 L")),
      el("div", {}, el("h3", {}, t("bs.apr.mm.h")), el("p", {}, t("bs.apr.mm.p1")), el("p", { class: "sub" }, t("bs.apr.mm.p2")))),
    el("div", { class: "panel" }, el("h3", {}, t("bs.apr.flow.h")), el("ol", { class: "bs-flujo" }, ...flujo)),
    el("div", { class: "panel g-2" }, el("h3", {}, t("bs.apr.scale.h")), el("p", { class: "sub" }, t("bs.apr.scale.p")), el("ul", { class: "bs-escala-simple" }, ...escala)),
    el("div", { class: "panel" }, el("h3", {}, t("bs.apr.tl.h")), el("ul", { class: "bs-luces" }, luz("verde", "bs.apr.tl.v"), luz("amarillo", "bs.apr.tl.a"), luz("rojo", "bs.apr.tl.r"))),
    el("div", { class: "panel" }, el("h3", {}, t("bs.apr.g.h")), el("dl", { class: "glosario" }, ...gl)),
    el("div", { class: "panel g-2 apr-cta" }, el("p", {}, t("bs.apr.cta")), el("button", { type: "button", class: "btn btn-cian", onclick: () => asistente.abrir() }, t("bs.apr.cta.btn")))));
}
function pintarMetodo() {
  $("pasos").replaceChildren(...[1, 2, 3, 4].map((n) => el("li", { class: "panel" }, el("h3", {}, t(`bs.met.${n}.t`)), el("p", {}, t(`bs.met.${n}.d`)))));
  $("lista-si").replaceChildren(...[1, 2, 3].map((n) => el("li", {}, t(`bs.met.si.${n}`))));
  $("lista-no").replaceChildren(...[1, 2, 3].map((n) => el("li", {}, t(`bs.met.no.${n}`))));
}
function pintarPie() {
  const R = S.resultado;
  $("pie-fuente").textContent = t("foot.data", { f: R ? traducirServidor(R.source_label) : "NASA POWER (IMERG), Copernicus ERA5, CHIRPS" });
}

/* ---------- asistente (el mismo de la versión experta) ---------- */
function sitios() {
  const R = S.resultado;
  if (!R) return S.lugar ? [{ id: "P1", nombre: S.lugar.name, lat: S.lugar.lat, lon: S.lugar.lon, prov: S.lugar.pais, datos: false, anios: [] }] : [];
  return R.points.map((p, i) => {
    const tr = p.summary?.extreme_count_trends?.["95"] ?? {};
    let estado = tr.estado ?? "no_concluyente"; if (!ESTADO[estado]) estado = "no_concluyente";
    const anios = (p.annual ?? []).filter((a) => a.total != null).map((a) => a.year);
    return { id: `P${i + 1}`, nombre: p.name, lat: p.lat, lon: p.lon, prov: p.cell_report?.country ?? null, datos: anios.length > 0, demo: false,
      anios: anios.length ? anios : [R.start_year, R.end_year], estado,
      tend: { pendienteDecada: tr.slope_per_decade ?? null, ic95Decada: tr.ci_low_per_decade != null ? [tr.ci_low_per_decade, tr.ci_high_per_decade] : null },
      pHolm: tr.kendall_p_holm ?? tr.kendall_p_hr ?? tr.kendall_p ?? null, umbral: p.thresholds?.["95"] ?? null, cobertura: p.summary?.coverage_pct ?? null };
  });
}

/* ---------- accesibilidad (igual que la versión experta) ---------- */
function pintarAcceso() {
  const e = a11y.leer(), p = $("panel-acceso");
  const sw = (clave, titulo, desc) => el("div", { class: "opcion" }, el("div", {}, el("strong", {}, titulo), el("small", {}, desc)),
    el("button", { type: "button", class: "interruptor", role: "switch", "aria-checked": String(!!e[clave]), "aria-label": titulo, onclick: () => { a11y.poner(clave, !a11y.leer()[clave]); pintarAcceso(); } }));
  const tam = el("div", { class: "opcion" }, el("div", {}, el("strong", {}, t("a11y.size")), el("small", {}, t("a11y.size.d"))),
    el("div", { class: "seg", role: "group", "aria-label": t("a11y.size") }, ...[[0, "A"], [1, "A+"], [2, "A++"]].map(([v, l]) => el("button", { type: "button", "aria-pressed": String(e.letra === v), "aria-label": t(`a11y.size.${v}`), onclick: () => { a11y.poner("letra", v); pintarAcceso(); } }, l))));
  p.replaceChildren(el("h3", {}, t("a11y.title")), sw("contraste", t("a11y.contrast"), t("a11y.contrast.d")), tam, sw("daltonismo", t("a11y.cvd"), t("a11y.cvd.d")), sw("movimiento", t("a11y.motion"), t("a11y.motion.d")),
    el("button", { type: "button", class: "btn btn-fantasma", onclick: () => { ["contraste", "daltonismo", "movimiento"].forEach((k) => a11y.poner(k, false)); a11y.poner("letra", 0); pintarAcceso(); } }, t("a11y.reset")));
}
function alternarAcceso(abrir) {
  const p = $("panel-acceso"); abrir = abrir ?? p.hidden; p.hidden = !abrir; $("btn-acceso").setAttribute("aria-expanded", String(abrir));
  if (abrir) { pintarAcceso(); p.querySelector("button")?.focus(); }
}

/* ---------- navegación (igual que la versión experta) ---------- */
function navegacion() {
  const enlaces = [...document.querySelectorAll(".lateral-nav a.item, .pildoras a")];
  const io = new IntersectionObserver((es) => { for (const x of es) if (x.isIntersecting) enlaces.forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === `#${x.target.id}`)); }, { rootMargin: "-40% 0px -55% 0px" });
  ["inicio", "mapa-seccion", "resultados", "aprende", "metodo"].map((i) => $(i)).forEach((s) => io.observe(s));
  const lat = $("lateral"), velo = $("velo"), raiz = document.documentElement, CLAVE = "phy-lateral";
  const esMovil = () => window.matchMedia("(max-width: 1099px)").matches;
  let modo = "completo";
  try { const g = localStorage.getItem(CLAVE); if (["completo", "mini", "oculto"].includes(g)) modo = g; } catch { /* */ }
  const rotular = () => {
    lat.querySelectorAll("a.item, button.item").forEach((x) => x.setAttribute("title", modo === "mini" ? x.querySelector("span")?.textContent ?? "" : ""));
    const mn = $("lat-min"), txt = t(modo === "mini" ? "side.expand" : "side.min");
    mn.setAttribute("aria-expanded", String(modo !== "mini")); mn.setAttribute("aria-label", txt); mn.setAttribute("title", txt);
    mn.querySelector("use").setAttribute("href", modo === "mini" ? "#i-chev-der" : "#i-chev-izq");
  };
  const poner = (m) => { modo = m; raiz.dataset.lateral = m; try { localStorage.setItem(CLAVE, m); } catch { /* */ } if (!esMovil()) $("btn-menu").setAttribute("aria-expanded", String(m !== "oculto")); rotular(); setTimeout(() => { S.mapa?.invalidateSize(); window.dispatchEvent(new Event("resize")); }, 320); };
  const cerrar = () => { lat.classList.remove("abierto"); velo.hidden = true; if (esMovil()) $("btn-menu").setAttribute("aria-expanded", "false"); };
  $("btn-menu").addEventListener("click", () => {
    if (esMovil()) { const ab = !lat.classList.contains("abierto"); lat.classList.toggle("abierto", ab); velo.hidden = !ab; $("btn-menu").setAttribute("aria-expanded", String(ab)); }
    else poner(modo === "oculto" ? "completo" : "oculto");
  });
  $("lat-min").addEventListener("click", () => poner(modo === "mini" ? "completo" : "mini"));
  $("lat-ocultar").addEventListener("click", () => (esMovil() ? cerrar() : poner("oculto")));
  velo.addEventListener("click", cerrar);
  lat.querySelectorAll("a.item").forEach((a) => a.addEventListener("click", () => esMovil() && cerrar()));
  window.matchMedia("(max-width: 1099px)").addEventListener("change", () => { cerrar(); $("btn-menu").setAttribute("aria-expanded", String(esMovil() ? false : modo !== "oculto")); });
  poner(modo); onLang(rotular);
  $("lat-asistente").addEventListener("click", () => { cerrar(); asistente.abrir(); });
  $("lat-acceso").addEventListener("click", () => { cerrar(); window.scrollTo({ top: 0, behavior: "smooth" }); alternarAcceso(true); });
}

/* ---------- inicio ---------- */
function repintar() { pintarCapitales(); pintarElegido(); pintarPeriodos(); pintarAprende(); pintarMetodo(); pintarPie(); if (S.resultado) pintarResultado(); }
async function iniciar() {
  aplicar(); a11y.aplicar();
  document.querySelectorAll(".idioma button").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  $("btn-acceso").addEventListener("click", () => alternarAcceso());
  document.addEventListener("click", (ev) => { const p = $("panel-acceso"); if (!p.hidden && !ev.composedPath().includes(p) && !ev.target.closest("#btn-acceso, #lat-acceso")) alternarAcceso(false); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("panel-acceso").hidden) { alternarAcceso(false); $("btn-acceso").focus(); } });
  asistente = PHY.asistente.crearAsistente({
    obtener: () => ({ sitios: sitios(), actual: sitios()[0] ?? null, demo: false, servidor: S.servidor }),
    irASeccion: ir,
    abrirAcceso: () => { window.scrollTo({ top: 0, behavior: "smooth" }); alternarAcceso(true); },
  });
  $("abrir-asistente").addEventListener("click", () => asistente.abrir());
  navegacion();
  document.querySelectorAll("#periodos button").forEach((b) => b.addEventListener("click", () => { S.anios = b.dataset.anios; S.manual = false; pintarPeriodos(); }));
  ["desde", "hasta"].forEach((id) => $(id).addEventListener("input", () => { S.manual = true; pintarPeriodos(); }));
  $("fuente").addEventListener("change", () => { pintarPeriodos(); if (S.lugar) elegir(S.lugar); });
  $("form-buscar").addEventListener("submit", buscar);
  $("ver").addEventListener("click", ver);
  repintar(); pintarAcceso();
  a11y.alCambiar((k) => { if (["daltonismo", "contraste", "letra"].includes(k) && S.resultado) setTimeout(pintarResultado, 60); });
  onLang(() => { repintar(); pintarAcceso(); revisarServidor(); });
  cargarLeaflet(); cargarFronteras();
  await revisarServidor();
  cargarLugares();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();

/* Phyllobytes · pestañas, gráficas plegables y versión recordada (versión sencilla y experta).
 *
 * Solo interfaz: cada sección principal de <main> se muestra como una pestaña (una a la vez), las
 * gráficas se pueden plegar y desplegar, y se recuerda qué versión eligió la persona. No cambia
 * ningún cálculo ni identificador: los demás scripts siguen usando los mismos elementos.
 */
(function () {
"use strict";
const main = document.getElementById("principal");
if (!main) return;
const i18n = window.PHY && PHY.i18n;
const t = (k, alt) => { try { const v = i18n.t(k); return v && v !== k ? v : alt; } catch { return alt; } };
const lento = () => document.documentElement.dataset.movimiento === "reducido" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------------- versión recordada ---------------- */
document.addEventListener("click", (ev) => {
  const a = ev.target.closest("[data-version]");
  if (a) { try { localStorage.setItem("phy-version", a.dataset.version); } catch { /* sin almacenamiento */ } }
});

/* ---------------- pestañas ---------------- */
const secciones = [...main.children].filter((e) => e.tagName === "SECTION" && e.id);
const seccionDe = (el) => secciones.find((s) => s === el || s.contains(el)) || null;
let actual = null;

// Al mostrar una pestaña, recalcula el tamaño de mapas y figuras que se dibujaron mientras estaba oculta.
function ajustar(sec) {
  // Mapas y figuras dibujados mientras la pestaña estaba oculta necesitan recalcular su tamaño.
  try { if (typeof state !== "undefined" && state && state.map && state.map.invalidateSize) state.map.invalidateSize(); } catch { /* sin atlas */ }
  document.dispatchEvent(new CustomEvent("phy:pestana", { detail: { id: sec.id } }));
  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
    if (window.Plotly) sec.querySelectorAll(".js-plotly-plot").forEach((p) => { if (p.offsetParent) { try { Plotly.Plots.resize(p); } catch { /* */ } } });
  }, 30);
}
// Marca en el menú la pestaña activa.
function marcarNav() {
  document.querySelectorAll(".pildoras a[href^='#']").forEach((a) => {
    const d = document.getElementById(a.getAttribute("href").slice(1));
    const on = !!d && seccionDe(d) === actual;
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}
// Muestra una sección y oculta las demás.
function mostrar(sec) {
  sec = sec || secciones[0];
  if (sec === actual) return false;
  secciones.forEach((s) => s.classList.toggle("pestana-oculta", s !== sec));
  actual = sec;
  document.documentElement.dataset.pestana = sec.id;
  marcarNav();
  ajustar(sec);
  return true;
}
const scrollOriginal = Element.prototype.scrollIntoView;
// Va a la sección que contiene el elemento indicado, cambiando de pestaña si hace falta.
function irA(id, { desplazar = true, historial = true } = {}) {
  const el = document.getElementById(id);
  const sec = el && seccionDe(el);
  if (!sec) return false;
  mostrar(sec);
  if (historial && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
  if (desplazar) {
    if (el === sec) window.scrollTo({ top: 0, behavior: "auto" });
    else setTimeout(() => scrollOriginal.call(el, { behavior: lento() ? "auto" : "smooth", block: "start" }), 0);
  }
  return true;
}
// Cualquier script que haga «scrollIntoView» hacia algo de otra pestaña abre esa pestaña primero.
Element.prototype.scrollIntoView = function (...args) {
  const sec = seccionDe(this);
  if (sec && sec !== actual) { mostrar(sec); history.replaceState(null, "", "#" + sec.id); }
  return scrollOriginal.apply(this, args);
};
document.addEventListener("click", (ev) => {
  if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
  const a = ev.target.closest("a[href^='#']");
  if (!a) return;
  const id = a.getAttribute("href").slice(1);
  if (!id || !seccionDe(document.getElementById(id))) return;
  ev.preventDefault();
  irA(id);
});
window.addEventListener("popstate", () => irA(location.hash.slice(1) || secciones[0].id, { historial: false }));
window.addEventListener("hashchange", () => irA(location.hash.slice(1), { historial: false }));
if (!irA(location.hash.slice(1), { desplazar: false, historial: false })) mostrar(secciones[0]);

/* Versión experta: al pulsar «Analizar» se abre la pestaña de resultados (allí está el progreso).
 * Los avisos previos (p. ej., «elige un lugar») se repiten junto al botón para no cambiar de pestaña. */
const boton = document.getElementById("analyzeBtn"), estado = document.getElementById("statusArea"), espejo = document.getElementById("estado-espejo");
if (boton && estado) {
  new MutationObserver(() => { if (boton.disabled) { if (espejo) espejo.hidden = true; irA("resultados"); } }).observe(boton, { attributes: true, attributeFilter: ["disabled"] });
  if (espejo) new MutationObserver(() => {
    if (actual && actual.id === "mapa-seccion" && !estado.hidden && !boton.disabled) { espejo.className = estado.className; espejo.innerHTML = estado.innerHTML; espejo.hidden = false; }
  }).observe(estado, { attributes: true, childList: true, subtree: true, characterData: true });
  const res = document.getElementById("results");
  if (res) new MutationObserver(() => { if (!res.hidden) irA("resultados", { desplazar: false }); }).observe(res, { attributes: true, attributeFilter: ["hidden"] });
}

/* ---------------- gráficas plegables ---------------- */
const primera = (card) => card === card.parentElement.firstElementChild;
const REGLAS = [
  { sel: ".dash-card", cab: ".dash-tools", dentro: true, abierta: primera },
  { sel: ".fixed-card", cab: ".change-badge", abierta: () => true },
  { sel: ".chart-card", cab: ".chart-caption", abierta: () => true },
  { sel: ".bs-graf", cab: "h3", abierta: () => true },
];
const ICONO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Pone el texto del botón de una tarjeta plegable según esté abierta o cerrada.
function rotular(btn, abierta) {
  btn.setAttribute("aria-expanded", String(abierta));
  btn.querySelector("span").textContent = abierta ? t("fig.hide", "Ocultar gráfica") : t("fig.show", "Ver gráfica");
}
// Abre o cierra una tarjeta plegable.
function poner(card, abierta) {
  card.classList.toggle("plegada", !abierta);
  const b = card.querySelector(":scope .plegar"); if (b) rotular(b, abierta);
  if (abierta && window.Plotly) setTimeout(() => card.querySelectorAll(".js-plotly-plot").forEach((p) => { try { Plotly.Plots.resize(p); } catch { /* */ } }), 30);
}
// Vuelve plegable una tarjeta, una sola vez.
function preparar(card, regla) {
  if (card.dataset.plegable) return;
  const cab = card.querySelector(regla.cab);
  if (!cab) return;
  card.dataset.plegable = "1";
  const b = document.createElement("button");
  b.type = "button"; b.className = "plegar"; b.innerHTML = ICONO + "<span></span>";
  b.addEventListener("click", (ev) => { ev.stopPropagation(); poner(card, card.classList.contains("plegada")); });
  if (regla.dentro) cab.append(b);
  else { const barra = document.createElement("div"); barra.className = "plegar-barra"; barra.append(b); cab.after(barra); }
  poner(card, regla.abierta(card));
}
// Agrega al grupo de figuras un control para abrir o cerrar todas a la vez.
function grupoTodas(grid) {
  if (!grid || grid.dataset.todas || !grid.querySelector(".dash-card")) return;
  grid.dataset.todas = "1";
  const barra = document.createElement("div"); barra.className = "plegar-todas";
  const mk = (clave, alt, abrir) => { const b = document.createElement("button"); b.type = "button"; b.className = "plegar-todas-btn"; b.dataset.clave = clave; b.dataset.alt = alt; b.textContent = t(clave, alt);
    b.addEventListener("click", () => grid.querySelectorAll(".dash-card").forEach((c) => poner(c, abrir))); return b; };
  barra.append(mk("fig.open_all", "Abrir todas", true), mk("fig.close_all", "Cerrar todas", false));
  grid.before(barra);
}
let pendiente = 0;
// Prepara las tarjetas nuevas que hayan aparecido en la página.
function revisar() {
  pendiente = 0;
  for (const r of REGLAS) main.querySelectorAll(r.sel).forEach((c) => preparar(c, r));
  ["dashGrid", "valGrid"].forEach((id) => grupoTodas(document.getElementById(id)));
}
new MutationObserver(() => { if (!pendiente) pendiente = setTimeout(revisar, 40); }).observe(main, { childList: true, subtree: true });
revisar();
if (i18n && i18n.onLang) i18n.onLang(() => {
  main.querySelectorAll(".plegar").forEach((b) => rotular(b, b.getAttribute("aria-expanded") === "true"));
  main.querySelectorAll(".plegar-todas-btn").forEach((b) => { b.textContent = t(b.dataset.clave, b.dataset.alt); });
});

/* Barra superior siempre visible: queda fija arriba y el hueco de debajo tiene su misma altura. */
const barra = document.querySelector(".superior");
if (barra && window.ResizeObserver) {
  const hueco = document.createElement("div"); hueco.className = "superior-espacio"; barra.after(hueco);
  new ResizeObserver(() => { const h = barra.offsetHeight; hueco.style.height = h + "px"; document.documentElement.style.setProperty("--altura-superior", h + "px"); }).observe(barra);
}
window.PHY = window.PHY || {};
PHY.pestanas = { ir: irA, actual: () => actual && actual.id };
})();

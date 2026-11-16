/* Phyllobytes · portada: idioma ES/EN (clave compartida «phy-lang»). Script clásico, sin fetch. */
(function () {
"use strict";
var CLAVE = "phy-lang";
var T = {
  es: {
    doc_title: "Phyllobytes · Lluvia fuerte en Centroamérica",
    skip: "Saltar al contenido",
    titulo: "¿Cómo está cambiando la lluvia fuerte en Centroamérica?",
    subtitulo: "Un sitio web sencillo que transforma datos satelitales complejos en una forma accesible de comprender las precipitaciones extremas en Centroamérica, con el fin de entender mejor nuestro entorno",
    escoge: "Escoge el tipo de versión más útil para vos",
    c1_titulo: "Versión para principiantes",
    c1_desc: "Una versión más sencilla para personas que no son expertas: pocas opciones, palabras de todos los días y gráficas fáciles de leer.",
    c1_boton: "Entrar a la versión sencilla",
    c1_lista: "Lo que puedes ver aquí",
    c1_i1: "Cuánta lluvia cae al año en tu lugar",
    c1_i2: "Los meses más lluviosos",
    c1_i3: "Cuántos días de lluvia fuerte hay cada año y si van en aumento",
    c1_i4: "Qué tan seguido cae una lluvia de 50, 100, 150, 200 o 300 mm en un día",
    c1_i5: "El día que más llovió",
    c1_i6: "Qué tanto confiar en los datos",
    c1_nota: "Listo en 3 pasos · con mapa y asistente",
    c2_titulo: "Versión para expertos",
    c2_desc: "El atlas completo: todas las fuentes, hasta seis lugares a la vez, estadística detallada, verificación y descargas.",
    c2_boton: "Entrar al atlas completo",
    c2_lista: "Gráficas y datos disponibles",
    c2_i1: "GPM IMERG, MERRA-2, ERA5, CHIRPS y CSV propios",
    c2_i2: "Unas 40 figuras: tendencias Theil–Sen con IC 95 %, índices ETCCDI, cuantiles, cambio de régimen y período de retorno",
    c2_i3: "Percentiles P80–P99 y umbrales fijos de 50,8 a 127 mm",
    c2_i4: "Mann-Kendall con corrección por autocorrelación y Holm",
    c2_i5: "Semáforo de confianza y robustez entre productos",
    c2_i6: "Verificación con estaciones (NOAA, CSV, Costa Rica) y desfase de días",
    c2_i7: "Descargas CSV, JSON y TXT",
    c2_nota: "Para quien conoce términos de estadística y clima",
    pie1: "Herramienta educativa. No es un pronóstico ni una alerta.",
    pie2: "Datos: NASA · Copernicus · CHIRPS"
  },
  en: {
    doc_title: "Phyllobytes · Heavy rainfall in Central America",
    skip: "Skip to content",
    titulo: "How is heavy rainfall changing in Central America?",
    subtitulo: "A simple website that turns complex satellite data into an accessible way to understand extreme rainfall in Central America, so we can better understand our surroundings",
    escoge: "Choose the version that is most useful for you",
    c1_titulo: "Beginner version",
    c1_desc: "A simpler version for people who are not experts: few options, everyday words and charts that are easy to read.",
    c1_boton: "Enter the simple version",
    c1_lista: "What you can see here",
    c1_i1: "How much rain falls each year where you are",
    c1_i2: "The rainiest months",
    c1_i3: "How many days of heavy rain there are each year, and whether they are increasing",
    c1_i4: "How often a rainfall of 50, 100, 150, 200 or 300 mm falls in a single day",
    c1_i5: "The day it rained the most",
    c1_i6: "How much to trust the data",
    c1_nota: "Ready in 3 steps · with map and assistant",
    c2_titulo: "Expert version",
    c2_desc: "The full atlas: all sources, up to six places at once, detailed statistics, verification and downloads.",
    c2_boton: "Enter the full atlas",
    c2_lista: "Charts and data available",
    c2_i1: "GPM IMERG, MERRA-2, ERA5, CHIRPS and your own CSV",
    c2_i2: "About 40 figures: Theil–Sen trends with 95% CI, ETCCDI indices, quantiles, regime shift and return period",
    c2_i3: "Percentiles P80–P99 and fixed thresholds from 50.8 to 127 mm",
    c2_i4: "Mann-Kendall with autocorrelation correction and Holm",
    c2_i5: "Confidence traffic light and robustness across products",
    c2_i6: "Verification against stations (NOAA, CSV, Costa Rica) and day lag",
    c2_i7: "CSV, JSON and TXT downloads",
    c2_nota: "For those familiar with statistics and climate terms",
    pie1: "Educational tool. It is not a forecast or an alert.",
    pie2: "Data: NASA · Copernicus · CHIRPS"
  }
};

function leer() {
  try { var v = localStorage.getItem(CLAVE); if (v === "es" || v === "en") return v; } catch (e) { /* sin almacenamiento */ }
  return "es";
}
function guardar(l) { try { localStorage.setItem(CLAVE, l); } catch (e) { /* sin almacenamiento */ } }

function aplicar(l) {
  var d = T[l] || T.es;
  document.documentElement.lang = l;
  document.title = d.doc_title;
  Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function (el) {
    var k = el.getAttribute("data-t");
    if (d[k] != null) el.textContent = d[k];
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-lang") === l ? "true" : "false");
  });
}

Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
  b.addEventListener("click", function () {
    var l = b.getAttribute("data-lang");
    guardar(l);
    aplicar(l);
  });
});
aplicar(leer());
})();

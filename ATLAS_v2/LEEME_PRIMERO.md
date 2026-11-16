# Phyllobytes · Atlas de lluvia de Centroamérica (versión unificada 7.0)

Une las dos partes que se trabajaron por separado, sin perder ninguna:

- **Apariencia (de `test 3`, Phyllobytes):** barra lateral plegable, encabezado con ES/EN, accesibilidad y asistente, portada, colores, tipografía, marca de agua en cada gráfica y mapa, pie de página, Aprende y Método.
- **Lógica (del atlas v6.3):** el mismo `backend.py` y módulos, las 7 fuentes, los 7 países, todas las opciones del usuario, el mapa de OpenStreetMap, la ficha de celda, las ~40 figuras interactivas, el semáforo, la robustez entre productos, la verificación con desfase, Estaciones CR y todas las exportaciones.

No hay datos inventados: sin servidor la página avisa y no muestra resultados.

## Cómo abrirlo

1. Abra `INICIAR_ATLAS.py` en Spyder y pulse **F5** (o `python INICIAR_ATLAS.py`). Se abre `http://127.0.0.1:8780`.
   Usa un puerto distinto del visor v6.3 (8768), así ambos pueden abrirse a la vez.
2. Para detenerlo, reinicie el núcleo de Spyder.
3. Los resultados y la caché se guardan en `Descargas/Precipitacion_NASA_Comparador_CR/` (la misma carpeta del atlas, así se reutilizan las descargas).

## Interfaz 7.2

- **La versión sencilla es la principal** (`index.html`). A la experta (`experto.html`) se llega con el botón «Versión experta» (pequeño, a la izquierda del idioma). En la experta, el botón naranja «Versión sencilla» lleva de vuelta. La elección se recuerda: si la persona estaba en la experta, al abrir de nuevo el sitio vuelve a la experta. `principiante.html` solo redirige a `index.html`.
- **Sin barra lateral.** Cada palabra de la barra superior abre su propia pestaña (una sección a la vez; el enlace queda en la dirección, p. ej. `#resultados`, y sobrevive a recargar). En la experta, «Resultados» tiene un submenú (Resumen, Confianza, Frecuencia, Calidad, Panel, Una figura, Tabla, Archivos). Al pulsar «Analizar precipitación» se abre la pestaña de resultados. Archivo: `web/js/pestanas.js`.
- **Gráficas plegables:** cada gráfica tiene «Ver gráfica / Ocultar gráfica»; el panel de figuras y las figuras de estaciones empiezan plegados (solo la primera abierta), con «Abrir todas / Cerrar todas». La lectura de cada figura sigue visible aunque esté plegada.
- **Tema claro** (`web/css/claro.css`): fondo crema, paneles blancos cuadrados, títulos serif azul tinta, celeste del logo para acentos y naranja para lo importante, botones con leve relieve. Ilustraciones de `imagenes pagina` (copiadas en `web/assets/ilustraciones/`) y nubes en el pie (`web/assets/nubes.webp`). La marca de agua usa una versión oscura (`marca-agua-oscura.png`) para verse en fondo claro. El contraste alto sigue en negro.
- `web/css/claro-atlas.css` se GENERA con `GENERAR_TEMA_CLARO.py` (oscurece los textos claros de `atlas-tema.css` y `unificado.css`). Vuelva a ejecutarlo si cambia alguno de esos dos archivos.
- **Estaciones de Brasil (INMET) y Colombia (IDEAM)** en «Estaciones»: 7 + 7 estaciones de `Bra y Col` (copiadas a `data/estaciones_brco.json`), agrupadas por país junto a las de Costa Rica. Solo tienen datos 2025–2026: elija esos años. Los datos de IDEAM son preliminares. Requiere reiniciar el servidor.
- Respaldo de la versión 7.1 de las páginas en `_respaldo_7.1/`.

## Dos versiones (7.1)

- **`principiante.html` · versión sencilla** (desde 7.2 es `index.html`): 1 lugar (capitales, buscador o clic en el mapa), años por defecto (los últimos 20) y satélite IMERG; en «Más opciones» se pueden cambiar la fuente (IMERG, CHIRPS o ERA5) y los años. Usa el **mismo servidor y el mismo análisis** que la versión experta (`/api/start`). Muestra un semáforo, 3 cifras, los meses más lluviosos, los días de lluvia fuerte por año (≥ 50,8 mm, con la tendencia del análisis), cada cuánto cae una lluvia de 50/100/150/200/300 mm en un día (contado en la serie diaria real) y la lluvia de cada año. Tiene asistente, accesibilidad, ES/EN, Aprende y Método en palabras sencillas. Archivos: `js/basico.js`, `js/i18n-basico.js`, `css/basico.css`.
- **`experto.html` · versión para expertos:** la página completa de antes, sin quitar nada. Solo se añadieron el botón para cambiar de versión y las etiquetas de los umbrales (p. ej., «≥ 50,8 mm (lluvia fuerte)»), además de la guía de lluvia en un día junto a «Revisar lluvia diaria mayor de».
- **Tema azul marino** (`css/marino.css`, cargado en las tres páginas): fondo azul oscuro, paneles sólidos y títulos con letra serif. No cambia ningún control ni cálculo.
- Botón para cambiar de versión en la barra superior y en la barra lateral de ambas páginas (`js/i18n-version.js`).

## Qué cambió al unir (y qué no)

- **Flujo en 3 pasos** en «Analizar»: 1) datos y período, 2) lugares en el mapa (mapa grande con el panel de lugares al lado), 3) verificación opcional y botón «Analizar precipitación». Todos los controles del atlas siguen ahí, con los mismos identificadores.
- **Mapa:** el mismo mapa funcional de OpenStreetMap; ahora marca los 7 países elegibles (borde cian, resaltado al pasar, nombre) y deja México y Colombia en gris. La portada tiene un mini mapa de los 7 países: al tocar uno, el mapa grande se acerca a ese país.
- **Gráficas:** se conservan todas con su interacción; `web/js/tema-plotly.js` les aplica la paleta, la letra y la marca de agua de Phyllobytes (también en el PNG descargado) y las redibuja al cambiar contraste, daltonismo o tamaño de letra.
- **Colores de estado:** ▲ aumento y ▼ disminución usan los colores de Phyllobytes (naranja y cian; amarillo y azul en modo daltonismo).
- **Asistente:** el mismo, alimentado ahora con los resultados reales (días de lluvia fuerte > P95 y su tendencia). Sus textos y los de la portada hablan de los 7 países.
- **Idiomas:** todo está en español e inglés, también lo que genera el análisis (títulos, ejes, leyendas y textos emergentes de las figuras, notas, semáforo, verificación, Estaciones CR y mensajes del servidor). Esos textos se traducen sin tocar la lógica: `web/js/traductor-nucleo.js` y `traductor-diccionario.js` (frases con comodines para cifras y nombres) se aplican a las figuras desde `tema-plotly.js` y al HTML desde `traductor-dom.js`; al volver a español se restaura el original. En inglés los decimales usan punto. Quedan en su idioma los nombres propios (estaciones, «El Niño/La Niña») y los archivos TXT/CSV descargados, que conservan sus cabeceras originales. Para añadir una frase nueva, agréguela al diccionario como `["texto en español con {}", "English text with {}"]`.
- **Se quitaron:** la muestra de demostración (datos inventados) y el «mapa de calor» interpolado de Phyllobytes, porque el atlas nunca rellena con colores las zonas sin puntos.

## Archivos

| Archivo | Función |
| --- | --- |
| `backend.py` y módulos `.py` | Servidor y cálculo (copiados del atlas; solo se añadieron tipos MIME de imagen/fuente y la versión 7.0). |
| `web/index.html` | La página unificada. |
| `web/atlas/` | JavaScript del atlas (sin cambios de lógica; solo colores de estado ligados a la paleta y países marcados en el mapa). |
| `web/js/` | Módulos de Phyllobytes (idioma, accesibilidad, asistente) + `shell.js` (conecta todo), `i18n-atlas.js` (textos ES/EN de los controles), `traductor-*.js` (textos que genera el análisis), `tema-plotly.js`, `geo-ca.js`. |
| `web/css/atlas-tema.css` | Generado por `GENERAR_TEMA_ATLAS.py` desde `web/atlas/styles.css`: no editar a mano. |
| `web/css/unificado.css` | Distribución y ajustes de la unión. |
| `web/data/asistente.json` | Preguntas y respuestas del asistente; tras editarlo, ejecute `SINCRONIZAR_DATOS.py`. |
| `tools_textos_unificado.py` | Registro de los cambios de texto (Costa Rica → 7 países, sin demostración). |
| `tests/` | Las 75 pruebas del atlas (`python -m unittest discover -s tests`). |

La tipografía Batangas no está incluida (igual que en Phyllobytes, ver `web/fonts/LEEME.txt`); la página usa la letra de respaldo.

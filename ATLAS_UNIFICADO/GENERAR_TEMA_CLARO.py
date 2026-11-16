"""Genera web/css/claro-atlas.css: versión legible en fondo claro de los colores de texto del atlas.

atlas-tema.css y unificado.css se pensaron para fondo oscuro, así que muchos textos usan colores muy
claros (p. ej. hsl(96, 88%, 70%)). Este script los busca y escribe una regla equivalente con el mismo
tono pero oscuro, solo cuando NO está activo el contraste alto. No toca los archivos originales.
Vuelva a ejecutarlo si cambia atlas-tema.css o unificado.css.
"""
import colorsys
import re
from pathlib import Path

WEB = Path(__file__).resolve().parent / "web" / "css"
FUENTES = ["atlas-tema.css", "unificado.css"]
SALIDA = WEB / "claro-atlas.css"
# Textos blancos sobre un fondo de color propio (botones, insignias): se dejan igual.
SALTAR = re.compile(r"main-btn|change-badge|export-strong|coordinate-entry|cc-add|floating-head|verdict-chip|state-chip|vsummary|pointbadge|table-scroll th|saltar"
                   r"|eyebrow|\.step\b|tab\.active|dash-tools|line-btn|status-card|grid-badge|tl-\w+-text|map-toolbar select")  # ya en claro.css
DECL = re.compile(r"(?<![-\w])color\s*:\s*([^;}!]+)(!important)?")


def oscuro_hsl(h, s, l):
    return f"hsl({h:g}, {min(s, 75):g}%, {30 if l >= 58 else l:g}%)"


def convertir(valor):
    v = valor.strip()
    m = re.fullmatch(r"hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)", v)
    if m:
        h, s, l = float(m[1]), float(m[2]), float(m[3])
        return oscuro_hsl(h, s, l) if l >= 58 else None
    m = re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", v)
    if m:
        x = m[1] if len(m[1]) == 6 else "".join(c * 2 for c in m[1])
        r, g, b = (int(x[i:i + 2], 16) / 255 for i in (0, 2, 4))
        if r > .97 and g > .97 and b > .97:
            return None                      # blanco: casi siempre va sobre un fondo de color
        h, l, s = colorsys.rgb_to_hls(r, g, b)
        return oscuro_hsl(round(h * 360), round(s * 100), round(l * 100)) if l >= .58 else None
    m = re.fullmatch(r"rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)", v)
    if m:
        return f"rgba(31, 42, 61, {max(float(m[1]), .7):g})"
    return None


def reglas(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    profundidad, inicio, pila = 0, 0, []
    for i, c in enumerate(css):
        if c == "{":
            pila.append(css[inicio:i].strip()); inicio = i + 1
        elif c == "}":
            sel = pila.pop() if pila else ""
            cuerpo = css[inicio:i]; inicio = i + 1
            if sel and not sel.startswith("@") and not any(p.startswith("@keyframes") for p in pila):
                yield [p for p in pila if p.startswith("@media")], sel, cuerpo


def main():
    salida = ["/* GENERADO por GENERAR_TEMA_CLARO.py: no editar a mano. Textos del atlas legibles en el tema claro. */"]
    n = 0
    for nombre in FUENTES:
        for medias, sel, cuerpo in reglas((WEB / nombre).read_text(encoding="utf-8")):
            if "data-contraste" in sel or SALTAR.search(sel):
                continue
            nuevos = []
            for m in DECL.finditer(cuerpo):
                c = convertir(m[1])
                if c:
                    nuevos.append(f"color: {c}{' !important' if m[2] else ''}")
            if not nuevos:
                continue
            selectores = ", ".join(f':root:not([data-contraste="alto"]) {s.strip()}' for s in sel.split(",") if s.strip())
            regla = f"{selectores} {{ {'; '.join(nuevos)}; }}"
            for med in reversed(medias):
                regla = f"{med} {{ {regla} }}"
            salida.append(regla); n += 1
    SALIDA.write_text("\n".join(salida) + "\n", encoding="utf-8")
    print(f"{n} reglas escritas en {SALIDA}")


if __name__ == "__main__":
    main()

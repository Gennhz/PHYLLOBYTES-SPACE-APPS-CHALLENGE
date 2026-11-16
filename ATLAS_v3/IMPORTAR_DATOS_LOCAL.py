# -*- coding: utf-8 -*-
"""Convierte los pluviómetros de Costa Rica que están en la carpeta «Datos local» en series diarias.

Los archivos que entrega el IMN traen la lluvia hora por hora, con esta forma:
    {"Cuenca": "81", "Estación": "5", "Fecha": "27/06/1997", "Hora": "11:00", "Lluvia (mm)": "0,0"}

Este script los suma por día y guarda el resultado en data/estaciones_cr_local.json, con el mismo formato que usan
las estaciones de Brasil y Colombia. Así la sección «Estaciones» de la página puede compararlos con el satélite.

Algunas decisiones importantes:
* «-9,0» o un valor vacío significa que esa hora no tiene dato. No se cuenta como cero.
* Un día solo se guarda si tiene sus 24 horas con dato. Si le falta alguna, queda como faltante.
* El día se arma en hora UTC, que es como cuenta los días NASA POWER (IMERG). Costa Rica está en UTC−6 y
  se asume que la «Hora» marca el final de la hora medida. Por eso la hora local h se suma al día UTC de h+5.
* Las estadísticas que vienen del satélite (estadisticos_lluvia_cr*.json) no son de un pluviómetro y se ignoran.

Se ejecuta una vez, o cada vez que se agreguen archivos nuevos a «Datos local»:
    python IMPORTAR_DATOS_LOCAL.py
"""
import json
import math
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CARPETA = AQUI / 'Datos local'
SALIDA = AQUI / 'data' / 'estaciones_cr_local.json'

# Ubicación de cada estación, con la clave «cuenca-estación» del IMN.
# Si se agrega una estación nueva, hay que poner aquí sus coordenadas; si no, el script la salta y avisa.
UBICACIONES = {
    '81-5': {'id': '81005', 'name': 'Limón (IMN 81005)', 'lat': 9.957, 'lon': -83.022, 'elev_m': 7.0},
}
HORAS_POR_DIA = 24
MAX_HORA_MM = 300.0        # una hora con más de esto es casi seguro un error de registro


def _mm(texto):
    """Pasa «12,5» a 12.5. Devuelve None si la hora no tiene dato o el valor no tiene sentido."""
    try:
        v = float(str(texto).strip().replace(',', '.'))
    except ValueError:
        return None
    if not math.isfinite(v) or v < 0 or v > MAX_HORA_MM:
        return None        # -9,0 es el código de «sin dato» del IMN
    return v


def _dia_utc(fecha, hora):
    """Fecha y hora local del IMN → día UTC al que pertenece esa hora de lluvia."""
    local = datetime.strptime(fecha, '%d/%m/%Y') + timedelta(hours=int(hora.split(':')[0]))
    return (local + timedelta(hours=5)).date().isoformat()


def leer_estacion(ruta):
    filas = json.loads(ruta.read_text('utf-8'))
    if not isinstance(filas, list) or not filas or not isinstance(filas[0], dict) or 'Hora' not in filas[0]:
        return None, None
    clave_est = next((k for k in filas[0] if k.lower().startswith('estaci')), None)
    total, horas, vistas = defaultdict(float), defaultdict(int), set()
    claves = set()
    for f in filas:
        claves.add(f"{int(f['Cuenca'])}-{int(f[clave_est])}")
        if (f['Fecha'], f['Hora']) in vistas:
            continue        # una hora repetida se cuenta una sola vez
        vistas.add((f['Fecha'], f['Hora']))
        v = _mm(f.get('Lluvia (mm)'))
        try:
            dia = _dia_utc(f['Fecha'], f['Hora'])
        except (ValueError, KeyError):
            continue
        if v is not None:
            total[dia] += v
            horas[dia] += 1
    if len(claves) != 1:
        print(f'  ! {ruta.name}: trae más de una estación ({sorted(claves)}); se salta.')
        return None, None
    diario = [[d, round(total[d], 1)] for d in sorted(total) if horas[d] == HORAS_POR_DIA]
    return claves.pop(), diario


def main():
    if not CARPETA.exists():
        print(f'No existe la carpeta «{CARPETA.name}».')
        return 1
    estaciones = []
    for ruta in sorted(CARPETA.glob('*.json')):
        clave, diario = leer_estacion(ruta)
        if clave is None:
            print(f'  · {ruta.name}: no es una serie horaria de pluviómetro; se ignora.')
            continue
        if clave not in UBICACIONES:
            print(f'  ! {ruta.name}: estación {clave} sin coordenadas en UBICACIONES; se salta.')
            continue
        estaciones.append({**UBICACIONES[clave], 'daily': diario})
        print(f'  ✓ {ruta.name}: {len(diario)} días completos ({diario[0][0]} a {diario[-1][0]}).')
    salida = {
        'schema_version': '1.0',
        'source_generated_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'countries': [{
            'iso2': 'CR', 'name': 'Costa Rica', 'institution': 'IMN (Instituto Meteorológico Nacional)',
            'url': 'https://www.imn.ac.cr/',
            'notes': 'Lluvia horaria del IMN sumada por día UTC; solo días con las 24 horas medidas.',
            'stations': estaciones,
        }],
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':')), 'utf-8')
    print(f'Guardado en {SALIDA.relative_to(AQUI)}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

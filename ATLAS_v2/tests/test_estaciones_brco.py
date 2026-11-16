"""Estaciones extra de Brasil (INMET) y Colombia (IDEAM): carga y validación de solicitud (sin red)."""
import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import backend
backend.DEFAULT_ROBUSTNESS = 'off'
import estaciones


class ExtLoader(unittest.TestCase):
    def test_catalogo_real(self):
        self.assertTrue(estaciones.STATIONS_EXT)
        for sid, m in estaciones.STATIONS_EXT.items():
            self.assertRegex(sid, r'^(BR|CO|CR):')
            red, pais = {'BR': ('INMET', 'Brasil'), 'CO': ('IDEAM', 'Colombia'), 'CR': ('IMN', 'Costa Rica')}[sid[:2]]
            self.assertEqual(m['network'], red)
            self.assertEqual(m['country'], pais)
            self.assertEqual(m['fuera_ca'], sid[:2] != 'CR')
            self.assertLessEqual(m['first'], m['last'])
            self.assertTrue(estaciones.ext_daily(sid))

    def test_cr_intacto_y_catalogo(self):
        cat = {s['id']: s for s in estaciones.station_catalog()}
        for sid in estaciones.STATIONS:
            self.assertEqual(cat[sid]['country'], 'Costa Rica')
        self.assertEqual(len(cat), len(estaciones.STATIONS) + len(estaciones.STATIONS_EXT))
        self.assertEqual(len(estaciones.STATIONS), 6)

    def test_loader_omite_nulos_y_invalidos(self):
        raw = {'countries': [{'iso2': 'BR', 'name': 'Brasil', 'stations': [
            {'id': 'X1', 'name': 'T', 'lat': -10, 'lon': -50, 'elev_m': 5,
             'daily': [['2025-01-01', 1.5], ['2025-01-02', None], ['malo', 2], ['2026-01-01', -3], ['2026-01-02', 0.0]]},
            {'id': 'X2', 'name': 'vacia', 'lat': 0, 'lon': 0, 'daily': [['2025-01-01', None]]}]}]}
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / 'e.json'
            p.write_text(json.dumps(raw), encoding='utf-8')
            meta, daily = estaciones.load_ext_stations(p)
        self.assertEqual(list(meta), ['BR:X1'])
        self.assertEqual(daily['BR:X1'], {'2025-01-01': 1.5, '2026-01-02': 0.0})
        self.assertEqual((meta['BR:X1']['first'], meta['BR:X1']['last']), (2025, 2026))

    def test_archivo_ausente(self):
        self.assertEqual(estaciones.load_ext_stations(Path('/no/existe.json')), ({}, {}))

    def test_id_no_permitido(self):
        with self.assertRaises(ValueError):
            estaciones.ext_daily('BR:NOPE')


class ExtRequest(unittest.TestCase):
    def test_acepta_ext(self):
        sid = next(iter(estaciones.STATIONS_EXT))
        src, y0, y1, ids, cst, wet = backend.validate_validation_request(
            {'source': 'gpm', 'start_year': 2025, 'end_year': 2026, 'stations': [sid, 'CS000081003']})
        self.assertEqual(ids, [sid, 'CS000081003'])
        self.assertIsNone(cst)

    def test_rechaza_desconocida(self):
        with self.assertRaises(ValueError):
            backend.validate_validation_request({'source': 'gpm', 'start_year': 2025, 'end_year': 2026, 'stations': ['BR:ZZZ']})

    def test_run_validation_sin_red(self):
        sid = next(iter(estaciones.STATIONS_EXT))
        obs = estaciones.ext_daily(sid)
        orig = backend.get_nasa_data
        backend.get_nasa_data = lambda s, la, lo, a, b, prog: ({d: v for d, v in obs.items()}, ['test'])
        try:
            rows = backend.run_validation('gpm', 2020, 2026, [sid], None, 1.0, lambda m: None)
        finally:
            backend.get_nasa_data = orig
        r = rows[0]
        self.assertNotIn('error', r)
        self.assertEqual(r['station']['id'], sid)
        self.assertIsNone(r['land_fraction'])
        self.assertTrue(r['cell'].get('available'))
        self.assertEqual(r['comparison']['anios'], [estaciones.STATIONS_EXT[sid]['first'], estaciones.STATIONS_EXT[sid]['last']])


if __name__ == '__main__':
    unittest.main()

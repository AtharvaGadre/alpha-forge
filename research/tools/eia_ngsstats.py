"""Extract EIA's published Lower-48 five-year-average working-gas levels from ngsstats.xls.

EIA publishes, for each report year, the five-year average (and max/min) stock level used in the
Weekly Natural Gas Storage Report: https://ir.eia.gov/ngs/ngsstats.xls (public domain).
research/storage-study.ts reads the JSON written here (if present) to validate its replication of
the five-year-average benchmark. Requires the `xlrd` package (reads legacy .xls).

    curl -L -o /tmp/ngsstats.xls https://ir.eia.gov/ngs/ngsstats.xls
    python3 -I research/tools/eia_ngsstats.py /tmp/ngsstats.xls research/cache/eia-ngsstats-l48.json
"""
import datetime
import json
import re
import sys

import xlrd

src, out = sys.argv[1], sys.argv[2]
book = xlrd.open_workbook(src)
rows = []
for sheet in book.sheets():
    m = re.match(r'ngsstats (\d{4}) \((\d{4})-(\d{4})\)', sheet.name.strip())
    if not m:
        continue
    header = [str(sheet.cell_value(2, c)).strip() for c in range(sheet.ncols)]
    if header[0] != 'Report Date' or header[8] != 'Total Lower 48':
        raise SystemExit(f'Unexpected layout in sheet {sheet.name!r}: {header[:9]}')
    for r in range(3, sheet.nrows):
        d, v = sheet.cell_value(r, 0), sheet.cell_value(r, 8)
        if not isinstance(d, float) or not isinstance(v, float):
            continue
        date = (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(d))).isoformat()
        rows.append({'reportYear': int(m.group(1)), 'window': f'{m.group(2)}-{m.group(3)}', 'weekEnd': date, 'fiveYearAvgL48': v})
rows.sort(key=lambda x: x['weekEnd'])
json.dump({'source': 'https://ir.eia.gov/ngs/ngsstats.xls', 'extractedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rows': rows}, open(out, 'w'), indent=0)
print(f'{len(rows)} rows {rows[0]["weekEnd"]}…{rows[-1]["weekEnd"]} -> {out}')

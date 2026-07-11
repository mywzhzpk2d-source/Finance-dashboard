from __future__ import annotations
import csv, io, json, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

SERIES = {
    "DGS10": ("US 10Y Treasury Yield", "%"),
    "DGS2": ("US 2Y Treasury Yield", "%"),
    "M2SL": ("M2 Money Stock", "Billions USD"),
    "NASDAQCOM": ("NASDAQ Composite", "Index"),
    "DJIA": ("Dow Jones Industrial Average", "Index"),
    "KOSPI": ("KOSPI", "Index"),
    "VIXCLS": ("VIX", "Index"),
    "DCOILWTICO": ("WTI Crude Oil", "USD/bbl"),
    "GOLDAMGBD228NLBM": ("Gold", "USD/oz"),
    "PCOPPUSDM": ("Copper", "USD/mt"),
    "DTWEXBGS": ("Trade Weighted U.S. Dollar Index: Broad", "Index"),
}

def download(series_id: str) -> list[dict]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 BJ-Market-Terminal/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        text = response.read().decode("utf-8-sig")

    rows = []
    for row in csv.DictReader(io.StringIO(text)):
        date = row.get("DATE") or row.get("observation_date")
        raw = row.get(series_id)
        if not date or raw in (None, "", "."):
            continue
        try:
            value = float(raw)
        except ValueError:
            continue
        rows.append({"date": date, "value": value})

    return rows[-1600:]

def main() -> None:
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_mode": "auto",
        "series": {}
    }

    for series_id, (name, unit) in SERIES.items():
        try:
            data = download(series_id)
            if not data:
                raise RuntimeError("empty data")
            output["series"][series_id] = {
                "name": name,
                "unit": unit,
                "data": data
            }
            print(series_id, len(data))
        except Exception as exc:
            print("FAILED", series_id, exc)
        time.sleep(0.5)

    path = Path("data/market-data.json")

    # Keep previous good data for any series that temporarily fails.
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
            for series_id in SERIES:
                if series_id not in output["series"] and series_id in previous.get("series", {}):
                    output["series"][series_id] = previous["series"][series_id]
        except Exception:
            pass

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

if __name__ == "__main__":
    main()

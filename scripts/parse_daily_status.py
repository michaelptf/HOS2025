from __future__ import annotations

import copy
import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pdfplumber
import requests

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "config" / "sources.json"
PRICE_UNITS_FILE = ROOT / "data" / "units.latest.json"
OUTPUT_FILE = ROOT / "data" / "units.available.latest.json"
CACHE_DIR = ROOT / "data" / "status_pdfs"

UNSOLD_LINE_CN_RE = re.compile(r"(\d{1,2})\s*樓\s*單位\s*(\d{1,3})")
UNSOLD_LINE_EN_RE = re.compile(r"(\d{1,2})\s*/\s*F\s*(?:Flat|Unit)\s*(\d{1,3})", re.IGNORECASE)
LAST_UPDATED_CN_RE = re.compile(r"最後更新日期\s*[:：]\s*(.+)")


@dataclass
class DailySource:
    estateKey: str
    estateName: str
    unitIdPrefix: str
    block: str
    url: str
    localFile: str


def now_hk_string() -> str:
    hk_tz = timezone(timedelta(hours=8))
    hk_now = datetime.now(timezone.utc).astimezone(hk_tz)
    return hk_now.strftime("%Y-%m-%d %H:%M HKT")


def load_sources() -> list[DailySource]:
    payload = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return [DailySource(**item) for item in payload.get("dailyStatusSources", [])]


def read_price_units() -> list[dict[str, Any]]:
    payload = json.loads(PRICE_UNITS_FILE.read_text(encoding="utf-8"))
    units = payload.get("units")
    if not isinstance(units, list):
        raise ValueError("Invalid data/units.latest.json: missing units[]")
    return units


def download_pdf(src: DailySource) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / src.localFile
    r = requests.get(src.url, timeout=45)
    r.raise_for_status()
    target.write_bytes(r.content)
    return target


def extract_pdf_text(pdf_path: Path) -> str:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text:
                lines.append(text)
    return "\n".join(lines)


def extract_unsold_section(text: str) -> str:
    m = re.search(
        r"以下為未售單位:\s*(.*?)\s*以下為已售單位:",
        text,
        re.DOTALL
    )
    if m:
        return m.group(1)

    # fallback English
    m = re.search(
        r"The following flats are available:\s*(.*?)\s*The following flats were sold:",
        text,
        re.DOTALL | re.IGNORECASE
    )
    if m:
        return m.group(1)

    return text


def parse_unsold_units(text: str) -> set[tuple[int, int]]:
    text = extract_unsold_section(text)

    hits: set[tuple[int, int]] = set()

    for floor_raw, unit_raw in UNSOLD_LINE_CN_RE.findall(text):
        hits.add((int(floor_raw), int(unit_raw)))

    for floor_raw, unit_raw in UNSOLD_LINE_EN_RE.findall(text):
        hits.add((int(floor_raw), int(unit_raw)))

    return hits


def parse_last_updated_text(text: str) -> str | None:
    for line in text.splitlines():
        m = LAST_UPDATED_CN_RE.search(line)
        if m:
            return m.group(1).strip()
    return None


def build_unit_id(prefix: str, block: str, floor: int, unit: int) -> str:
    return f"{prefix.upper()}-{block.upper()}-{floor:02d}-{unit:02d}"


def main() -> None:
    sources = load_sources()
    if not sources:
        raise ValueError("No dailyStatusSources configured in config/sources.json")

    price_units = read_price_units()
    price_index = {u.get("unitId"): u for u in price_units if isinstance(u.get("unitId"), str)}

    status_records: list[dict[str, Any]] = []
    source_summaries: list[dict[str, Any]] = []
    estate_counts: dict[str, int] = {}

    for src in sources:
        pdf_path = download_pdf(src)
        text = extract_pdf_text(pdf_path)
        unsold_pairs = parse_unsold_units(text)
        source_last_update = parse_last_updated_text(text)

        parsed_count = 0
        matched_count = 0
        for floor, unit in sorted(unsold_pairs):
            unit_id = build_unit_id(src.unitIdPrefix, src.block, floor, unit)
            parsed_count += 1
            if unit_id in price_index:
                matched_count += 1
            status_records.append(
                {
                    "unitId": unit_id,
                    "estateKey": src.estateKey,
                    "estate": src.estateName,
                    "block": f"Block {src.block}",
                    "floor": floor,
                    "unitNumber": f"{unit:02d}",
                    "availability": "available",
                    "sourceUrl": src.url,
                    "sourceFile": src.localFile,
                    "sourceLastUpdated": source_last_update,
                }
            )

        estate_counts[src.estateKey] = estate_counts.get(src.estateKey, 0) + parsed_count
        source_summaries.append(
            {
                "estateKey": src.estateKey,
                "block": src.block,
                "url": src.url,
                "file": src.localFile,
                "parsedUnsoldUnits": parsed_count,
                "matchedPriceUnits": matched_count,
                "statusLastUpdated": source_last_update,
            }
        )

    # Merge: keep only records confirmed available by daily status and present in price list dataset.
    merged_units: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for s in status_records:
        unit_id = s["unitId"]
        if unit_id in seen_ids:
            continue
        base = price_index.get(unit_id)
        if not base:
            continue
        merged = copy.deepcopy(base)
        merged["status"] = "available"
        merged["availabilitySource"] = {
            "sourceFile": s["sourceFile"],
            "sourceUrl": s["sourceUrl"],
            "sourceLastUpdated": s["sourceLastUpdated"],
        }
        merged_units.append(merged)
        seen_ids.add(unit_id)

    utc_now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    hk_now = now_hk_string()

    output = {
        "meta": {
            "lastUpdatedUtc": utc_now,
            "lastUpdatedHk": hk_now,
            "recordCount": len(merged_units),
            "source": "price-list+daily-status-merge",
            "priceRecords": len(price_units),
            "dailyStatusParsedRecords": len(status_records),
            "mergedAvailableRecords": len(merged_units),
        },
        "metadata": {
            "lastUpdatedUtc": utc_now,
            "lastUpdatedHk": hk_now,
            "sources": source_summaries,
            "counts": {
                "priceRecords": len(price_units),
                "dailyStatusParsedRecords": len(status_records),
                "mergedAvailableRecords": len(merged_units),
                "unmatchedStatusRecords": len(status_records) - len(merged_units),
                "perEstateParsed": estate_counts,
            },
            "notes": [
                "Best-effort parser uses floor/unit text extraction from status PDFs.",
                "If source formatting changes, unmatchedStatusRecords may increase and parser rules should be updated.",
            ],
        },
        "units": merged_units,
        "statusUnits": status_records,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Daily status parsed counts per estate:")
    for estate_key in sorted(estate_counts.keys()):
        print(f"- {estate_key}: {estate_counts[estate_key]}")
    print(f"Price records: {len(price_units)}")
    print(f"Daily status parsed records: {len(status_records)}")
    print(f"Merged available records: {len(merged_units)}")
    print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()

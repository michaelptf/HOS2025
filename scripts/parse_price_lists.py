from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import re
from datetime import timedelta
from typing import Any

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "config" / "sources.json"
RAW_OUTPUT_FILE = ROOT / "data" / "price_lists.raw.json"
LATEST_OUTPUT_FILE = ROOT / "data" / "units.latest.json"


@dataclass
class Source:
    estate: str
    court: str
    url: str
    localFile: str


ROW_AREA_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*\(([\d,]+)\)$")
BLOCK_TOKEN_RE = re.compile(r"^[A-Z]\d?$")
BLOCK_PAGE_RE = re.compile(r"座\s*([A-Z]\d?)")
ROW_LINE_RE = re.compile(
    r"^(\d{1,2})\s+(\d{1,3})\s+(\d+(?:\.\d+)?)\s*\(([\d,]+)\)\s+([\d,]+)\s+([\d,]+)\s*\(([\d,]+)\)"
)


def now_hk_string() -> str:
    hk_tz = timezone(timedelta(hours=8))
    hk_now = datetime.now(timezone.utc).astimezone(hk_tz)
    return hk_now.strftime("%Y-%m-%d %H:%M HKT")


def load_sources() -> list[Source]:
    payload = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    return [Source(**item) for item in payload.get("priceListSources", [])]


def parse_block(raw: str) -> str | None:
    if not raw:
        return None
    tokens = re.split(r"\s+", raw.replace("\n", " ").strip())
    for token in reversed(tokens):
        cleaned = token.strip().upper()
        if cleaned in {"BLOCK", "KCOLB", "座"}:
            continue
        if BLOCK_TOKEN_RE.fullmatch(cleaned):
            return cleaned
    return None


def parse_area(raw: str) -> tuple[float | None, int | None]:
    if not raw:
        return None, None
    match = ROW_AREA_RE.match(raw.strip())
    if not match:
        return None, None
    sqm = float(match.group(1))
    sqft = int(match.group(2).replace(",", ""))
    return sqm, sqft


def parse_int(raw: str | None) -> int | None:
    if not raw:
        return None
    value = raw.strip().replace(",", "")
    if not value or not value.lstrip("-").isdigit():
        return None
    return int(value)


def extract_pdf_text(pdf_path: Path) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                clean = line.strip()
                if clean:
                    lines.append(clean)
    return lines


def extract_units_for_source(src: Source) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    pdf_path = ROOT / src.localFile
    units: list[dict[str, Any]] = []
    samples: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    with pdfplumber.open(pdf_path) as pdf:
        current_block: str = "UNKNOWN"
        for page_index, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""

            flat_text = " ".join(page_text.split())
            block_match = BLOCK_PAGE_RE.search(flat_text)
            if block_match:
                current_block = block_match.group(1)

            lines = [line.strip() for line in page_text.splitlines() if line.strip()]
            for line in lines:
                match = ROW_LINE_RE.match(line)
                if not match:
                    continue

                floor = int(match.group(1))
                unit_number = int(match.group(2))
                area_sqm = float(match.group(3))
                area_sqft = int(match.group(4).replace(",", ""))
                price_hkd = int(match.group(5).replace(",", ""))
                unit_rate_hkd_per_sqm = int(match.group(6).replace(",", ""))

                block = current_block or "UNKNOWN"
                unit_no_display = str(unit_number).zfill(2)
                unit_id = f"{src.court.upper().replace(' ', '')}-{block}-{floor:02d}-{unit_no_display}"
                if unit_id in seen_ids:
                    continue
                seen_ids.add(unit_id)

                record = {
                    "unitId": unit_id,
                    "estate": src.estate,
                    "block": f"Block {block}",
                    "floor": floor,
                    "unitNumber": unit_no_display,
                    "saleableAreaSqft": area_sqft,
                    "saleableAreaSqm": area_sqm,
                    "priceHkd": price_hkd,
                    "unitRateHkdPerSqm": unit_rate_hkd_per_sqm,
                    "orientation": None,
                    "unitType": None,
                    "status": "priced",
                    "sourceFile": src.localFile,
                    "sourcePage": page_index
                }
                units.append(record)

                if len(samples) < 30:
                    samples.append(record)

    return units, samples


def parse_all() -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    all_units: list[dict[str, Any]] = []
    missing: list[str] = []

    for src in load_sources():
        pdf_path = ROOT / src.localFile
        if not pdf_path.exists():
            missing.append(str(pdf_path.name))
            continue

        lines = extract_pdf_text(pdf_path)
        units, sample_units = extract_units_for_source(src)
        all_units.extend(units)
        rows.append(
            {
                "estate": src.estate,
                "court": src.court,
                "sourceFile": src.localFile,
                "lineCount": len(lines),
                "sampleLines": lines[:25],
                "parsedUnits": len(units),
                "sampleParsedUnits": sample_units,
            }
        )

    return {
        "meta": {
            "sourceCount": len(rows),
            "missingFiles": missing,
            "parsedUnitCount": len(all_units)
        },
        "raw": rows,
        "units": all_units
    }


def main() -> None:
    RAW_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    output = parse_all()
    RAW_OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")

    latest = {
        "meta": {
            "lastUpdatedUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "lastUpdatedHk": now_hk_string(),
            "recordCount": len(output["units"]),
            "source": "price-list-pdfs"
        },
        "units": output["units"]
    }
    LATEST_OUTPUT_FILE.write_text(json.dumps(latest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {RAW_OUTPUT_FILE}")
    print(f"Wrote {LATEST_OUTPUT_FILE}")


if __name__ == "__main__":
    main()

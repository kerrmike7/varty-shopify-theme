#!/usr/bin/env python3
"""
import-retailers.py
-------------------
Creates Shopify metaobject entries for Varty stockists.

Prerequisites:
  1. Metaobject definition "retailer" created in Shopify admin with fields:
     name, address, city, region, postal_code, url
  2. CLI authed: shopify store auth --store hbsj00-23.myshopify.com --scopes write_metaobjects
  3. Run from bloop-build/ with varty_retailers_stockist.csv in the same dir or parent.

Usage:
  python3 scripts/import-retailers.py [--csv path/to/file.csv] [--dry-run]
"""

import csv, json, subprocess, sys, argparse, pathlib, time

STORE = "hbsj00-23.myshopify.com"
CSV_CANDIDATES = [
    pathlib.Path(__file__).parent.parent / "varty_retailers_stockist.csv",
    pathlib.Path("varty_retailers_stockist.csv"),
]

def find_csv(override=None):
    if override:
        p = pathlib.Path(override)
        if p.exists(): return p
        sys.exit(f"CSV not found: {override}")
    for c in CSV_CANDIDATES:
        if c.exists(): return c
    sys.exit("varty_retailers_stockist.csv not found. Specify with --csv path.")

def gql_create(name, address, city, region, postal_code, url=""):
    """Build the metaobjectCreate mutation string."""
    fields = [
        f'{{"key":"name","value":{json.dumps(name)}}}',
        f'{{"key":"address","value":{json.dumps(address)}}}',
        f'{{"key":"city","value":{json.dumps(city)}}}',
        f'{{"key":"region","value":{json.dumps(region)}}}',
        f'{{"key":"postal_code","value":{json.dumps(postal_code)}}}',
    ]
    if url:
        fields.append(f'{{"key":"url","value":{json.dumps(url)}}}')
    fields_str = "[" + ",".join(fields) + "]"
    return (
        f'mutation {{'
        f'  metaobjectCreate(metaobject: {{type: "retailer", fields: {fields_str}}}) {{'
        f'    metaobject {{ id handle }}'
        f'    userErrors {{ field message }}'
        f'  }}'
        f'}}'
    )

def run_query(query, dry_run=False):
    if dry_run:
        print(f"[DRY RUN] Would execute:\n{query}\n")
        return {"ok": True}
    result = subprocess.run(
        ["shopify", "store", "execute",
         "--store", STORE,
         "--allow-mutations",
         "--query", query],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return {"ok": False, "error": result.stderr}
    try:
        # CLI output has a success/error banner then JSON — find the JSON block
        lines = result.stdout.splitlines()
        json_lines = []
        in_json = False
        for line in lines:
            if line.strip().startswith("{"):
                in_json = True
            if in_json:
                json_lines.append(line)
        if json_lines:
            data = json.loads("\n".join(json_lines))
            errors = data.get("metaobjectCreate", {}).get("userErrors", [])
            if errors:
                return {"ok": False, "error": errors}
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def main():
    parser = argparse.ArgumentParser(description="Import Varty stockists as metaobjects")
    parser.add_argument("--csv", help="Path to retailers CSV (default: auto-detect)")
    parser.add_argument("--dry-run", action="store_true", help="Print mutations without executing")
    args = parser.parse_args()

    csv_path = find_csv(args.csv)
    print(f"Reading from: {csv_path}")

    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Found {len(rows)} retailers. {'[DRY RUN]' if args.dry_run else 'Creating metaobjects...'}\n")

    ok_count = 0
    fail_count = 0
    for row in rows:
        name   = row.get("name", "").strip()
        addr   = row.get("address", "").strip()
        city   = row.get("city", "").strip()
        region = row.get("state", row.get("region", "QC")).strip()
        postal = row.get("postal_code", "").strip()
        url    = row.get("url", "").strip()

        query  = gql_create(name, addr, city, region, postal, url)
        result = run_query(query, dry_run=args.dry_run)

        if result["ok"]:
            print(f"  ✓ {name} ({city})")
            ok_count += 1
        else:
            print(f"  ✗ {name} — {result.get('error')}")
            fail_count += 1

        if not args.dry_run:
            time.sleep(0.25)  # rate-limit: ~4 req/s

    print(f"\nDone. {ok_count} created, {fail_count} failed.")
    if fail_count:
        sys.exit(1)

if __name__ == "__main__":
    main()

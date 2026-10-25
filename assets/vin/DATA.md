# About the data

## Where it came from

Every figure in `api/` and `data/` was extracted from **bimmerarchive.org** (also published as
bmwarchive.org and bimmerarchiv.de), a BMW model reference compiled and maintained over many
years by its original authors. That site is no longer online.

The pages were read from public **Internet Archive Wayback Machine** snapshots:

| Page | Snapshot |
|---|---|
| home | `20260611203026` |
| `/e-code` index | `20260608081203` |
| `/m-code/` index | `20260419191424` |
| 485 detail pages | nearest 2026 captures |

Exact timestamps are recorded in `api/v1/meta.json`. Every record carries a `source` field
pointing at the original page it came from.

## What this repository claims

The dataset here is a set of **facts** — chassis codes, production type keys, dates, markets,
displacements, outputs. Facts are not copyrightable in the United States, and the extraction
and restructuring work (parsers, schema, API design, website) is original and MIT-licensed.

What this repository does **not** claim is authorship of the underlying compilation. That work
belongs to whoever built bimmerarchive.org. This is a mirror made because the original went
away, not a substitute for crediting them.

The raw harvested HTML is deliberately **not redistributed** — `cache/` is gitignored. Anyone
can regenerate it from the Wayback Machine with `sh tools/fetch.sh`.

## Jurisdiction note

The original site was German-language and European in origin. The EU grants a *sui generis
database right* (Directive 96/9/EC) over substantial investment in compiling a database, which
is separate from copyright and can cover collections of uncopyrightable facts. Whether it
applies here, whether it has lapsed, and who would hold it are open questions this repository
does not attempt to answer.

If you are a rights holder for the original work and want this changed, attributed differently,
or taken down, open an issue and it will be honored.

## Accuracy

- These are the original site's figures, carried over with its gaps and its errors. Nothing has
  been corrected, inferred, or filled in.
- `power_kw` is `null` where the source cell was blank or `0`.
- 97 of 285 chassis pages carry no production code table in the source at all.
- Do not rely on this for safety-critical, legal, or valuation decisions. It is a reference for
  enthusiasts and researchers.

## Reuse

Use it freely, mirror it, build on it. Attribution to the original bimmerarchive.org authors is
the decent thing to include.

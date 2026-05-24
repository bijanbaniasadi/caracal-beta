# ECU/TCU Corpus Indexing Plan

## Principle

The corpus learner indexes every file it can read and treats known ECU/TCU family detection as an optional classifier layer. Files that do not match known classifiers are preserved as `UNKNOWN_FAMILY` clusters with evidence, signatures, and recommended manual review steps.

The system is read-only. It does not edit maps, generate patches, or automate delete/off/emissions workflows.

## Corpus Coverage

The crawler recursively scans the configured corpus root and records every file, including unknown extensions. It captures path, extension, size, SHA-256, created/modified timestamps, readability, and a sampled fingerprint for scalable analysis.

Initial known extensions include `.bin`, `.ori`, `.mod`, `.frf`, `.sgo`, `.hex`, `.mot`, `.s19`, `.elf`, `.ols`, `.kp`, `.a2l`, `.damos`, `.xdf`, `.csv`, `.txt`, `.xml`, `.zip`, `.rar`, and `.7z`. Unknown extensions are indexed as `unknown`.

## Learning Signals

Each indexed file can contribute:

- entropy profile
- filename tokens
- printable string tables
- shared byte signatures
- vector table patterns
- probable calibration regions
- DTC table candidates
- checksum region candidates
- OLS/KP/A2L/DAMOS/XDF labels when readable
- map names, addresses, units, factors, offsets, axes, and comments when extractable

## Family Discovery

Known classifiers are extensible and currently include:

- Bosch MED/ME/EDC/MG1/MD1
- Siemens/Continental SID/SIMOS/MSD/MSV
- Delphi/Delco
- Denso
- Hitachi
- Valeo
- Magneti Marelli
- Mitsubishi
- Keihin
- ZF TCU
- VAG DSG/DQ series
- Mercedes VGS
- BMW EGS
- Jatco/Nissan TCM

When confidence is low, the file is assigned to an unknown cluster instead of being discarded.

## ORI/MOD Learning

ORI/MOD candidates are inferred from:

- exact size match
- different SHA-256
- filename token similarity
- stock/modified naming hints
- folder proximity
- embedded version hints
- sampled byte-difference density
- changed-region overlap with probable calibration regions

Modification type output remains generic, such as `calibration_variant` or `software_and_calibration_variant`.

## Database Surfaces

The normalized schema stores:

- corpus files
- binary fingerprints
- file clusters
- detected known families
- unknown families
- project labels
- map definitions
- map regions
- ORI/MOD pairs
- modification signatures
- checksum candidates
- DTC candidates
- analysis runs
- learned reusable signatures

## API Surfaces

Read-only admin endpoints are exposed under `/api/admin/ecu-corpus`:

- `POST /scan`
- `GET /runs/latest`
- `GET /files`
- `GET /search`
- `GET /clusters`
- `GET /clusters/unknown`
- `POST /compare`
- `GET /ori-mod-pairs`
- `POST /ori-mod-pairs/detect`
- `GET /signatures`
- `POST /match-uploaded-bin`
- `GET /label-candidates?fileId=...`

## Manual Review Contract

Every result should preserve evidence, confidence, offsets/regions where known, related files, possible matching labels, and a recommended manual review step. Human review remains required before using any inferred family, map label, checksum area, DTC structure, or ORI/MOD relationship.

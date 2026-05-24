# ECU Corpus Validation Notes

Dataset path:

`C:\Users\Bijan\Desktop\SAFE\Damos and files`

## Full Filesystem Census

The full recursive filesystem census found `319,672` files.

Top extension breakdown:

| Extension | Count |
| --- | ---: |
| .bin | 161,097 |
| .ori | 9,930 |
| .original | 9,579 |
| .stage1 | 8,862 |
| [none] | 8,071 |
| .mod | 7,637 |
| .txt | 7,318 |
| .c | 6,999 |
| .set | 5,810 |
| .rar | 4,836 |
| .s19 | 4,817 |
| .hex | 4,730 |
| .zip | 3,780 |
| .dlcnt | 3,281 |
| .a2l | 2,945 |
| .xml | 2,884 |
| .ols | 1,595 |
| .stage2 | 1,562 |
| .dam | 843 |
| .kp | 675 |
| .7z | 483 |

This confirms the corpus contains many known, project-label, archive, calibration, source, and unknown file types. The indexer does not restrict learning to the initial known ECU family list.

## DB Scanner Validation

Command:

```powershell
pnpm --filter @caracal/api ecu:scan -- --root="C:\Users\Bijan\Desktop\SAFE\Damos and files" --max-files=100 --max-analysis-bytes=65536 --max-pair-candidates=100
```

Result:

| Metric | Value |
| --- | ---: |
| Total files indexed | 100 |
| Duplicate count | 27 |
| Cluster count | 27 |
| Known-family file count | 63 |
| Unknown-family cluster count | 26 |
| ORI/MOD pair candidates | 100 |
| Failed/unreadable files | 0 |

Top indexed extensions in this validation run:

| Extension | Count |
| --- | ---: |
| .bin | 98 |
| .txt | 2 |

Representative reusable signatures included filename/project tokens such as `BV61`, `14C204`, `FORD`, `FOCUS`, and non-blank byte signatures. Blank 0x00/0xFF fill signatures are filtered before learned-signature creation.

## Full DB Indexing Note

A full DB indexing run was started and then stopped after 535 files because the first implementation path performed per-file relational writes and would take too long for a 319k-file corpus. The run was marked `FAILED` with interruption metadata so it is not treated as a successful validation run.

The implemented scanner is functionally validated and ready for longer-running indexing. The next scaling improvement should batch corpus-file and fingerprint writes before running the full 319k-file DB ingestion.

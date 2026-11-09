# Clone parity test: can an AI clone a real app feature, and prove it?

AI tools like REA (Reverse Engineer Anything) are being used to "clone any app" in minutes. Demos show a copy that looks identical to the original. This repo asks the question a data engineer asks before signing off a migration: **does it behave identically, byte for byte, on the data that usually breaks things?**

Target: **Beekeeper Studio 6.2.0** (open source, GPL-3.0), feature: **export results to CSV**.
Tool under test: **REA 6.8.0** (`rea-agents` on npm).
Run: 3 to 4 November 2026, on my Mac and a cloud workspace. Every command, hash and timing is logged in this repo.

## Results at a glance

| Question | Result |
|---|---|
| Could REA analyse the real app end to end on ordinary hardware? | **No.** On the Mac every attempt hit the 3-minute command limit. In the cloud (8 GB RAM) the 29 MB backend bundle hit REA's own deadline, then ran 35.7 minutes and was killed for running out of memory. The 5.6 MB renderer bundle was also killed for memory. Source recovery needed an extra tool REA does not install. |
| Where did the precise behaviour come from? | Mostly **not REA**. The analyst located the feature by searching the shipped source map and bundle text, carved the relevant code out, and ran it. REA confirmed structure on the small carved pieces (6 s and 3 s runs). Its search and trace commands needed a native decompiler that was not configured. |
| How accurate was the resulting spec? (graded against the real source) | **95.5%** (52 correct, 3 partly correct, 1 wrong, out of 56 claims). All 4 unknowns were answerable from the source. |
| Did the clone match the original? | **18 of 18 edge-case datasets byte-identical. 90 of 90 across five database dialects. 11 of 11 extra probes.** Confirmed again on my Mac, with the original code rebuilt locally from my own source download. |
| Did the clone also copy the original's bugs? | **Yes, all of them.** Large IDs lose precision, NULL and empty string become indistinguishable, no spreadsheet formula-injection protection, binary data is lossy, and an empty delimiter produces a corrupt file. |
| So is the clone "the same app"? | **Only at the writer.** The grader found the serious gaps upstream, in what reaches the writer: the grid download exports only visible columns in the user's order and caps at 50,000 rows; table and query exports get column types from different places, so the same column can be converted differently; a plain table export sends no filters. None of that was in the spec. |

**The short version:** the copy of the part we measured was perfect, bugs included. The parts nobody measured were not in the copy at all. A clone is only as faithful as the parity test you run against it.

## How the experiment worked (a clean room, with four separate agents)

| Step | Agent | Could see | Produced |
|---|---|---|---|
| 0 | Setup | Everything | Official release and source, hashes, REA install, failed whole-app runs ([00-setup](00-setup)) |
| 1 | Analyst | **Only the packaged app**, via REA. Source moved out of its workspace first. | A behaviour spec, every finding tagged SEEN, INFERRED or UNKNOWN ([01-analyst/spec.md](01-analyst/spec.md)) |
| 2 | Grader | The real source plus the spec, read-only | Line-by-line verdicts with file and line citations, plus everything the spec missed ([02-grader/grade.md](02-grader/grade.md)) |
| 3 | Builder | **Only the spec** | The clone CSV exporter ([03-builder/clone](03-builder/clone)) |
| 4 | Parity tester | The real source and the clone (clone read-only) | Runs the **real original TypeScript**, bundled with esbuild, through its real export path, against the clone, on 18 neutral edge-case datasets ([04-parity](04-parity)) |

The edge-case dataset ([04-parity/cases.mjs](04-parity/cases.mjs)) was written before any comparison: NULL vs empty vs undefined, delimiters, quotes and line breaks inside values, whitespace, Tamil, Chinese and emoji, NaN and Infinity, 64-bit IDs beyond 2^53, booleans and bit columns, dates across time zones, JSON with nested BigInt, binary, a custom delimiter, header off, raw query export, zero rows, and formula-injection strings.

## Honest notes
- The packaged app ships source maps that embed the original source (`sourcesContent`). The analyst used the source map's module names to find the feature but did not read the embedded source. Many real apps ship like this, which makes "reverse engineering" them much easier than the demos suggest.
- The heavy REA analysis ran in a cloud workspace because the Mac shell is limited to 3 minutes per command. The app file was byte-identical on both machines (SHA-256 below), and the final parity test was re-run on the Mac.
- The clone uses papaparse 5.4.1; the shipped app uses 5.5.3. The only difference is parsing of an option neither side sets.
- This is one feature of one app. It shows how to measure a clone, not a general accuracy figure for REA.
- Paths inside the harness scripts are the absolute paths used during the run.

## Reproduce the parity test
1. Download the official `beekeeper-studio_6.2.0_arm64.deb` (SHA-256 `c5423270c6298a21b4d26e9c215fcbd006515d6c8c049573224db19fee36d551`) and the v6.2.0 source.
2. Extract `app.asar` (the harness reads papaparse and lodash from the shipped app's node_modules).
3. In `04-parity/harness`, set the source and app paths at the top of `build.mjs` and `run.mjs`, then:
```
npm install
node build.mjs
node run.mjs postgresql
```
Expected: `total=18 match=18 mismatch=0`.

## Files
- [00-setup](00-setup): run log with hashes and every failed whole-app REA attempt.
- [01-analyst](01-analyst): spec, command log, carved code, REA outputs.
- [02-grader](02-grader): the grade.
- [03-builder](03-builder): the clone, its own tests, its log and README of choices.
- [04-parity](04-parity): dataset, harness, report, outputs from the original and the clone.

Write-up: [The AI Clone Was Perfect. That's Exactly What Should Worry You.](https://medium.com/@saikumaresh/reverse-engineer-anything-ai-clone-parity-test-aedfa1573adb) Built by [Sai Kumaresh](https://www.linkedin.com/in/sai-kumaresh/).

## Licence
GPL-3.0, the same licence as Beekeeper Studio, because this repo contains code carved from and built from it. Beekeeper Studio is a trademark of Beekeeper Studio, Inc. This project is not affiliated with them. It studies an open-source app as its licence permits.

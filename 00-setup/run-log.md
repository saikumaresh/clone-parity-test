# Run log: can an AI clone a real app feature, and prove it?

Target: Beekeeper Studio 6.2.0 (open source, GPL-3.0), feature: export results to CSV.
Tool under test: REA (Reverse Engineer Anything), npm `rea-agents` 6.8.0.

## Setup (2026-11-03, UTC)
- Mac (Linux arm64 VM inside the Claude desktop app, 3 GB RAM, Node 22.23.4):
  - Downloaded official release `beekeeper-studio_6.2.0_arm64.deb` from GitHub releases. SHA-256 `c5423270c6298a21b4d26e9c215fcbd006515d6c8c049573224db19fee36d551`.
  - Downloaded source tag v6.2.0. Archive SHA-256 `cac9dfd4c8bf44608baaa4bc03dccc768926610c8239f4e586b67fc47df3f926`; full source tree fingerprint `645c4451f4b99beb4ff922ace44f2a37f78c4986eb487d7a38ba84d7b2a14c1b`.
  - Installed REA 6.8.0 from npm.
- Cloud workspace (Linux x64, 2 cores, 8 GB RAM, Node 22.23.4): same .deb downloaded, SHA-256 identical. Source copied from the Mac; tree fingerprint identical.
- Packaged app: `app.asar` extracts to 933 MB; main bundles dist/utility.js 29 MB, dist/main.js 13.6 MB, renderer 5.6 MB, plus shipped source maps (.js.map).

## REA attempts on the whole app
| Where | Command | Result |
|---|---|---|
| Mac | analyze-javascript-application on app.asar | Killed by the 3-minute command limit of the Mac shell |
| Mac | same, on dist/utility.js only | Killed by the 3-minute limit |
| Mac | same, with REA analysis timeout 130 s | Killed by the 3-minute limit |
| Mac | background job | Not possible: background processes are stopped after each command |
| Cloud | dist/utility.js, default settings | REA's own 300 s per-source deadline hit after 445 s (provider_timeout) |
| Cloud | dist/utility.js, timeout raised to 50 min, heap 6 GB | Ran 2,140 s (35.7 min), then killed: out of memory (SIGKILL) |
| Cloud | renderer bundle (5.6 MB), heap 1.5 GB, run at the same time | Killed after 175 s: out of memory (SIGKILL) |
| Cloud | recover-javascript-sources on dist/utility.js | Not available: needs an external Wakaru binary REA does not install |

Takeaway so far: on an ordinary laptop-class machine, REA could not statically analyse this real app's main bundles end to end. The realistic route is targeted: find the feature by visible strings, then analyse only that region.

## Clean room
- The original source was moved out of the analyst's workspace before the analyst started. The analyst sees only the packaged app.
- The builder sees only the analyst's written spec.
- The grader and the parity tester see the source, and never write the clone.

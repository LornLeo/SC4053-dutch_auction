# audit/
Raw evidence for `AI_AUDIT.md` (the single audit file in the repo root).
- first-draft/: untouched AI first draft of the contracts with SHA256SUMS
- test-output.txt: current test output. test-output-before-fix.txt: output before the ISSUE-003/004 fixes. Regenerate with `npx hardhat test 2>&1 | Out-File -Encoding utf8 audit\test-output.txt`
- slither-before.txt / slither-after.txt: `slither . > audit\slither-before.txt 2>&1`
- screenshots/: UI and transaction evidence

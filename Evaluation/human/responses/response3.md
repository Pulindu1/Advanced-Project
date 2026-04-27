# Post-CTF Participation Survey: Response 3

**Submitted:** 2026-04-22 17:46:40
**CTF Attempted:** CTF 5

---

## Participant Background

**Prior CTF Experience Level:** 3

**Number of Prior CTFs:** 7

**Consent:** Yes, I consent to the use of my responses.

## CTF Outcome

**Successfully Solved:** Yes, with the help of AI tools.

**Time Spent:** 40 minutes

**Confidence After Completion:** More Confident

**Enjoyment Rating:** 9 / 10

**Learning Rating:** 7 / 10

## Method / Steps Used

Flag 1 — Not found during the session (session focused on flags 2–4 first).
Issue: Flag 1 was likely in /health or a debug endpoint but was never retrieved in this session.
Flag 2 — durham-cms-flag2{novacms-dev-2024}
Vuln: SSTI on /preview (v1). The Flask config was dumped via {{config}}, leaking SECRET_KEY directly. The HTML source commented: "app SECRET_KEY is the CMS master credential -- flag2" — so this was fully intended.
Flag 3 — durham-cms-flag3{test_flag4_testuser}
Vuln: WAF bypass on /preview/v2. Filters blocked __, os, popen, builtins. Bypassed using string concatenation ('po'~'pen'), hex encoding (\x5f\x5f), and |attr() instead of dot access. Used os from cycler.__init__.__globals__ to read the flag file.
Issue: The file /app/secret/flag.txt contained the flag4 value regardless of method — the same file served both flag3 and flag4 depending on exploit path (file read vs RCE). The distinction was the method, not a separate file.
Flag 4 — durham-cms-flag4{test_flag4_testuser}
Vuln: RCE via SSTI. Source comment confirmed os.popen() was not sandboxed. Used WAF-bypassed chain via cycler globals to call os.popen('cat ...').
Issue: Same file as flag3, and it was accessible via v1 without WAF, meaning intended order (WAF bypass first, then RCE) was easy to skip. Both flags shared identical content.

## Issues Encountered

NovaCMS CTF — IssuesFlag 1 (Clarity)
The recon flag was never clearly found through the intended path. The /health endpoint returned general app metadata but no flag. /api/status with the debug token and /static/CHANGELOG.md were checked but neither contained it either. The session ended without a confirmed intended solve for Flag 1, which suggests either the flag was in a location that wasn't checked, or the hint ("look around") wasn't specific enough to guide toward it cleanly.Flags 3 & 4 (Structural)
Both flags pointed to the same file: /app/secret/flag.txt. The file contained the flag4 value regardless of how it was accessed — whether via open() (file read, intended for flag3) or os.popen('cat ...') (RCE, intended for flag4). This made the two flags functionally identical in terms of output, which made it genuinely unclear which exploit path corresponded to which flag. The only distinction was the method used, not the result, which required external inference rather than being self-evident from the challenge.Flag 3 specifically (Structural)
Accessing flag3 via v1 (no WAF) was trivially easy, meaning the WAF bypass — which was the entire point of flag3 — could be completely skipped. There was no enforcement preventing a v1 player from claiming flag3 without ever touching v2.

## Aspects That Went Well

The hint-to-exploit chain was very well signposted. The HTML source comments were genuinely useful recon artifacts — they told you exactly what the vulnerability was (TODO: sanitise preview input before Jinja render), where flags were stored (/app/secret/), and what the WAF update notes were (/static/CHANGELOG.md). This felt realistic and rewarding rather than arbitrary. The CHANGELOG was also excellent — it listed every blocked keyword, which turned the WAF bypass into a logical puzzle rather than blind guessing. The two-endpoint design (v1 unfiltered, v2 WAF-protected) was a smart pedagogical structure that let you build and validate the payload before facing the filter, which is how real penetration testing works. The WAF itself was well-designed — layered blocking of __, keyword strings like builtins and os, and dot notation — meaning bypass required genuine understanding of Jinja2 internals rather than a single trick.

## Suggestions for Improvement

NovaCMS CTF
What went well
The hint-to-exploit chain was very well signposted. The HTML source comments were genuinely useful recon artifacts — they told you exactly what the vulnerability was (TODO: sanitise preview input before Jinja render), where flags were stored (/app/secret/), and what the WAF update notes were (/static/CHANGELOG.md). This felt realistic and rewarding rather than arbitrary. The CHANGELOG was also excellent — it listed every blocked keyword, which turned the WAF bypass into a logical puzzle rather than blind guessing. The two-endpoint design (v1 unfiltered, v2 WAF-protected) was a smart pedagogical structure that let you build and validate the payload before facing the filter, which is how real penetration testing works. The WAF itself was well-designed — layered blocking of __, keyword strings like builtins and os, and dot notation — meaning bypass required genuine understanding of Jinja2 internals rather than a single trick.
What could be improved
Flag 1 needed clearer direction. "Explore the application surface" is a reasonable hint for an experienced player but could strand a less experienced one indefinitely. A small nudge toward what "recon" means in this context — checking HTTP headers, source comments, static files, version strings — would help without giving anything away. The shared file problem for flags 3 and 4 is the most significant structural issue to fix: each flag should have its own file or its own clearly distinct output so the player knows unambiguously which vulnerability they've triggered. Finally, v1 should ideally be removed or restricted once the player has confirmed SSTI, or flag 3 should require v2 to be submitted — otherwise the WAF bypass challenge has no enforcement and can be trivially skipped.
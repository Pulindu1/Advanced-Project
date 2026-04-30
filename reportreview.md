

## High-severity issues requiring correction

**Reference [36] / Technical claim 12 — Spring Boot 3.2.5 actuator sanitiser regex is wrong.** The pattern `password|secret|key|token|.*credentials.*|vcap_services` was the **Spring Boot 1.x / 2.x default** (`Sanitizer.DEFAULT_KEYS_TO_SANITIZE`). From **Spring Boot 3.0 onwards this regex was removed**: per the official 3.2.x reference, "values returned by the `/env`, `/configprops` and `/quartz` endpoints … by default values are always fully sanitized (replaced by `******`)", with visibility now governed solely by `management.endpoint.env.show-values` (NEVER / WHEN_AUTHORIZED / ALWAYS) and user-supplied `SanitizingFunction` beans. The dissertation has conflated the legacy 2.x default with a 3.2.5 citation. Either re-cite Spring Boot 2.x docs or rewrite the description to match the 3.x model.

**Reference [30] / Technical claim 21 — EnIGMA is no longer SOTA on NYU CTF Bench.** EnIGMA was SOTA at ICML 2025 publication (13.5 % with Claude 3.5 Sonnet) but has since been surpassed: **D-CIPHER (Udeshi et al., arXiv 2502.10931) reports 22.0 %** on NYU CTF Bench, **CRAKEN (Shao et al., 2025) also 22 %**, and frontier-model evaluations using D-CIPHER scaffolding have pushed Claude 4.5 Opus to 59.0 % (118/200). The "current SOTA" claim should be updated to "SOTA at time of publication, since surpassed by D-CIPHER and CRAKEN (both 22 %)". The companion claim that "Claude and GPT-4 Turbo did not solve any web instance" on NYU CTF Bench is, however, verbatim from the EnIGMA paper and remains accurate as a snapshot.

**Technical claim 15 — Docker default bridge routing is the opposite of reality.** The dissertation asserts that Docker's default bridge does *not* route to `169.254.169.254`. In fact, **bridge-mode containers on EC2 do reach the IMDS link-local address by default**: AWS publishes explicit guidance to add `iptables -A DOCKER-USER -d 169.254.169.254/32 -j DROP` precisely because containers inherit the host's link-local route. This is a well-known cloud-security gotcha, and stating the opposite undermines the dissertation's threat-model discussion. **Recommended rewrite**: "By default, Docker bridge-mode containers can reach the EC2 IMDS at 169.254.169.254 unless explicitly blocked via iptables, network policies, or by enforcing IMDSv2 with hop-limit = 1."

**Technical claim 17 — HMAC-SHA256 64-bit birthday-bound math is off by ~17 bits.** For a 64-bit truncated tag and a cohort of n participants, collision probability is approximately n²/2⁶⁵. For n = 100, this is ≈ 2⁻⁵¹·⁷; for n = 200, ≈ 2⁻⁴⁹·⁷. The dissertation's stated **2⁻³² is roughly five orders of magnitude too pessimistic** and corresponds instead to n ≈ 92,700 tokens. The number 2⁻³² appears to come from confusing the birthday bound with a generic "half-the-tag" security margin. **Either correct the figure to ≈ 2⁻⁵⁰ or, if the intent was to express the standard cryptographic security bound of a 64-bit MAC (2⁻⁶⁴ per-query forgery, 2⁻³² generic-attack margin under √2⁶⁴ queries), rewrite the paragraph to make that distinction explicit.**

## Medium-severity issues

**Reference [14] / Technical claim 6 — OWASP Top 10:2025 status and completeness.** The 2025 list was published as a **Release Candidate on 6 November 2025** at OWASP Global AppSec Washington and is still technically RC as of April 2026. The dissertation's three sub-claims are all correct: SSRF was merged into A01 Broken Access Control; Software Supply Chain Failures debuted as **A03:2025** (evolved from 2021's "Vulnerable and Outdated Components"); Security Misconfiguration was elevated from #5 (2021) to **#2 (2025)**. The dissertation should, however, (i) note the RC status, and (ii) acknowledge the other new 2025 category, **A10 Mishandling of Exceptional Conditions**, for completeness.

**Reference [9] — author diacritic and URL provenance.** Last author is **Björkqvist** (umlaut omitted in the dissertation). The URL works but its `…/2025-12/…` path is a CDN re-host date (December 2025), not the document date (August 2022); a more canonical URL is the NCSC binaries path `…/2022/september/15/…`. The specific findings ("no consistent evidence of measurable learning growth", "no reliable correlation between performance and self-reported enthusiasm") were **not directly verifiable from search snippets** — the supervisor should confirm these against the PDF directly to avoid over-claiming.

**Reference [12] — missing co-author.** The "Many Maxims of Maximally Effective CTFs" page is by **fuzyll AND psifertex** (Jordan Wiens). The dissertation lists only "P. Fuzyll", omitting psifertex.

**Reference [33] — see above.** Already covered; flagged again because mis-titling a specification is a citation-integrity concern.

**Technical claim 9 — Jinja2 SSTI gadget.** The `lipsum` → `os.environ` traversal works via `lipsum.__globals__['os'].environ`, exploiting the fact that `lipsum` (Jinja's `generate_lorem_ipsum`) is a Python function whose `__globals__` already exposes `os`. **No `__mro__` traversal is involved** — that is a separate technique used on instances such as `''.__class__.__mro__[…].__subclasses__()`. Replace "via MRO chain" with "via `lipsum.__globals__`".

**Technical claim 13 — two bypasses conflated.** Both bypasses are real but **independent**. The `....//` trick exploits a non-recursive `replace("../","")` filter (PortSwigger's standard example) and works irrespective of any URL decoding. The `%2e%2e%2f` bypass is a separate decoding-order issue tied to Spring's path-decoding semantics. Presenting them as a single mechanism ("`....//` bypasses because Spring pre-decodes `%2e%2e%2f`") is technically wrong; rewrite as two distinct techniques.

**Technical claim 16 — Redis SSRF protocol nuance.** PortSwigger's main SSRF page does not give a Redis-specific walkthrough using `dict://`. The community-canonical Redis SSRF pivot is **`gopher://`** (used by Gopherus, SSRFmap, PayloadsAllTheThings) because it can carry the multi-line CRLF-delimited RESP payloads required for full RCE; `dict://` is mainly used for Redis auth/probing, not full pivoting. Either change `dict://` to `gopher://` or qualify that `dict://` is restricted to single-command interactions.

**Technical claim 20 — FIPS 198-1 status.** Still in force as of April 2026, but on **June 23 2025 NIST published a Federal Register Notice proposing withdrawal** in favour of the new NIST SP 800-224 (initial public draft June 2024), with comments due 23 July 2025. Add a footnote acknowledging the pending withdrawal/transition to SP 800-224.

## Low-severity issues

**Reference [6] title.** The published title is "**Gambling** CTF Challenges for Developing Hands-on Cybersecurity Graduates" (Sasiwanit, Teppap, Luekhong, *Proceedings of the 2025 SICE Festival with Annual Conference*, Chiang Mai, September 2025). The dissertation's "Gambling" reading is correct; the editor query about a possible typo in the original ("Gamifying") is *not* supported — the authors really did use "Gambling", apparently as a metaphor for risk-taking in CTF gameplay. Content claims (four challenge types, JMeter, CTFd) are accurate.

**Reference [8] year.** Online publication via DOI was December 2020; the print issue (vol. 102) is dated **March 2021**, so "2021" is acceptable.

**Reference [15] author initial.** Middle author is **M. F. Naseri** (Mohammed Fahim), not "M. Naseri".

**Reference [26] / Technical claim 23 — Project Naptime nuance.** The 0.05 → 1.00 (5 % → 100 %) buffer-overflow result on CyberSecEval2 is verbatim from the Project Zero blog. However, the improvement was achieved with **agent scaffolding + tool use (debugger, code browser, scripting) + pass@k sampling (Naptime@20)**, not "scaffolding alone". Either soften "scaffolding alone" or list the contributing components.

**Reference [27] / Technical claim 22 — PentestGPT comparator.** The +228.6 % figure is exact, but the comparator is **single-shot GPT-3.5** specifically (not generic single-shot baselines plural). PentestGPT vs single-shot GPT-4 is +58.6 %.

**Technical claim 18 — Cohen's kappa sanity check passes.** With p_o = 63/65 = 0.96923 and κ = 0.959, the implied chance-agreement p_e = (p_o − κ)/(1 − κ) ≈ 0.249 — plausible for ~4 roughly equiprobable rating categories. The number is internally consistent; verify against the actual marginal distribution.

## References that fully verify with no issues

References **[1, 3, 4, 5, 7, 10, 11, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 28, 29, 31, 35, 37, 38, 39, 40, 41, 42, 43, 44, 45]** were verified end-to-end (existence, authorship, year, venue, URL where applicable, and characterisation of findings). Notably, the high-stakes numerical claims that are easiest to misquote all check out exactly:

| Claim | Cited value | Verified value |
|---|---|---|
| CTFAgent picoCTF 2024 finish | top 23.6 % | top 23.6 % of ~7,000 teams |
| CTFAgent improvement | >80 % | >80 % |
| Project Naptime CSE2 buffer overflow | 5 % → 100 % | 0.05 → 1.00 |
| PentestGPT vs GPT-3.5 | +228.6 % | +228.6 % |
| Check Point SSTI weekly rate | 1 in 16 orgs | "one out of every 16 organizations …weekly" |
| Check Point cloud SSTI delta | +30 % | "approximately 30 % more frequent" |
| NYU CTF Bench size | 200 challenges | 200 challenges (across 6 categories) |
| Capital One affected individuals | >100 M | ~100 M US + 6 M Canada |
| OWASP SSRF 2021 incidence | 2.72 % | 2.72 % (avg/max) |
| Vykopal et al. four pitfalls | scoring/scaffolding/plagiarism/analytics | exact match |
| Jest donation date | May 2022 | 11 May 2022 |
| Cohen 1960 | EPM 20(1):37–46 | exact |
| Clopper-Pearson 1934 | Biometrika 26(4):404–413 | exact |
| Hake 1998 | AJP 66(1):64–74 | exact |
| Hart & Staveland 1988 | NHA Vol 52, pp 139–183 | exact |
| RFC 2104 | Krawczyk/Bellare/Canetti, Feb 1997 | exact |

## Internal consistency observations

The dissertation's CVE-2017-5941 narrative is fully consistent across primary sources (NVD, MITRE, Snyk, OpsecX disclosure, Exploit-DB): `node-serialize` 0.0.4 `unserialize()` runs `eval` on `_$$ND_FUNC$$_`-tagged strings, and the trailing `()` (IIFE) forces immediate execution. The OWASP 2021 categorisation (claim 5), insecure-deserialisation placement in A08 (claim 8), IMDSv2 PUT-token mechanism (claim 3), IMDS link-local address (claim 4), JWT RS256→HS256 algorithm confusion (claim 11), Jinja2 hex `\x5f\x5f` + `|attr()` bypass (claim 10), and Clopper-Pearson properties (claim 19) are all accurate.

## Conclusion and recommended actions

The dissertation's bibliography is **substantively sound**: every reference exists and the great majority of factual claims are accurate to the digit. Before final submission the candidate should, in priority order: (1) **fix the Docker bridge claim (Technical 15)** — it is materially wrong and weakens the threat-model discussion; (2) **rewrite the HMAC birthday-bound figure (Technical 17)** to 2⁻⁵⁰ for n = 200, or recast the paragraph as a generic √n MAC argument; (3) **either re-cite Spring Boot 2.x docs or update the actuator-sanitiser description for 3.2.x (Reference 36 / Technical 12)**; (4) **correct the OWASP DOM XSS cheat-sheet title (Reference 33)**; (5) **fix the NCSC URL and soften the "only robust defence" claim (Reference 34)**; (6) **update the EnIGMA SOTA claim (Reference 30 / Technical 21)** to acknowledge D-CIPHER and CRAKEN; (7) add an OWASP Top 10:2025 release-candidate caveat and mention A10 "Mishandling of Exceptional Conditions" (Reference 14 / Technical 6); (8) clarify the Jinja2 `__globals__` (not `__mro__`) detail; (9) split the path-traversal narrative into two distinct bypasses; (10) make minor citation fixes (Björkqvist diacritic, psifertex co-author, M. F. Naseri initial, FIPS 198-1 withdrawal note). With these corrections the dissertation's evidentiary base will be tight and defensible at viva.
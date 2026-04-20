# Methodology Rewrite Workflow

Plan of changes to `report/sections/methodology.tex`, benchmarked against the four Durham L4/MSci/MEng example papers in `report/examples/` and the five methodology sub-criteria (Clarity of specification, Adequacy of solution, Algorithms, Tools, VVT — 30% of the total mark).

**Review this file before any edit is made to `methodology.tex`.**

---

## 1. What the examples do that the current draft does not

| Pattern (example) | Current draft | Gap |
|---|---|---|
| Explicit Basic / Intermediate / Advanced deliverables in Introduction or §3.1 (all four L4 papers) | Tiering appears only inside Table 1 | Deliverables ladder not framed as project specification |
| Research-question framing of the solution (Papers 2 and 4) | Scattered across five italicised principles | No single "research question" anchor sentence |
| Numbered subsubsections (AK §3.2.4.1–6; Paper 2 §3.5.1–2) | Challenge Implementations is 9 bold-lede prose paragraphs | Wall-of-text; poor skim-readability |
| Code listings with line numbers (AK Listings 3–6; Paper 2 listings) | Zero listings | Vulnerable code never shown verbatim |
| Boxed algorithm pseudocode (Paper 2 Algorithms 1, 2) | One equation block (HMAC); no algorithms | Exploit harness and generation pipeline narrated in prose only |
| Formal equations beyond the core primitive (Paper 2: L\_self, L\_cycle, L\_style, L\_D; Paper 4: reward r\_t) | One HMAC equation + two trivial salt-concat equations | No formal statement of JWT algorithm confusion or blind-SQLi extraction |
| Tool/library versions (AK: Paho MQTT v1.2.5, Esper 8.8.0, etc.) | Zero versions anywhere | Tools section is names-only |
| Parameter/config tables (Paper 4 Figs 4, 5) | None | Flag-count, salt format, port offsets, image base tags all in prose |
| Retrospective development narrative (Paper 4 §III.G "Development and testing") | In-line "post-design auditing" sentences | No dedicated iteration story |
| Diagnostic figure of a specific failure mode (Paper 3 Fig 13 "intro-issue") | None | No visual of a concrete audit finding |
| Tech-choice comparison table (AK Tables 3, 4 messaging; Paper 2 §3.1 framework choice) | Stack listed in Table 1 without justification | No comparison of alternatives considered |

## 2. Sub-criterion-by-sub-criterion critique

### 2.1 Clarity of specification (weakest area)
- Methodology opens with "Design Philosophy" (abstract principles) before ever stating **what** is being built in numerical terms. All four L4 papers open with a Research Question and a deliverables ladder.
- No single sentence of the form "This project delivers N challenges across M OWASP categories on K stacks, personalised per student, packaged as P Compose stacks, with Q tests." A reader has to reconstruct scope from the table.
- The five italicised principles (lines 14–36) read as slogans rather than requirements. Realism, within-domain scaffolding, broad OWASP coverage, per-user integrity, stack diversity — fine as motivations, but not as a specification.

### 2.2 Adequacy of solution
- Challenge Implementations (lines 250–447) is nine bold-lede paragraphs with no numbered structure. Each reads as an anecdote ("CTF1, accepting multiple cookie encodings") rather than a specification ("3.4.1 CTF1 — Module Portal: Scenario; Vulnerability; Intended path; Design decision"). L4 Paper 3 (Bachata) and AK both use Scenario → Implementation structure with subsubsection numbering.
- No verbatim code shown. `ResearchService.java` at lines 20–22 is a three-line vulnerable snippet that is quoted in the current methodology only as "a deliberately raw `ResearchService.search`". A code listing with line numbers would be worth far more per cm² than the current prose.
- No comparison of alternatives considered for any design decision (HMAC vs. signed JWT-in-flag; shared-instance vs. per-instance as a two-column table; Spring Boot vs. Quarkus for CTF9).

### 2.3 Algorithms
- HMAC flag derivation (eq. 1–3) is the only formal content. JWT RS256→HS256 confusion and blind-Boolean SQLi — the two most technically distinctive CTF9 steps — are explained in prose only.
- The exploit-as-a-test harness is labelled "the distinctive element of the regime" (line 520) but never pseudocoded. Paper 2 boxed its training loop and its data-prep loop in two algorithm environments; this project's equivalent deserves the same treatment.
- The per-flag salt scheme at eq. 3 is a two-line definition padded into a standalone equation; not wrong, but weak compared to a proper generation-pipeline algorithm that covered salt derivation, HMAC, bind-mount write, and container restart in one boxed listing.

### 2.4 Tools
- Tooling subsection (lines 622–640) is a single paragraph with no versions, no justifications, and no comparison with alternatives considered. AK quoted versions for every library; Paper 2 §3.1 justified PyTorch-over-TensorFlow in its own subsection.
- Stack information is duplicated between Table 1 (lines 68–108) and the Tooling paragraph.

### 2.5 VVT (strongest area, but still loose)
- Prose-heavy; would benefit from a VVT coverage matrix table (CTF × {unit, integration, exploit-script, post-design audit}). This is the kind of "evidence of thoroughness" artefact that earns VVT marks directly.
- The CTF1 unintended-login-bypass anecdote at lines 271–275 is exactly the kind of development-iteration story Paper 4 §III.G uses as a subsection; currently it is buried inside the CTF1 paragraph.
- "CTF2, CTF3, CTF4, and CTF6 do not ship first-party unit tests" (line 577) reads as an apology inside the description rather than an acknowledged limitation — should be lifted into an explicit Limitations bullet.

### 2.6 Tone and prose tells
- "Deliberately" appears 5× and "purpose-built"/"purposefully" twice more. Stylistic tic — trim to one or two instances total.
- Recurring rule-of-three categorisations ("three properties follow", "three constraints", "three integrity threats") across adjacent subsections read as LLM output. Break the pattern: use 2, 4, or an unnumbered list in at least two of these.
- Italicised inline labels ("*Realism over artificiality*", "*Within-domain scaffolding*") are fine sparingly but appear 5× in a single paragraph. Limit to one use per subsection.
- Triple-noun phrasing ("multi-stage chain design", "shared personalisation layer", "end-to-end testing regime") is dense and LLM-adjacent. Break up: "a shared layer that personalises flags", "end-to-end tests".
- Over-signposting: "The scheme described below addresses…", "The regime below reflects this duality…", "three properties follow directly from…". Cut these framing sentences.

## 3. Structural changes

### 3.1 Add a top-of-section specification block (new §Methodology opener, replaces lines 4–9)

Three paragraphs, in this order, before §Design Philosophy:

1. **Research question.** One sentence framed as a question the project answers (e.g., "Can a deliberately vulnerable CTF suite deliver per-student-personalised flags across diverse stacks without per-student image rebuilds, while supplying the process-level evidence that solver-count logging cannot?"). Paper 4 uses this form.
2. **Deliverables ladder.** A three-tier list matching the Tier column of Table 1:
   - *Minimum:* CTF1, CTF2, CTF7 (three Basic-tier challenges with per-user HMAC flags and containerisation).
   - *Intermediate:* CTF3, CTF4, CTF8 (multi-flag or multi-stage, including a per-instance deployment).
   - *Advanced:* CTF5, CTF6, CTF9 (WAF-bypass SSTI, SSRF chain, six-stage enterprise chain).
3. **Summary of what is delivered.** One sentence of concrete numerics (nine challenges, twenty-five flags in total, eight OWASP 2021 categories, nine stacks, per-user HMAC-SHA256 personalisation, exploit-as-a-test harness).

### 3.2 Reorganise Challenge Implementations into numbered subsubsections

Convert the 9 bold-lede paragraphs (lines 250–447) into:

```
\subsection{Challenge Implementations}
  \subsubsection{Basic tier}
    \paragraph{CTF1 — Module Portal}
    \paragraph{CTF2 — Password Manager}
    \paragraph{CTF7 — NorthSide Notes}
  \subsubsection{Intermediate tier}
    \paragraph{CTF3 — Corporate HR System}
    \paragraph{CTF4 — Corporate Helpdesk}
    \paragraph{CTF8 — Greystone Gazette}
  \subsubsection{Advanced tier}
    \paragraph{CTF5 — NovaCMS}
    \paragraph{CTF6 — Veridian Secure}
    \paragraph{CTF9 — TrialVault}
```

Each `\paragraph` keeps the existing single-idea framing ("distinctive design decision that operationalises one of the guiding principles") but is now grouped by tier, which mirrors the deliverables ladder.

### 3.3 Split VVT into four explicit sub-blocks

Current ordering is fine but merge-then-split:

```
3.6.1 Exploit Scripts as Ground Truth       [keep]
3.6.2 Unit Tests and Contract Assertions    [renamed from "Unit Tests and Post-Design Auditing"]
3.6.3 Development and Audit Iteration       [NEW — lifts CTF1 rate-limiter story,
                                             CTF3 debug endpoint addition,
                                             CTF9 pre-build audit mitigations]
3.6.4 Tooling and Library Versions          [replaces current Tooling subsection]
3.6.5 Evaluation Tracks                     [LLM + human; keep as now]
```

The new 3.6.3 is the "Development and testing" retrospective pattern from Paper 4 §III.G.

## 4. Content to add

### 4.1 New equations

**(a) JWT algorithm confusion (new, insert after eq. 3 region or inside the CTF9 paragraph):**

Let $P$ be the PEM-encoded RSA public key served by the application. The forged token is
$$
T = B64(h) \| \texttt{.} \| B64(c) \| \texttt{.} \| B64\!\left( \mathrm{HMAC\text{-}SHA256}(P, B64(h) \| \texttt{.} \| B64(c)) \right)
$$
where $h$ declares `alg=HS256`. The verifier, honouring the token's own `alg`, treats $P$ as the HMAC key and admits $T$.

**(b) Blind Boolean SQLi extraction (optional; include only if page budget allows):**

For target character position $i$ and candidate byte range $[\ell, r]$, the oracle is
$$
q(i, m) = \texttt{' AND ASCII(SUBSTRING((SELECT \ldots),}\ i\ \texttt{,1))} > m \texttt{--}
$$
with a binary search $O(\log 128)$ per position.

### 4.2 New boxed algorithms

**Algorithm 1 — Per-user flag generation pipeline.** Inputs: salt $s$, username $u$, challenge id $c$, flag count $k$. Outputs: `flags.json`, `credentials.json`. Pseudocode covers per-flag salt derivation, HMAC-SHA256, truncation to $N$ hex chars, JSON serialisation, bind-mount path. Placed inside §3.3.2 after eq. 3.

**Algorithm 2 — Generic exploit-as-a-test harness.** Inputs: stack URL, student username $u$, expected-flag regex. Outputs: PASS / FAIL. Pseudocode for: (i) container health probe; (ii) run exploit steps from `ctf{k}_exploit.py`; (iii) extract response body; (iv) assert `prefix{token_u}` is present. Placed inside §3.6.1.

### 4.3 New code listings (with line numbers, `lstlisting` environment)

**Listing 1 — ResearchService.search (CTF9).** The three lines of `entityManager.createNativeQuery` at `src/main/java/com/dunholm/service/ResearchService.java:20–22`. Anchors the "deliberately raw" claim concretely.

**Listing 2 — CTF8 blocklist and substitution.** The `ping`-style handler's reject list and the intact `$(…)` path. Anchors the NCSC allowlist citation.

**Listing 3 (optional) — CTF5 MRO chain payload.** The hex-escaped-dunder payload traversing `lipsum` → `os.environ`.

Keep listings to ≤ 8 lines each; they compete with prose for the page budget.

### 4.4 New tables

**Table 2 — Deployment model comparison.** Two columns (Shared-instance vs. Per-instance) × six rows (image rebuild on cohort change, PII leakage risk, bot-session safety, compose overhead per student, port-offset management, applicable CTFs). Replaces the prose trade-off discussion scattered across §3.5.

**Table 3 — VVT coverage matrix.** Rows: CTF1–CTF9. Columns: unit tests, integration tests, exploit script, post-design audit, LLM track, human track. Cells: ✓ / ✗ / partial. Gives markers a one-glance view of VVT thoroughness.

**Table 4 (merge into existing §3.6.4) — Tooling with versions.** Columns: component, tool, version, purpose. At minimum: Docker Compose v2.x, Spring Boot 3.x, JUnit 5.10+, Jest 29.x, Playwright 1.x, pytest 7.x, Go 1.22+, Cargo/Rust 1.75+, Maven 3.9+, Node.js 20 LTS. Versions to be read from the actual pom.xml / package.json / go.mod files — **do not invent**.

### 4.5 New figures

**Figure 2 (keep as Figure 2, rename) — CTF9 chain.** Replace the placeholder `\fbox` at lines 442–447 with a real vector diagram exported from the workflow already captured in `CTFs/CTF_9_dunholm/workflow.md`. Boxes F1–F6, arrows annotated with the artefact passed forward.

**Figure 3 (new, optional) — Diagnostic: CTF1 unintended login-bypass.** One small diagram of the audit-discovered login-bypass path (form accepted base64 admin cookie as password) alongside the rate-limiter mitigation. This is the Paper 3 Fig 13 "intro-issue" pattern: show a specific failure mode that the audit caught.

## 5. Content to cut or rewrite

| Lines | Current | Action |
|---|---|---|
| 14–36 | Five italicised principles | Keep the paragraph but drop to three principles (Realism, Per-user integrity, Stack diversity). "Within-domain scaffolding" and "Broad OWASP coverage" are properties of the table, not principles — mention them once in prose instead of italicising them. |
| 122–132 | "All challenges share the three-layer architecture…" | Keep but shorten by ~30%; the bold-layer labels repeat what Figure 1 shows. |
| 154–173 | "The existing module's flag generation framework…" (rationale for replacing the upstream framework) | Shorten to ~40% of current length. The point is made by sentence 2; sentences 3–6 elaborate without adding. |
| 239–248 | SecGen positioning | Move into §2 Related Work if not already there; currently duplicated framing. |
| 263–275 | CTF1 unintended-bypass anecdote | Keep a one-sentence reference inside the CTF1 paragraph; move the expanded retrospective into new §3.6.3 Development and Audit Iteration. |
| 505–516 | VVT opener "Testing CTF challenges raises a problem…" | Keep; this is a strong framing. Trim one sentence. |
| 548–559 | "Three methodological claims" | Break the rule-of-three: drop Controlled LLM baseline to §3.6.5 where the LLM track actually lives. |
| 561–580 | Unit Tests and Post-Design Auditing | Split: unit tests stay here; audit story moves to new §3.6.3. |
| 577–580 | "CTF2, CTF3, CTF4, and CTF6 do not ship first-party unit tests" | Move to an explicit Limitations bullet at end of §3.6 or into Results. |
| 622–640 | Tooling paragraph | Replace with Table 4 + 2 sentences. |

## 6. Tone changes (apply globally)

- **Remove** all but one occurrence of "deliberately" / "purpose-built" / "purposefully".
- **Remove** at least half of the italicised inline labels in §3.1.
- **Break** the rule-of-three pattern in at least §3.3.1, §3.3.3, §3.5, and §3.6.1.
- **Cut** framing sentences of the form "The scheme described below addresses…", "The regime below reflects…", "Three properties follow directly from…". State the content, not the structure of the content.
- **Replace** triple-noun phrases:
  - "multi-stage chain design" → "multi-stage chains"
  - "shared personalisation layer" → "a shared layer that personalises flags per student"
  - "end-to-end testing regime" → "end-to-end tests"
  - "containerisation concern of its own" → "a separate containerisation problem"
- **Replace** rhetorical flourishes:
  - "consistent with Fuzyll's maxim that learning should be the path to the flag" → "as recommended by Fuzyll"
  - "reinforcing the NCSC guidance" → "an instance of the NCSC guidance"

## 7. Page-budget accounting (target: 5–6 pages IEEE 2-column)

Net change expected:

| Change | Δ lines (approx.) |
|---|---|
| Opener with research question + ladder + summary | +15 |
| §3.4 reorg to tier groups with `\paragraph` tags | 0 (same content, tighter) |
| Eq. for JWT algorithm confusion | +4 |
| Algorithm 1 (generation pipeline, boxed) | +14 |
| Algorithm 2 (exploit harness, boxed) | +12 |
| Listing 1 (ResearchService snippet) | +8 |
| Listing 2 (CTF8 blocklist) | +8 |
| Table 2 (deployment comparison) | +18 |
| Table 3 (VVT coverage matrix) | +22 |
| Table 4 (tooling with versions) | +16 |
| §3.6.3 Development and Audit Iteration | +25 |
| Cuts from lines 154–173, 239–248, 622–640 | −35 |
| Cuts from tone/flourish trims across §3.1–§3.6 | −40 |
| Removal of the fbox placeholder once figure ships | −8 |
| **Net** | **≈ +59 lines** |

At ~55 lines per column in the current template, +59 lines is roughly one extra column. That leaves the section around 6 pages once the real CTF9 chain figure replaces the placeholder. If tighter: drop Listing 3 (not in the table above) and shorten Table 3 by collapsing "LLM track" and "human track" into one "Evaluation tracks" column.

## 8. Execution order (once approved)

1. Draft the new opener (research question + ladder + summary). Get user sign-off on the research-question wording before touching the rest.
2. Read `pom.xml`, `package.json` files, `go.mod`, `Cargo.toml` to harvest actual tool versions. Do not invent.
3. Insert tables 2, 3, 4 in their target locations.
4. Add equations and boxed algorithms.
5. Reorganise §3.4 into tier-grouped subsubsections, trimming each existing paragraph by 10–20% while adding a one-sentence "Intended path" and "Design decision" split.
6. Add §3.6.3 Development and Audit Iteration from the CTF1, CTF3, CTF4, CTF9 audit material already in the tree.
7. Apply the global tone/flourish pass last, after structural changes settle.
8. Verify the `.bib` keys referenced are all present; add any newly required entries.
9. Compile and page-count; trim Listing 3 / Table 3 columns if over budget.

---

## 9. Open decisions for you before edits begin

1. **Research-question phrasing**: should the framing lean toward *personalisation integrity* (HMAC flags defeat sharing/LLM) or *pedagogical breadth* (nine OWASP-diverse stacks) as the primary question? Current draft conflates both; pick one as primary.
2. **Deliverables-ladder placement**: inside Methodology §3 (as proposed above) or inside Introduction? Papers 1 and 4 put it in Introduction; Paper 2 puts it in Introduction §1.4. Methodology-only placement is unusual.
3. **Listing 3 (CTF5 MRO payload)**: include or cut? Cutting saves ~8 lines.
4. **Figure 3 (CTF1 diagnostic)**: include or cut? Cutting saves a figure slot but loses the Paper 3-style "show the audit finding visually" credit.
5. **Table 3 columns**: six columns or merge to four? Six maps exactly onto the five sub-criteria plus human-track evidence; four fits narrower.

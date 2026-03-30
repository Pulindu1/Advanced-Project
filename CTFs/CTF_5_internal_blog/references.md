# CTF5 Sources

A precise breakdown of every source used in building the CTF5 plan and exactly what each
one contributed.

---

## PortSwigger Web Security Academy -- Server-Side Template Injection

**URL:** https://portswigger.net/web-security/server-side-template-injection

Used for the core three-stage exploitation methodology (Detect, Identify, Exploit) that
directly shaped the four-flag progression. The distinction between detection (`{{7*7}}`),
engine identification (`{{7*'7'}}` differentiating Jinja2 from Twig), and exploitation
(config leak then RCE) maps directly to Flags 2, 3, and 4. Also the source for the
recommendation that intermediate-level challenges should provide source code to shift
difficulty from reconnaissance to analysis.

---

## PortSwigger Original Research -- James Kettle, Black Hat USA 2015

**URL:** https://portswigger.net/research/server-side-template-injection

Used for the foundational framing that SSTI is "frequently critical" and "extremely easy to
mistake for XSS." This justified treating SSTI as a standalone intermediate challenge rather
than a sub-feature of an XSS challenge. Kettle's original paper also established that
`{{config}}` leaking `SECRET_KEY` is the primary information disclosure consequence of SSTI
in Flask, which is the direct basis for Flag 2.

---

## HackerOne Report #125980 -- Uber SSTI Bug Bounty

**URL:** https://hackerone.com/reports/125980

Used as the real-world justification for Flag 2's design. The Uber case (profile name
`{{ '7'*7 }}` rendering as `7777777` in a confirmation email) is the canonical example of
SSTI leading immediately to config/credential leakage before RCE is attempted. The plan
explicitly references this as the threat model Flag 2 is based on.

---

## CVE-2025-23211 -- Tandoor Recipes Jinja2 SSTI to RCE (OffSec)

**URL:** https://www.offsec.com/blog/cve-2025-23211/

Used as the real-world justification for the overall scenario design. This CVE showed that a
legitimate application feature (recipe instructions rendered via Jinja2) is a credible,
realistic route to RCE in a production application. It directly supported the decision to
ground the vulnerability in NovaCMS's "Live Preview" feature rather than a contrived input
field.

---

## PayloadsAllTheThings -- Server Side Template Injection (Python/Jinja2)

**URL:** https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection

Used for the specific bypass techniques listed in Flag 3: hex encoding (`\x5f\x5f` for
`__`), the `|attr()` filter as a dot-notation replacement, and `request.args` smuggling.
Also used to confirm the `lipsum.__globals__["os"].popen()` shortform RCE path recommended
in Flag 4 as the cleaner solution route alongside the full MRO chain.

---

## 0day.work -- Jinja2 Template Injection Filter Bypasses (Sebastian Neef)

**URL:** https://0day.work/jinja2-template-injection-filter-bypasses/

Used specifically for the WAF design in Flag 3. The bypass taxonomy from this source
(attribute access alternatives, string manipulation via `|join`, hex encoding, request
parameter smuggling) directly informed which techniques the WAF should block and which bypass
routes are left open for players to discover. The decision to block `__`, `config`, `os`,
`class`, `subclasses`, and `request` as the WAF's blocklist comes from this source's
analysis of what naive filters typically target.

---

## OnSecurity -- Server Side Template Injection with Jinja2

**URL:** https://onsecurity.io/article/server-side-template-injection-with-jinja2/

Used for confirmation of the `lipsum` globals RCE path as a reliable short-form alternative
to full MRO traversal. Also used to verify the list of Flask objects automatically injected
into every template context (`request`, `config`, `g`, `session`, `url_for`,
`get_flashed_messages`), which informed which entry points the Flag 3 WAF should target.

---

## HackTricks -- Jinja2 SSTI

**URL:** https://book.hacktricks.xyz/pentesting-web/ssti-server-side-template-injection/jinja2-ssti

Used for the MRO traversal chain mechanics described in Flag 4 -- specifically the
`''.__class__.__mro__[1].__subclasses__()` pattern and the rationale that starting from any
accessible object allows traversal to `subprocess.Popen`. Also used to confirm that
`cycler.__init__.__globals__.os.popen()` is a valid alternative RCE path, supporting the
design decision to allow multiple valid solution routes.

---

## OWASP Web Security Testing Guide -- WSTG-INPV-18

**URL:** https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server-side_Template_Injection

Used for the formal OWASP classification of SSTI under A03:2021 Injection and CWE-1336.
This is the basis for the OWASP coverage table in the plan. Also used to confirm that the
same `render_template_string` pattern vulnerable to SSTI is simultaneously vulnerable to
XSS, which reinforced the decision to classify it under A03 rather than splitting across
categories.

---

## CSAW Learning Obstacles Paper (USENIX 3GSE 2014)

**URL:** https://www.usenix.org/system/files/conference/3gse14/3gse14-chung.pdf

Used for the key pedagogical design constraint that challenges requiring "significant
guessing" are the primary frustration and failure mode in CTF education. This is the direct
justification for the design decision to make the WAF source code visible to players via a
changelog file, so they reason about bypass mechanics rather than spray payloads. This source
is also cited explicitly in the plan text.

---

## picoCTF Challenge Writing Guide

**URL:** https://www.picoctf.org/posts/2025-04-12-how-you-can-write-ctf-challenges.html

Used for two specific design principles applied throughout the plan. First, the "learning
path should be the solution path" principle, which shaped the decision to embed the
vulnerability inside a natural app feature (Live Preview) rather than an obviously suspicious
input. Second, the principle that a quality challenge should produce an "I didn't know you
could do that" moment -- which is what the MRO chain achieving RCE from a template expression
is designed to deliver.

---

## CTF_REPO_ANALYSIS.md (project file)

Used as the primary reference for ensuring CTF5 does not duplicate existing challenge
structures. The stack comparison (CTF1/2/4 Node.js, CTF3 PHP/Laravel) drove the
Python/Flask choice. Section 6.5 (flag format inconsistency) directly motivated the
`durham-cms{...}` prefix decision. Section 4.6 (test coverage gap for CTF2-4) motivated
including pytest as part of the stack. Section 5.1 (realistic application contexts table)
was used as a template for how NovaCMS's scenario is framed.

---

## Dissertation Project Plan PDF (project file)

Used to confirm that Flask/SSTI was an explicitly listed but unbuilt intermediate
deliverable, validating the choice. Also used to confirm that the basic and intermediate
deliverable descriptions called for multi-step challenges with breadcrumbing, which the
four-flag chain satisfies. The OWASP Top 10 alignment requirement cited in the literature
review section was used to justify the per-flag OWASP mapping table.
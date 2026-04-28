#!/usr/bin/env python3
"""build_expected_flags.py -- assemble Evaluation/llm/expected_flags.json
from each CTF's in-repo flags.json, selecting one player account per CTF.

Replaces the earlier `generate_expected_flags.js`, which derived flags by
re-running the chgen modules under a separate trial salt. We now point the
trial at the demo accounts already shipped with the repo, so this script
is purely a reader: it picks the chosen player from each CTF's flags.json
and writes the per-(ctf, flag_index) shape that lib/scoring.py expects.

Output shape:

    { "<ctf>": { "<flag_idx>": "<expected_string>", ... }, ... }

Run:  python3 Evaluation/llm/scripts/build_expected_flags.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
LLM_DIR = HERE.parent
REPO = LLM_DIR.parent.parent
CTFS = REPO / "CTFs"


# (ctf_num, path-to-flags.json, player-username, flat-vs-keyed)
#   "flat":  flags["<player>"] is the single flag string
#   "keyed": flags["<player>"] is a {"flag1": ..., "flag2": ...} dict;
#            flag indices in the output are the integer suffixes
SOURCES = [
    (1, CTFS / "Basic_1_Nodejs/flags.json", "abcd12", "flat"),
    (2, CTFS / "CTF_2_pswd_manager/flags.json", "abcd12", "flat"),
    (3, CTFS / "CTF_3_HR-system/flags.json", "abcd12", "ctf3"),
    (4, CTFS / "CTF_4_corporate_helpdesk/flags.json", "abcd12", "flat"),
    (5, CTFS / "CTF_5_internal_blog/flags.json", "test12", "keyed"),
    (6, CTFS / "CTF_6_veridian/flags.json", "abcd12", "keyed"),
    (7, CTFS / "CTF_7_notes_app/src/data/flags.json", "abcd12", "flat"),
    (8, CTFS / "CTF_8_gazette/src/data/flags.json", "abcd12", "keyed"),
    (9, CTFS / "CTF_9_dunholm/data/flags.json", "abcd12", "keyed"),
]


def build() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for ctf, flag_path, player, shape in SOURCES:
        if not flag_path.exists():
            sys.exit(f"missing flags file: {flag_path}")
        data = json.loads(flag_path.read_text())
        if player not in data:
            sys.exit(f"player {player!r} absent from {flag_path}")
        slot = data[player]

        if shape == "flat":
            out[str(ctf)] = {"1": slot}
        elif shape == "keyed":
            out[str(ctf)] = {
                str(int(k.removeprefix("flag"))): v
                for k, v in sorted(slot.items())
            }
        elif shape == "ctf3":
            out[str(ctf)] = {"1": slot["flag_api"], "2": slot["flag_decrypt"]}
        else:
            sys.exit(f"unknown shape: {shape}")
    return out


def main() -> int:
    target = LLM_DIR / "expected_flags.json"
    payload = build()
    target.write_text(json.dumps(payload, indent=2) + "\n")
    n = sum(len(v) for v in payload.values())
    print(f"wrote {target.relative_to(REPO)}  ({n} flag slots across {len(payload)} CTFs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

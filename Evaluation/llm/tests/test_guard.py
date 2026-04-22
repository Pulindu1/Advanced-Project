from pathlib import Path

import pytest

from lib.guard import Guard, GuardViolation


@pytest.fixture
def layout(tmp_path: Path) -> dict[str, Path]:
    (tmp_path / "prompts").mkdir()
    (tmp_path / "prompts" / "passive.md").write_text("hello")
    (tmp_path / "doc-pack").mkdir()
    (tmp_path / "doc-pack" / "ctf1.md").write_text("doc")
    (tmp_path / "expected_flags.json").write_text("{}")
    (tmp_path / "outside.txt").write_text("nope")
    (tmp_path / "SOLUTIONS.md").write_text("never")

    run_dir = tmp_path / "runs" / "run001"
    run_dir.mkdir(parents=True)
    (run_dir / "scratch").mkdir()
    return {"root": tmp_path, "run_dir": run_dir}


@pytest.fixture
def guard(layout: dict[str, Path]) -> Guard:
    root = layout["root"]
    return Guard(
        allowed_files={root / "expected_flags.json"},
        allowed_dirs={root / "prompts", root / "doc-pack"},
        deny_names={"SOLUTIONS.md", "workflow.md", "flags.json", "users.json"},
    )


class TestCheckPath:
    def test_allows_file_in_allowed_dir(self, guard, layout):
        p = guard.check_path(layout["root"] / "prompts" / "passive.md")
        assert p.name == "passive.md"

    def test_allows_exact_allowed_file(self, guard, layout):
        p = guard.check_path(layout["root"] / "expected_flags.json")
        assert p.name == "expected_flags.json"

    def test_allows_path_inside_run_dir(self, guard, layout):
        target = layout["run_dir"] / "scratch" / "output.txt"
        p = guard.check_path(target, run_dir=layout["run_dir"])
        assert p == target.resolve()

    def test_denies_outside_path(self, guard, layout):
        with pytest.raises(GuardViolation):
            guard.check_path(layout["root"] / "outside.txt")

    def test_denies_by_name_even_if_in_allowed_dir(self, guard, layout, tmp_path):
        sneaky = layout["root"] / "prompts" / "SOLUTIONS.md"
        sneaky.write_text("leak")
        with pytest.raises(GuardViolation):
            guard.check_path(sneaky)

    def test_denies_traversal(self, guard, layout):
        # prompts/../outside.txt resolves to outside.txt
        target = layout["root"] / "prompts" / ".." / "outside.txt"
        with pytest.raises(GuardViolation):
            guard.check_path(target)

    def test_denies_flags_json_anywhere(self, guard, layout):
        sneaky = layout["root"] / "doc-pack" / "flags.json"
        sneaky.write_text("leak")
        with pytest.raises(GuardViolation):
            guard.check_path(sneaky)


class TestGuardedOpen:
    def test_read_in_allowed_dir_ok(self, guard, layout):
        f = guard.guarded_open(layout["root"] / "prompts" / "passive.md")
        assert f.read() == "hello"
        f.close()

    def test_write_requires_run_dir(self, guard, layout):
        target = layout["run_dir"] / "scratch" / "out.txt"
        f = guard.guarded_open(target, mode="w", run_dir=layout["run_dir"])
        f.write("ok")
        f.close()
        assert target.read_text() == "ok"

    def test_write_without_run_dir_denied(self, guard, layout):
        with pytest.raises(GuardViolation):
            guard.guarded_open(
                layout["root"] / "prompts" / "passive.md", mode="w"
            )

    def test_write_outside_run_dir_denied(self, guard, layout):
        # prompts is in allowed_dirs so check_path passes, but write
        # outside run_dir must fail
        target = layout["root"] / "prompts" / "passive.md"
        with pytest.raises(GuardViolation):
            guard.guarded_open(
                target, mode="w", run_dir=layout["run_dir"]
            )


class TestCheckUrl:
    def test_allows_localhost_on_port(self, guard):
        assert guard.check_url("http://localhost:3001/foo", 3001)

    def test_allows_127_0_0_1(self, guard):
        assert guard.check_url("http://127.0.0.1:3001/", 3001)

    def test_denies_wrong_port(self, guard):
        with pytest.raises(GuardViolation):
            guard.check_url("http://localhost:3002/", 3001)

    def test_denies_wrong_host(self, guard):
        with pytest.raises(GuardViolation):
            guard.check_url("http://evil.example.com:3001/", 3001)

    def test_denies_https(self, guard):
        with pytest.raises(GuardViolation):
            guard.check_url("https://localhost:3001/", 3001)

    def test_denies_file_scheme(self, guard):
        with pytest.raises(GuardViolation):
            guard.check_url("file:///etc/passwd", 3001)

    def test_accepts_set_of_ports(self, guard):
        assert (
            guard.check_url("http://localhost:8004/api", {3001, 8004})
            == "http://localhost:8004/api"
        )

    def test_rejects_port_not_in_set(self, guard):
        with pytest.raises(GuardViolation):
            guard.check_url("http://localhost:9000/", {3001, 8004})

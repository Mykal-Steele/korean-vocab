"""Guards for the GitHub workflow files.

A job that depends on a job with an `if` condition is skipped whenever that job is
skipped, even if it succeeded. Such a job needs `always()` and an explicit result check.
This rule came from a deploy that never ran after its upstream audio job was skipped.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = sorted((ROOT / ".github" / "workflows").glob("*.yml"))


def load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def needs_of(job: dict) -> list:
    needs = job.get("needs", [])
    return [needs] if isinstance(needs, str) else list(needs)


class WorkflowGuards(unittest.TestCase):
    def test_workflows_exist(self):
        self.assertTrue(WORKFLOWS, "no workflow files found")

    def test_job_after_a_conditional_job_uses_always(self):
        for path in WORKFLOWS:
            jobs = load(path)["jobs"]
            for name, job in jobs.items():
                for dep in needs_of(job):
                    if not jobs[dep].get("if"):
                        continue
                    condition = str(job.get("if", ""))
                    self.assertIn(
                        "always()", condition,
                        f"{path.name}: job '{name}' needs '{dep}', which can be skipped; "
                        f"add always() and check needs.{dep}.result",
                    )
                    self.assertIn(
                        f"needs.{dep}.result", condition,
                        f"{path.name}: job '{name}' must check needs.{dep}.result",
                    )


if __name__ == "__main__":
    unittest.main()

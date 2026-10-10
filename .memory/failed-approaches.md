# Failed Approaches

## QA drawer obscured MFAP quick action

- PROBLEM: Focused automation timed out waiting for a linked-side POST.
- APPROACH: The test reopened the full-screen system drawer, then attempted the
  inline MFAP action while the drawer remained over the workspace.
- FILES: `work/qa-physical-correction-batch.cjs` and associated review evidence.
- RESULT: False blocker; isolated unobstructed POST succeeded.
- WHY IT FAILED: Test state, not production API behavior, blocked interaction.
- LESSON: Verify active overlays and visible hit targets before diagnosing API code.
- RECOMMENDED NEXT APPROACH: Reproduce with the drawer closed and capture request,
  DOM visibility, and authoritative server state together.

## Snapshot-oriented QA erased local fixture

- PROBLEM: A shared-record QA run overwrote the whole schedule snapshot and removed
  the Wetex fixture.
- APPROACH: Test wrote its fixture snapshot without restoring the pre-test data.
- FILES: `work/qa-shared-records.cjs`.
- RESULT: Test harness had to preserve and restore the original schedule snapshot.
- WHY IT FAILED: QA isolation was incomplete.
- LESSON: Mutating QA must snapshot and restore authoritative local test data.
- RECOMMENDED NEXT APPROACH: Use isolated data roots or guaranteed `finally`
  restoration before running fixture-sensitive QA.


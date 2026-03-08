# Assertions

Use helper assertors to validate both returned payloads and side effects.

## Base Test Assertions

- Use `require.NoError` / `require.Error` for operation result gates.
- Use `assert.Equal` / `assert.True` for value checks after success.
- Use `helper.Validate*` for semantic model validity checks.

## Data Assertions

`DataAssertor` methods validate model invariants (labels, status/source rules, timestamps, history):
- `helper.ValidateAsset(...)`
- `helper.ValidatePreseed(...)`
- `helper.ValidateSeed(...)`
- `helper.ValidateRisk(...)`

These are not strict object equality checks; they verify expected shape and invariants.

## Queue Assertions

Requires `ops.WithQueueMonitor`.

Common methods:
- `helper.AssertJobsQueuedForTarget(t, target, ...)`
- `helper.AssertNoJobsQueuedForTarget(t, target, ...)`
- `helper.AssertJobQueued(t, job, ...)`
- `helper.AssertJobNotQueued(t, job, ...)`

Common conditions:
- `queue.CreatedSince(ts)`
- `queue.WithTarget(target)`
- `queue.WithJobKey(key)`
- `queue.WithCapability(name)`

Capture timestamps immediately before the action under test to filter unrelated queue traffic.

## Table Assertions

Common methods:
- `helper.AssertTableItemInserted(...)`
- `helper.AssertTableItemNotInserted(...)`
- `helper.AssertTablePrefixInserted(...)`
- `helper.AssertTablePrefixNotInserted(...)`

Common options/conditions:
- `table.JobIsStatus(model.Queued)`
- `table.CreatedSince(ts)`
- `table.WithGlobal`

## File Assertions

- `helper.AssertFileExists(t, fileData)`
- `helper.AssertFileNotExists(t, fileData)`
- `helper.AssertFileContent(t, fileData)`

## API Assertions

`APIAssertor` is useful when asserting eventual consistency through API responses:
- `helper.AssertAPITableItemExists(...)`
- `helper.AssertAPIGraphItemExists(...)`
- `helper.AssertAPIGraphQueryCondition(...)`

Condition helpers include:
- `api.CountIsEqualTo(n)`
- `api.CountIsGreaterThan(n)`

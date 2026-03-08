---
name: writing-acceptance-tests
description: Use when writing or reviewing guard acceptance tests, including API, lambda, and compute suites - covers test structure, build tags, execution flow, TestHelper usage, and assertion conventions
---

# Writing Acceptance Tests

Acceptance tests validate end-to-end behavior against real integrations (API, AWS resources, queues, and data stores), not isolated units.

Use this skill when adding or updating tests under:
- `modules/guard/acceptance/tests/`
- `modules/guard/acceptance/pkg/ops/`
- `modules/guard/acceptance/pkg/assertors/`

## What an Acceptance Test Is

Acceptance tests should verify:
- API behavior (create/update/delete/query)
- persistence side effects (table, files, secrets)
- async side effects (jobs queued or not queued)
- behavior from a real user/client perspective

Acceptance tests should avoid:
- mocking core backend behavior (except intentional test-stack mock mode)
- asserting private implementation details
- coupling to unstable timing without retry/condition helpers

## How to Run Acceptance Tests

Run tests through the orchestrator script:

```bash
cd modules/guard/acceptance
./scripts/run-acceptance-tests.sh
```

Use `--go-flags` to pass raw `go test` flags:

```bash
./scripts/run-acceptance-tests.sh --go-flags "-v"
./scripts/run-acceptance-tests.sh --go-flags "-run '^Test_AddAsset$' -v"
./scripts/run-acceptance-tests.sh --go-flags "-v -count=1"
```

Use suite selectors to run specific groups:

```bash
./scripts/run-acceptance-tests.sh --run-unit
./scripts/run-acceptance-tests.sh --run-api
./scripts/run-acceptance-tests.sh --run-compute
```

The script supports `--run-<suite>` for discovered suites under `./tests`.

Why prefer the script:
- discovers and runs suites in the expected orchestration flow
- enforces build-tag policy via `scripts/enforce_build_tags.go`
- handles env setup for tests marked with `// ACCEPTANCE_REQUIRES_ENV`
- applies acceptance/backend environment bootstrap consistently

## Build Tags

Every acceptance test file must include one of:
- `//go:build single_threaded`
- `//go:build !single_threaded`

`enforce_build_tags.go` validates this policy and can auto-fix missing tags.

### Tag meanings

| Tag | Meaning | Use case |
| --- | --- | --- |
| `single_threaded` | Test binary must run fully alone (no other test binaries alongside it) | Tests requiring exclusive control of shared resources, usually SQS queues / worker flows |
| `!single_threaded` | Test binary may run alongside other test binaries | Most API CRUD and side-effect tests that are safe in parallel orchestration |

## .env Behavior for Tests

Some tests require local `.env` files and are marked with:

```go
// ACCEPTANCE_REQUIRES_ENV
```

Example: `tests/compute/compute_test.go`.

`run-acceptance-tests.sh` scans for this marker and copies `.env` into required test directories.

Environment sources:
- `.env-backend`: backend-style env used for test execution (copied from deployed backend env, e.g. `../backend/.env`)
- `.env-acceptance`: acceptance-specific configuration (often cloud/test options)
- per-test `.env` files (for marked tests): copied from `.env-backend`

## Core Workflow

```
Task Progress:
- [ ] Step 1: Pick the target suite (api/lambda/compute)
- [ ] Step 2: Choose correct build tag (`single_threaded` vs `!single_threaded`)
- [ ] Step 3: Generate test data via TestHelper
- [ ] Step 4: Execute operation via helper ops method
- [ ] Step 5: Assert model validity and side effects
- [ ] Step 6: Run via run-acceptance-tests.sh with focused go flags
```

## File Conventions

| Item | Pattern |
| --- | --- |
| Test file name | `<operation>_test.go` |
| Build tag | `//go:build single_threaded` or `//go:build !single_threaded` |
| Optional env marker | `// ACCEPTANCE_REQUIRES_ENV` |
| Test shape | table-driven subtests with `t.Run(...)` |
| Parallelism | `t.Parallel()` at test/subtest scope when compatible with selected build tag/resources |

## Detailed References

- [references/helper.md](references/helper.md) — TestHelper setup, options, lifecycle, and ops wrappers
- [references/assertions.md](references/assertions.md) — data/queue/table/files/API assertion patterns
- [references/api.md](references/api.md) — API-specific conventions and canonical test pattern
- [references/lambda.md](references/lambda.md) — Lambda-specific conventions
- [references/compute.md](references/compute.md) — compute-specific conventions

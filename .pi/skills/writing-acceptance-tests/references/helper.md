# TestHelper

`ops.NewTestHelper(...)` is the primary entrypoint for acceptance tests.

## Creation

```go
helper, err := ops.NewTestHelper(t)
require.NoError(t, err)
```

Enable queue assertions:

```go
helper, err := ops.NewTestHelper(t, ops.WithQueueMonitor)
require.NoError(t, err)
```

## Common Options

| Option | Use |
| --- | --- |
| `ops.WithQueueMonitor` | Starts SQS monitoring so queue assertions work |
| `ops.WithCustomerAccount` | Creates owner + customer user setup |
| `ops.WithStaticCredentials` | Uses preconfigured static user creds |
| `ops.WithSignUpFlow` | Creates user via signup flow |
| `ops.WithPlextrac` / `WithJira` / `WithADO` | Enables integration-specific setup |

## What TestHelper Composes

`TestHelper` embeds:
- `ModelDataFactory` for `Generate*Data` fixture creation
- `DataAssertor` for model validation (`ValidateAsset`, `ValidatePreseed`, etc.)
- `QueueAssertor` for queued job assertions
- `TableAssertor` for DynamoDB assertions
- `FilesAssertor`, `SecretsAssertor`, `UsersAssertor`, `APIAssertor`

## Lifecycle and Cleanup

`NewTestHelper` registers `t.Cleanup(...)` automatically.

Use `helper.AddCleanup(func() error { ... })` for additional teardown.

## Ops Method Pattern

Use helper wrappers for API actions, then helper getters for verification:

```go
created, err := helper.AddAsset(assetData)
require.NoError(t, err)

assetData.GetBase().Key = created.GetKey()
queried, err := helper.GetAsset(assetData)
require.NoError(t, err)
```

Prefer helper ops instead of direct request code in tests unless adding new endpoint coverage.

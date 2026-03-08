# API Test Conventions

API acceptance tests usually follow a table-driven pattern with helper-generated fixtures.

## Canonical Pattern

```go
func Test_<Operation>(t *testing.T) {
    t.Parallel()

    helper, err := ops.NewTestHelper(t, ops.WithQueueMonitor) // only if queue assertions needed
    require.NoError(t, err)

    testCases := []struct {
        name    string
        dataGen func() model.Assetlike
    }{
        {name: "case name", dataGen: helper.GenerateDomainAssetData},
    }

    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()

            data := tc.dataGen()
            ts := time.Now()

            created, err := helper.AddAsset(data)
            require.NoError(t, err)

            helper.ValidateAsset(t, created, data)

            data.GetBase().Key = created.GetKey()
            queried, err := helper.GetAsset(data)
            require.NoError(t, err)
            assert.Equal(t, created, queried)

            helper.AssertJobsQueuedForTarget(t, queried, queue.CreatedSince(ts))
        })
    }
}
```

## Practical Rules

1. Prefer helper ops methods (`Add*`, `Update*`, `Delete*`, `Get*`) over raw request code.
2. Use helper generators for fixtures (`Generate*Data`) to keep consistent model defaults.
3. Query back after mutation and assert persisted state.
4. Validate both direct result and side effects.
5. For async checks, use timestamp-based conditions to avoid false positives.

## Useful Examples

- `tests/api/assets/add_test.go`
- `tests/api/assets/delete_test.go`
- `tests/api/preseeds/add_test.go`
- `tests/api/files/multipart_test.go`

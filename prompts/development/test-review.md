Review the integration tests and unit tests for the module and components built in this workflow.

## Integration Tests

- Ensure the module has an adequate set of integration tests with a dedicated Terraform fixture.
- Any new components added alongside the module must have at least one integration test, using the same fixture as the module (or another module's fixture if more appropriate).

## Remove Crummy Unit Tests

Look for and flag the following anti-patterns:

- **Inappropriate dependency injection**: Components where methods are defined as struct fields solely so tests can override them. This makes code difficult to read and should not be shipped. Remove these tests and revert the component to use normal methods.
- **Unit tests better served by integration tests**: If a unit test is mocking so heavily that it's not testing real behavior, it should be removed in favor of an integration test.

## Output

Summarize your findings in a markdown file. Include:
- What integration tests exist and any gaps
- Any unit tests or components flagged for the anti-patterns above
- Specific changes requested (if any)

Save the markdown file to the working directory (e.g., `test-review.md`), then store the file path to the workflow memory domain under the key "test-review".

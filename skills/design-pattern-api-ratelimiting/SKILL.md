---
name: design-pattern-api-ratelimiting
description: Use when designing, implementing, or reviewing API rate limiting for AWS Lambda HTTP endpoints in Go - covers DynamoDB-backed daily quotas, atomic reservations, release-on-failure, TTL cleanup, IAM, and CloudFormation/SAM infrastructure
module: design-patterns
---

# API Rate Limiting Pattern

## Core idea

Use DynamoDB as a small atomic counter store for Lambda API quotas.

For low-volume public endpoints such as contact forms, prefer a simple daily quota:

```text
HTTP request
  -> validate request and bot traps
  -> reserve rate-limit slot in DynamoDB
  -> perform side effect
  -> release slot only if the side effect fails
```

Rate limiting should protect expensive or abuse-sensitive side effects, not block harmless validation failures.

## When to apply

Use this pattern for Lambda HTTP endpoints that need a shared quota across concurrent invocations, especially:

- Contact forms that send email.
- Public webhook-like endpoints with bounded side effects.
- Anonymous API endpoints where API Gateway usage plans are not appropriate.
- Small daily, hourly, or per-key quotas that must be concurrency-safe.

Do not use in-memory counters for Lambda rate limits. Lambda instances are ephemeral and concurrent instances do not share memory.

## DynamoDB table

Use one DynamoDB table with a string partition key:

```yaml
ContactRateLimitTable:
  Type: AWS::DynamoDB::Table
  Properties:
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: id
        AttributeType: S
    KeySchema:
      - AttributeName: id
        KeyType: HASH
    SSESpecification:
      SSEEnabled: true
    TimeToLiveSpecification:
      AttributeName: expiresAt
      Enabled: true
```

Use `PAY_PER_REQUEST` unless there is a clear high-volume workload that justifies capacity planning.

## Key design

Make keys deterministic for the quota window:

```go
func (l *dailyRateLimiter) dailyKey() string {
    return "contact:daily:" + l.currentDayStart().Format("2006-01-02")
}
```

For daily quotas, calculate windows in UTC:

```go
func (l *dailyRateLimiter) currentDayStart() time.Time {
    now := l.now().UTC()
    return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}
```

Use namespaced keys such as `contact:daily:2026-05-20` so multiple endpoints can share one table later.

## User IP address behind CloudFront

When the API is reached through CloudFront, read the user's IP address from the `cloudfront-viewer-address` header.
CloudFront sets this header to the viewer address, commonly including the port:

```text
203.0.113.10:54321
```

Normalize it before using it in a rate-limit key:

```go
func viewerIP(headers map[string]string) string {
    raw := strings.TrimSpace(headers["cloudfront-viewer-address"])
    if raw == "" {
        raw = strings.TrimSpace(headers["CloudFront-Viewer-Address"])
    }

    host, _, err := net.SplitHostPort(raw)
    if err == nil {
        return host
    }

    return raw
}
```

Use IP-based keys only when the product needs per-client quotas:

```text
contact:daily:ip:203.0.113.10:2026-05-20
```

Avoid trusting arbitrary client-provided forwarding headers unless the API is only reachable through trusted infrastructure.

## Atomic reservation

Use `UpdateItem` with a condition expression and `ADD`. This makes reservation concurrency-safe:

```go
_, err := l.client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
    TableName: aws.String(l.table),
    Key: map[string]dynamodbtypes.AttributeValue{
        "id": &dynamodbtypes.AttributeValueMemberS{Value: key},
    },
    UpdateExpression:    aws.String("SET #expiresAt = if_not_exists(#expiresAt, :expiresAt) ADD #count :one"),
    ConditionExpression: aws.String("attribute_not_exists(#count) OR #count < :limit"),
    ExpressionAttributeNames: map[string]string{
        "#count":     "count",
        "#expiresAt": "expiresAt",
    },
    ExpressionAttributeValues: map[string]dynamodbtypes.AttributeValue{
        ":one":       &dynamodbtypes.AttributeValueMemberN{Value: "1"},
        ":limit":     &dynamodbtypes.AttributeValueMemberN{Value: strconv.Itoa(l.limit)},
        ":expiresAt": &dynamodbtypes.AttributeValueMemberN{Value: strconv.FormatInt(expiresAt, 10)},
    },
})
```

Handle `ConditionalCheckFailedException` as a normal denied request, not as a server error:

```go
if errors.As(err, &conditionalCheckFailed) {
    return key, false, nil
}
```

Return `429 Too Many Requests` when the reservation is denied.

## Release-on-failure

Reserve before the protected side effect. If the side effect fails, release the reservation:

```go
key, allowed, err := limiter.reserve(ctx)
if err != nil {
    return serverError()
}
if !allowed {
    return tooManyRequests()
}

if err := sendEmail(ctx, contact); err != nil {
    _ = limiter.release(ctx, key)
    return serverError()
}
```

Release with a conditional decrement so the counter never goes below zero:

```go
UpdateExpression:    aws.String("ADD #count :minusOne"),
ConditionExpression: aws.String("#count >= :one"),
```

Treat failed release condition checks as harmless. Log other release errors, but do not mask the original side-effect failure.

## TTL cleanup

Set `expiresAt` on the counter item for DynamoDB TTL cleanup. For daily quotas, a TTL around 48 hours after the window start is simple and safe:

```go
expiresAt := l.currentDayStart().Add(48 * time.Hour).Unix()
```

TTL is for storage cleanup only. Do not rely on TTL to enforce quota windows; enforce windows through the key.

## Lambda configuration

Pass the table name and quota through environment variables:

```yaml
Environment:
  Variables:
    CONTACT_RATE_LIMIT_TABLE: !Ref ContactRateLimitTable
    CONTACT_DAILY_SEND_LIMIT: !Ref ContactDailySendLimit
```

Expose the limit as a deployment parameter:

```yaml
ContactDailySendLimit:
  Type: Number
  Default: 10
  MinValue: 1
```

Validate required environment variables at startup. Missing required infrastructure should fail loudly.

## IAM

Grant only the DynamoDB action the limiter needs:

```yaml
- Effect: Allow
  Action:
    - dynamodb:UpdateItem
  Resource: !GetAtt ContactRateLimitTable.Arn
```

Do not grant broad DynamoDB permissions unless the function has another explicit table access requirement.

## Handler placement

In handlers, rate limit after parsing and validation but before the protected side effect:

1. Handle `OPTIONS` and unsupported methods.
2. Parse request body.
3. Apply bot traps such as honeypot fields.
4. Validate required user input.
5. Reserve rate-limit slot.
6. Perform side effect.
7. Release reservation if the side effect fails.

This avoids spending quota on malformed requests and avoids teaching bots that a honeypot was detected.

## Design rules

- Use DynamoDB conditional updates for shared Lambda rate limits.
- Use deterministic UTC window keys; do not rely on TTL for enforcement.
- For CloudFront-backed APIs, get the user IP from `cloudfront-viewer-address` and normalize away the port.
- Reserve only after request validation and bot traps.
- Release reservations only when the protected side effect fails.
- Return `429` for quota denial.
- Treat DynamoDB conditional check failures as expected control flow.
- Keep table name and quota configurable through environment variables.
- Fail startup when required rate-limit infrastructure config is missing.
- Keep IAM to `dynamodb:UpdateItem` when reserve/release are the only operations.
- Do not hide missing required dependencies with handler-level nil fallbacks.

## Review checklist

Check that:

- The DynamoDB table has string partition key `id`.
- TTL is enabled on the same attribute the code writes, usually `expiresAt`.
- The Lambda role can call `dynamodb:UpdateItem` on the table.
- The Lambda receives the table name and limit through environment variables.
- The counter update is atomic and conditional.
- IP-based limits use `cloudfront-viewer-address` when traffic comes through CloudFront.
- Conditional check failures return `429`, not `500`.
- The handler releases the reservation when the side effect fails.
- Tests cover allowed, denied, DynamoDB error, and release-on-failure paths.

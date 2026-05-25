---
name: design-pattern-lambda-cron
description: Use when designing, reviewing, or adding AWS Lambda cron jobs in Go - covers the cmd/cron Lambda entrypoint, pkg/cronhandlers registry, named cron dispatch, per-handler initialization, payloads, and modular cron handler packages
module: design-patterns
---

# Lambda Cron Pattern

## Core idea

Use `cmd/cron` as a thin AWS Lambda adapter and `pkg/cronhandlers` as the named cron job dispatch layer.

The shape is:

```text
EventBridge scheduled event
  -> cmd/cron Lambda entrypoint
  -> pkg/cronhandlers dispatcher
  -> registered cron handler Init
  -> registered cron handler Handle
```

`cmd/cron` should know about Lambda, the incoming cron event, environment variables, and top-level service construction. `pkg/cronhandlers` should know about handler registration, dispatch, per-handler initialization, and cron job implementation.

## Directory roles

| Directory | Role |
| --- | --- |
| `cmd/cron` | Lambda function entrypoint. Always holds the cron Lambda bootstrap. |
| `pkg/cronhandlers` | Cron registry, dispatcher, shared helpers, and concrete cron handler packages. |
| `pkg/cronhandlers/handlers` | Optional central registration package that imports concrete handlers and registers names. |
| `pkg/cronhandlers/shared` | Shared cron-only helper code. |

## `cmd/cron`

Keep `cmd/cron` boring:

```go
type CronEvent struct {
    Handler string          `json:"handler"`
    Payload json.RawMessage `json:"payload"`
}

func handle(ctx context.Context, event CronEvent) error {
    svc := services.NewServices()
    svc.StackName = os.Getenv("STACK_NAME")

    return cronhandlers.Dispatch(ctx, svc, event.Handler, event.Payload)
}

func main() {
    lambda.Start(handle)
}
```

Responsibilities:

- Start the Lambda runtime.
- Decode the scheduled event into a typed `CronEvent`.
- Build a fresh `*services.Services` for the invocation.
- Set top-level runtime config from environment variables.
- Delegate named handler dispatch.

Avoid putting cron job branching, service initialization, business logic, or handler-specific parsing in `cmd/cron`.

## Registration import

`cmd/cron` should trigger handler registration with a blank import:

```go
import (
    "github.com/example/project/pkg/cronhandlers"

    // Register cron handlers via init().
    _ "github.com/example/project/pkg/cronhandlers/handlers"
)
```

The blank import is intentional. It loads the registration package so its `init()` function can register all cron handler names.

## `pkg/cronhandlers` registry

Use a registry keyed by stable handler name:

```go
type HandlerFunc func(
    ctx context.Context,
    svc *services.Services,
    payload json.RawMessage,
) error

type InitFunc func(
    ctx context.Context,
    svc *services.Services,
) error

type Handler struct {
    Init   InitFunc
    Handle HandlerFunc
}

var handlers = map[string]Handler{}
```

Register handlers with `MustRegister`:

```go
func MustRegister(name string, init InitFunc, handle HandlerFunc) {
    if name == "" {
        panic("cronhandlers: empty handler name")
    }
    if _, exists := handlers[name]; exists {
        panic(fmt.Sprintf("cronhandlers: duplicate handler %q", name))
    }
    handlers[name] = Handler{Init: init, Handle: handle}
}
```

`MustRegister` should fail fast on invalid startup configuration. Duplicate names are programmer errors, not runtime errors.

## Dispatch

`Dispatch` is the cron front controller:

1. Read the handler name from the event.
2. Look up the registered handler.
3. Return an error when the name is unknown.
4. Run the handler's `InitFunc`.
5. Call the handler's `HandlerFunc` with the raw payload.
6. Wrap init and handler errors with the handler name.

Typical shape:

```go
func Dispatch(
    ctx context.Context,
    svc *services.Services,
    name string,
    payload json.RawMessage,
) error {
    registered, ok := handlers[name]
    if !ok {
        return fmt.Errorf("cronhandlers: unknown handler %q", name)
    }

    if err := registered.Init(ctx, svc); err != nil {
        return fmt.Errorf("cronhandlers: init %q: %w", name, err)
    }

    if err := registered.Handle(ctx, svc, payload); err != nil {
        return fmt.Errorf("cronhandlers: handle %q: %w", name, err)
    }

    return nil
}
```

## Registration package

Keep handler name declarations centralized in `pkg/cronhandlers/handlers`:

```go
func init() {
    cronhandlers.MustRegister("ingestor", ingestor.Init, ingestor.Handle)
    cronhandlers.MustRegister("profiler", profiler.Init, profiler.Handle)
}
```

Concrete handler packages stay modular, but the cron surface remains easy to scan.

## Handler packages

Each cron handler package should expose two public functions:

```go
func Init(ctx context.Context, svc *services.Services) error {
    if err := svc.WithAWS(); err != nil {
        return err
    }
    if err := svc.WithGDrive(); err != nil {
        return err
    }
    return svc.WithEmbeddingLLM()
}

func Handle(ctx context.Context, svc *services.Services, payload json.RawMessage) error {
    // Parse payload if needed, then run cron job logic.
    return nil
}
```

`Init` responsibilities:

- Initialize only services required by that cron job.
- Keep initialization idempotent by relying on `Services.WithX` methods.
- Return helpful errors when required configuration is missing.

`Handle` responsibilities:

- Parse `payload` if the job needs input.
- Run application logic.
- Log meaningful progress and summary counts.
- Return errors so Lambda/EventBridge can observe failures.

Avoid constructing real infrastructure clients directly in cron handlers; initialize through `*services.Services`.

## Payloads

Use `json.RawMessage` at the dispatch boundary so each handler owns its input schema:

```go
type Payload struct {
    Limit int `json:"limit"`
}

func Handle(ctx context.Context, svc *services.Services, raw json.RawMessage) error {
    var payload Payload
    if len(raw) > 0 {
        if err := json.Unmarshal(raw, &payload); err != nil {
            return fmt.Errorf("parse payload: %w", err)
        }
    }

    return runJob(ctx, svc, payload)
}
```

Keep payload schemas small and handler-local unless multiple jobs share the same schema.

## Design rules

- `cmd/cron` is only the Lambda entrypoint and composition root.
- `pkg/cronhandlers` owns registration, dispatch, per-handler initialization, shared cron helpers, and concrete cron handlers.
- Register handlers through `init()` in one registration package, triggered by a blank import from `cmd/cron`.
- Use stable handler names because scheduled events depend on them.
- Use `MustRegister` so duplicate or empty names fail during startup.
- Keep `Init` separate from `Handle` so dependencies are explicit and easy to test.
- Keep business logic out of the registry and out of `cmd/cron`.
- Pass `*services.Services` through handlers instead of using globals.

## When reviewing code

Check that:

- New cron jobs are registered in `pkg/cronhandlers/handlers`.
- `cmd/cron` did not grow job-specific logic.
- Handler packages expose `Init` and `Handle` with the registry signatures.
- `Init` initializes all services used by `Handle`.
- Payload parsing happens inside the owning handler package.
- Unknown handler names return errors.
- Init and handler errors are wrapped with the handler name.
- Tests reset or isolate the global handler registry when registering test handlers.

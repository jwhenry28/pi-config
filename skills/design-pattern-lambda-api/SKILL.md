---
name: design-pattern-lambda-api
description: Use when designing, reviewing, or adding AWS Lambda HTTP APIs in Go - covers the cmd/api Lambda entrypoint, pkg/apihandlers registry, route registration, validators, and modular handler packages
module: design-patterns
---

# Lambda API Pattern

## Core idea

Use `cmd/api` as a thin AWS Lambda adapter and `pkg/apihandlers` as the application HTTP routing layer.

The shape is:

```text
API Gateway request
  -> cmd/api Lambda entrypoint
  -> pkg/apihandlers front controller
  -> registered API handler
  -> response
```

`cmd/api` should know about Lambda, environment variables, and top-level service construction. `pkg/apihandlers` should know about API paths, request validation, route registration, and handler dispatch.

## Directory roles

| Directory | Role |
| --- | --- |
| `cmd/api` | Lambda function entrypoint. Always holds the API Lambda bootstrap. |
| `cmd/api/handler` | Small adapter from Lambda code to the API handler registry. |
| `pkg/apihandlers` | API handler registry, shared response helpers, route validation, and API handler packages. |
| `pkg/apihandlers/endpoints` | Central registration package that imports concrete handlers and registers paths. |

## `cmd/api`

Keep `cmd/api` boring:

```go
func handle(ctx context.Context, event events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
    svc := services.NewServices()
    svc.StackName = os.Getenv("STACK_NAME")

    return handler.Handle(ctx, svc, event)
}

func main() {
    lambda.Start(handle)
}
```

Responsibilities:

- Start the Lambda runtime.
- Build a fresh `*services.Services` for the request.
- Set top-level runtime config from environment variables.
- Delegate request handling.

Avoid putting routing, auth, JSON parsing, business logic, or endpoint-specific initialization in `cmd/api`.

## `cmd/api/handler`

This package bridges the Lambda entrypoint to `pkg/apihandlers` and triggers route registration:

```go
import (
    "github.com/example/project/pkg/apihandlers"

    // Register API handlers via init().
    _ "github.com/example/project/pkg/apihandlers/endpoints"
)

func Handle(
    ctx context.Context,
    svc *services.Services,
    event events.APIGatewayV2HTTPRequest,
) (events.APIGatewayV2HTTPResponse, error) {
    return apihandlers.Serve(ctx, event, svc)
}
```

The blank import is intentional. It loads the registration package so its `init()` function can register all API paths.

## `pkg/apihandlers` registry

Use a front-controller registry keyed by API path:

```go
type HandlerFunc func(
    ctx context.Context,
    event events.APIGatewayV2HTTPRequest,
    services *services.Services,
) (events.APIGatewayV2HTTPResponse, error)

type route struct {
    handler HandlerFunc
    opts    []func(*events.APIGatewayV2HTTPRequest) error
}

var routes = map[string]route{}
```

Register routes with `MustRegister`:

```go
func MustRegister(path string, handler HandlerFunc, opts ...func(*events.APIGatewayV2HTTPRequest) error) {
    if path == "" {
        panic("apihandlers: empty path")
    }
    if _, exists := routes[path]; exists {
        panic(fmt.Sprintf("apihandlers: duplicate path %q", path))
    }
    routes[path] = route{handler: handler, opts: opts}
}
```

`MustRegister` should fail fast on invalid startup configuration. Duplicate paths are programmer errors, not runtime errors.

## Request serving

`Serve` is the front controller:

1. Read `event.RequestContext.HTTP.Path`.
2. Look up the route.
3. Return `404` when no route matches.
4. Run route validators/options.
5. Return `403` when validation fails.
6. Call the registered handler.
7. Log request and response status.

Typical shape:

```go
func Serve(
    ctx context.Context,
    event events.APIGatewayV2HTTPRequest,
    svc *services.Services,
) (events.APIGatewayV2HTTPResponse, error) {
    path := event.RequestContext.HTTP.Path
    registeredRoute, ok := routes[path]
    if !ok {
        return events.APIGatewayV2HTTPResponse{StatusCode: 404, Body: "Not Found"}, nil
    }

    if err := validateRequest(&event, registeredRoute.opts); err != nil {
        return events.APIGatewayV2HTTPResponse{StatusCode: 403, Body: "Forbidden"}, nil
    }

    return registeredRoute.handler(ctx, event, svc)
}
```

## Registration package

Keep path declarations centralized in `pkg/apihandlers/endpoints`:

```go
func init() {
    adminAuth := authentication.WithAdminCredentials()

    apihandlers.MustRegister("/admin/chat", chat.Handle, adminAuth)
    apihandlers.MustRegister("/webhook/whatsapp", whatsapp.HandleWhatsAppWebhook)
    apihandlers.MustRegister("/privacy", legal.HandlePrivacy)
}
```

Concrete handler packages stay modular, but the API surface remains easy to scan.

## Handler packages

A handler package should expose one public handler function matching `apihandlers.HandlerFunc`:

```go
func Handle(
    ctx context.Context,
    event events.APIGatewayV2HTTPRequest,
    svc *services.Services,
) (events.APIGatewayV2HTTPResponse, error) {
    if event.RequestContext.HTTP.Method != "POST" {
        return events.APIGatewayV2HTTPResponse{StatusCode: 405, Body: "Method Not Allowed"}, nil
    }

    if err := svc.WithAWS(); err != nil {
        return apihandlers.ErrorResponse(500, fmt.Sprintf("init AWS: %v", err)), nil
    }

    // Parse request, run application logic, return response.
}
```

Handler responsibilities:

- Check supported HTTP methods.
- Initialize only the services it needs.
- Parse and validate request input.
- Call business/domain code.
- Return an API Gateway response.

Avoid constructing real infrastructure clients directly in handlers; initialize through `*services.Services`.

## Route validators

Use registration options for cross-cutting request checks such as admin credentials:

```go
apihandlers.MustRegister("/admin/users", users.Handle, authentication.WithAdminCredentials())
```

Validators run before the handler. They should inspect the request and return an error on failure. Keep them small and reusable.

## Shared responses

Put common API response helpers in `pkg/apihandlers`, not in individual handlers:

```go
func ErrorResponse(statusCode int, msg string) events.APIGatewayV2HTTPResponse {
    return events.APIGatewayV2HTTPResponse{
        StatusCode: statusCode,
        Headers:    map[string]string{"Content-Type": "application/json"},
        Body:       fmt.Sprintf(`{"error":"%s"}`, msg),
    }
}
```

## Design rules

- `cmd/api` is only the Lambda entrypoint and composition root.
- `pkg/apihandlers` owns routing, registration, validators, and shared API response helpers.
- Concrete API handlers live under `pkg/apihandlers` and are registered centrally.
- Register routes through `init()` in one registration package, triggered by a blank import from `cmd/api/handler`.
- Use `MustRegister` so duplicate or empty paths fail during startup.
- Keep route matching simple unless the project clearly needs path parameters or a full router.
- Keep business logic outside the registry and outside `cmd/api`.
- Pass `*services.Services` through handlers instead of using globals.

## When reviewing code

Check that:

- New API endpoints are registered in `pkg/apihandlers/endpoints`.
- `cmd/api` did not grow endpoint-specific logic.
- Handler functions match the registry signature.
- Admin/auth checks are route validators when reusable.
- Unknown paths return `404`; failed validators return `403`; unsupported methods return `405`.
- Tests reset or isolate the global route registry when registering test routes.

---
name: design-pattern-services
description: Use when designing, reviewing, or testing a Services object/service container pattern across projects - covers dependency bundling, lazy service initialization, passing app dependencies through handlers, and test MockServices builders
module: design-patterns
---

# Services Pattern

## Core idea

Use a `Services` object as an explicit dependency bundle for application-wide infrastructure: database, cloud clients, messaging, LLMs, file storage, clocks, config, etc.

This is a lightweight service container. It is not a shared library or framework: each project defines the fields and initialization methods it actually needs, but the shape stays consistent.

## Production Services

A production `Services` type usually contains:

- Configuration needed to construct dependencies, such as `StackName`, environment, region, or base URLs
- Long-lived infrastructure clients, such as `AWS`, `DB`, `Email`, `Messenger`, `Storage`, or `LLM`
- Small cross-cutting dependencies, such as `Time` or logging
- `WithX` initialization methods that lazily populate fields

Typical shape:

```go
type Services struct {
    StackName string
    AWS       *aws.AWS
    WhatsApp  messengers.Messenger
    ChatLLM   llmtypes.LLMProvider
    Time      timesvc.Time
}

func NewServices() *Services {
    return &Services{Time: timesvc.RealTime{}}
}

func (s *Services) WithAWS() error {
    if s.AWS != nil {
        return nil
    }
    if s.StackName == "" {
        return fmt.Errorf("services: StackName must be set before AWS")
    }
    s.AWS = aws.New(s.StackName, s.Time)
    return nil
}
```

`WithX` methods should be:

- **Idempotent**: return immediately if the field is already set
- **Explicit about prerequisites**: fail if required config or parent services are missing
- **Responsible for real construction**: read secrets/config and create production clients
- **Small and boring**: no business logic

## How code uses Services

Entrypoints create one `Services` value, set top-level config, then pass it down:

```go
func handle(event Event) error {
    svc := services.NewServices()
    svc.StackName = os.Getenv("STACK_NAME")

    return handler.Handle(svc, event)
}
```

Handlers initialize only what they need:

```go
func InitServices(svc *services.Services) error {
    if err := svc.WithAWS(); err != nil {
        return err
    }
    return svc.WithWhatsApp()
}
```

Business code receives `*services.Services` and uses the already-initialized dependencies:

```go
func SendWelcomeMessage(svc *services.Services, user User) error {
    if err := svc.AWS.DB.SaveUser(user); err != nil {
        return err
    }
    _, err := svc.WhatsApp.SendMessage(user.Phone, "Welcome!")
    return err
}
```

This keeps dependencies explicit without passing many individual clients through every function and without relying on globals.

## Test Services

Tests use a separate `MockServices` or `TestServices` builder. It holds mocks/fakes, then converts into the real production `*services.Services` shape.

```go
type MockServices struct {
    AWS       *MockAWS
    Messenger *MockMessenger
    LLM       *MockLLMProvider
    Time      timesvc.Time
}

func NewMockServices() *MockServices {
    return &MockServices{
        AWS:       NewMockAWS(),
        Messenger: &MockMessenger{MessageID: "mock-message-id"},
        LLM:       &MockLLMProvider{Reply: "mock reply"},
        Time:      timesvc.RealTime{},
    }
}

func (m *MockServices) ToServices() *services.Services {
    return &services.Services{
        AWS:      m.AWS.ToAWS(),
        WhatsApp: m.Messenger,
        ChatLLM:  m.LLM,
        Time:     m.Time,
    }
}
```

Usage:

```go
func TestSendWelcomeMessage(t *testing.T) {
    mock := testutils.NewMockServices()
    mock.Messenger.MessageID = "wamid.test"

    svc := mock.ToServices()

    err := SendWelcomeMessage(svc, User{Phone: "+15551234567"})

    assert.NoError(t, err)
    assert.Equal(t, "+15551234567", mock.Messenger.LastTo)
}
```

The important point: production code still receives `*services.Services`. Tests swap the contents of the bundle, not the function signatures.

## Design rules

- Prefer one project-specific `Services` type over many globals.
- Keep `Services` focused on infrastructure and cross-cutting dependencies, not domain state.
- Use interfaces only at meaningful boundaries, such as messenger or LLM providers; avoid tiny test-only interfaces.
- Let each project define its own fields and `WithX` methods. Do not force a common library when dependency sets differ.
- Initialize dependencies near boundaries: Lambda handlers, CLI commands, HTTP endpoints, cron handlers.
- Make tests configure mocks before calling `ToServices()`.
- If a dependency is optional in production, make that optionality explicit in the consuming code or initializer.

## TypeScript variant

Same pattern, different syntax:

```typescript
export type Services = {
  env: string;
  db?: Database;
  email?: EmailClient;
  clock: Clock;
};

export function newServices(): Services {
  return { env: process.env.APP_ENV ?? "dev", clock: realClock };
}

export async function withDb(services: Services): Promise<void> {
  if (services.db) return;
  services.db = await createDatabaseClient(services.env);
}
```

Test builder:

```typescript
export function newMockServices(overrides: Partial<Services> = {}): Services {
  return {
    env: "test",
    db: new MockDatabase(),
    email: new MockEmailClient(),
    clock: fixedClock("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
```

## When reviewing code

Check that:

- Entrypoints create and pass `Services` explicitly
- Initialization order is clear and guarded by helpful errors
- `WithX` methods are idempotent
- Business logic does not construct real infrastructure clients directly
- Tests use `MockServices`/`ToServices()` instead of real cloud or network calls

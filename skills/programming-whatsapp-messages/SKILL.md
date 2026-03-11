---
name: programming-whatsapp-messages
description: Use when building WhatsApp messaging features, sending messages via Cloud API, handling webhooks, or working with message templates - covers WhatsApp Business Platform APIs and patterns
---

# Programming WhatsApp Messages

Reference for building on the WhatsApp Business Platform using Cloud API.

## Platform Architecture

The platform has three core APIs:

| API | Purpose |
| --- | --- |
| **Cloud API** | Send text, media, and interactive messages; make calls; manage groups |
| **Business Management API** | Manage WABAs, phone numbers, templates, and analytics |
| **Marketing Messages API** | Send optimized marketing messages with quality-based delivery |

## Cloud API Basics

All requests go through Graph API over HTTP:

```
https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages
```

**Authentication:** OAuth access tokens in the `Authorization: Bearer` header. Use **System User access tokens** for long-lived automated services (admin or employee roles). For details, see [references/authentication.md](references/authentication.md).

**Send a text message:**

```bash
curl 'https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {ACCESS_TOKEN}' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "{RECIPIENT_PHONE}",
    "type": "text",
    "text": {
      "preview_url": true,
      "body": "Hello from the bot!"
    }
  }'
```

## Key Resources

- **Business portfolio** — container for all Meta business assets; required to use the platform
- **WABA (WhatsApp Business Account)** — represents your business; links phone numbers, templates, analytics
- **Business phone number** — real or virtual number for sending/receiving messages
- **Message templates** — pre-approved message structures; required for messaging outside a customer service window; subject to quality scores and messaging limits

## Webhooks

Webhooks deliver JSON payloads to your server for:

- Incoming messages from users
- Outgoing message delivery status updates
- Asynchronous error handling

All incoming message content and delivery statuses are communicated exclusively via webhooks.

## Test Resources

Cloud API auto-creates a test WABA and test phone number with relaxed messaging limits and no payment method required. Use the API Playground ("Try it" buttons in API reference docs) for endpoint testing.

## References

- Authentication and access tokens: [references/authentication.md](references/authentication.md)
- Text messages (body, link previews): [references/text-messages.md](references/text-messages.md)
- Webhooks (payloads, fields, delivery): [references/webhooks.md](references/webhooks.md)
- Message types and API schemas: [references/message-types.md](references/message-types.md)

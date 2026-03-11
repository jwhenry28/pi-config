# Text Messages

Text messages contain only a body and an optional link preview.

## Request

```
POST /<PHONE_NUMBER_ID>/messages
```

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<RECIPIENT_PHONE>",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "<BODY_TEXT>"
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `text.body` | string | Yes | Message text. Max 4096 characters. URLs auto-hyperlinked. |
| `text.preview_url` | boolean | No | Set `true` to render a link preview of the first URL in `body`. URL must start with `http://` or `https://`. Only the first URL gets a preview. If omitted or preview fetch fails, a clickable link renders instead. |

## Response

```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    {
      "input": "+16505551234",
      "wa_id": "16505551234"
    }
  ],
  "messages": [
    {
      "id": "wamid.HBgLMTY0NjcwNDM1OTUVAgARGBI1RjQyNUE3NEYxMzAzMzQ5MkEA"
    }
  ]
}
```

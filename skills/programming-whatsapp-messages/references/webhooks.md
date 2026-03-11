# Webhooks

HTTP requests containing JSON payloads sent from Meta's servers to your endpoint. Used for incoming messages, outgoing message status, account changes, template quality scores, and more.

## Table of Contents

- [Payload Structure](#payload-structure)
- [Permissions](#permissions)
- [Webhook Fields](#webhook-fields)
- [Delivery and Retries](#delivery-and-retries)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Payload Structure

All webhooks follow this envelope structure:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550783881",
              "phone_number_id": "106540352242922"
            },
            "contacts": [
              {
                "profile": { "name": "Sheena Nelson" },
                "wa_id": "16505551234"
              }
            ],
            "messages": [
              {
                "from": "16505551234",
                "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
                "timestamp": "1749416383",
                "type": "text",
                "text": { "body": "Does it come in another color?" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

Key fields:
- `entry[].id` — WABA ID
- `entry[].changes[].field` — which webhook field triggered this payload
- `entry[].changes[].value.metadata` — your business phone number info
- `entry[].changes[].value.contacts` — sender profile and WhatsApp ID
- `entry[].changes[].value.messages` — array of incoming messages (type, content, timestamp)

## Permissions

| Permission | Covers |
| --- | --- |
| `whatsapp_business_messaging` | `messages` webhooks |
| `whatsapp_business_management` | All other webhooks |

Grant these permissions to your app when generating your system token.

## Webhook Fields

Subscribe to fields via **App Dashboard → WhatsApp → Configuration**.

### Core Fields

| Field | Description |
| --- | --- |
| `messages` | Incoming messages from users and outgoing message delivery statuses |
| `message_template_status_update` | Template status changes (approval, rejection) |
| `message_template_quality_update` | Template quality score changes |
| `message_template_components_update` | Template component changes |
| `template_category_update` | Template category changes |

### Account Fields

| Field | Description |
| --- | --- |
| `account_alerts` | Messaging limit, business profile, or Official Business Account status changes |
| `account_review_update` | WABA policy review outcomes |
| `account_update` | Verification, policy violations, deletion, or partner sharing changes |
| `business_capability_update` | WABA or business portfolio capability changes |
| `security` | Phone number security setting changes |

### Phone Number Fields

| Field | Description |
| --- | --- |
| `phone_number_name_update` | Display name verification outcomes |
| `phone_number_quality_update` | Throughput level changes |

### Other Fields

| Field | Description |
| --- | --- |
| `automatic_events` | Purchase or lead events from Click to WhatsApp ad conversations |
| `user_preferences` | Marketing message preference changes |
| `payment_configuration_update` | Payments API configuration changes (India/Brazil) |
| `history` | WhatsApp Business app chat history sync (solution providers) |
| `smb_app_state_sync` | Contact sync for onboarded WhatsApp Business app users |
| `smb_message_echoes` | Messages sent via WhatsApp Business app by onboarded customers |
| `partner_solutions` | Multi-Partner Solution status changes |

## Delivery and Retries

- **Max payload size:** 3 MB
- **Success response:** Your server must return HTTP `200`
- **Retry policy:** If delivery fails, Meta retries with decreasing frequency for up to **7 days**
- **Duplicates:** Retries go to all subscribed apps, which can cause duplicate notifications

## Override Webhooks

You can set an alternate webhook endpoint per WABA or per business phone number. Useful for testing or for solution providers using unique endpoints per customer.

## Security

- **Mutual TLS (mTLS):** Supported for added security
- **IP addresses:** Get webhook server IPs via:

```bash
whois -h whois.radb.net — '-i origin AS32934' | grep '^route' | awk '{print $2}' | sort
```

IP addresses change periodically — prefer mTLS over IP allowlisting.

## Troubleshooting

If not receiving webhooks:

1. Verify your endpoint is accepting requests
2. Send a test payload via **App Dashboard → WhatsApp → Configuration**
3. Ensure your app is in **Live mode** (some webhooks don't fire in Dev mode)
4. Use Meta's test webhook endpoint to isolate whether the issue is your endpoint code

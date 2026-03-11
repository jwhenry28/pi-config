# Authentication

## Table of Contents

- [Token Types](#token-types)
- [System User Access Tokens](#system-user-access-tokens)
- [Generating a System User Token](#generating-a-system-user-token)
- [Business Integration System User Tokens](#business-integration-system-user-tokens)
- [User Access Tokens](#user-access-tokens)
- [Using Tokens in Requests](#using-tokens-in-requests)
- [Business Asset Access](#business-asset-access)

## Token Types

| Token Type | Use Case | Lifespan |
| --- | --- | --- |
| **System User** | Direct developers; automated services for your own business | Long-lived |
| **Business Integration System User** | Tech Providers accessing onboarded customer data | Long-lived |
| **User** | Quick testing via App Dashboard | Short-lived (hours) |

**Which to use:**

- **Direct developer** (accessing your own data) → System User token
- **Tech Provider** → Business Integration System User token
- **Solution partner** → System User tokens for credit sharing, Business Integration tokens for everything else

## System User Access Tokens

System tokens represent your business or automated services. They are long-lived and require no user input. Most endpoints check if the system user identified by the token has access to the queried resource — if not, the request fails with error code 200.

### Admin vs Employee

| Role | Default Access | When to Use |
| --- | --- | --- |
| **Admin** | Full access to all WABAs and assets in the business portfolio | App needs access to all assets |
| **Employee** | Must be granted access to individual WABAs | App only needs access to a few WABAs |

Admin access can be overridden to partial access on a per-WABA basis.

## Generating a System User Token

1. Go to **Business Settings** → **System Users**
2. Click **+Add**, enter a name, assign **Admin** or **Employee** role
3. Click the system user's name → **Assign assets**
4. Select your app, grant **Manage app** permission, confirm
5. Reload the page to verify **Full control** is granted
6. Click **Generate token**, select your app, choose token expiration, and assign these permissions:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
7. Click **Generate token** and copy the token

## Business Integration System User Tokens

Scoped to individual onboarded customers. Used by Tech Providers for automated actions on customer WABAs.

**To generate:** Implement Embedded Signup (with Facebook Login for Businesses) and exchange the code returned when a customer completes the flow.

## User Access Tokens

Short-lived tokens primarily for initial testing. Generated automatically when visiting **App Dashboard → WhatsApp → API Setup**. Other methods: Graph API Explorer or Facebook Login.

**Not recommended for production** — they expire every few hours.

## Using Tokens in Requests

Include the token in the `Authorization` header:

```bash
curl 'https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/message_templates' \
  -H 'Authorization: Bearer EAAJB...'
```

## Business Asset Access

After creating a system user, set business asset access levels on each WABA. Many endpoints require either **Partial** or **Full** access — without it, they return error code 200.

**Partial access** allows granular restrictions (e.g., view-only for templates and phone numbers).

**To set access:**

1. Sign into **Meta Business Suite**
2. Go to your business portfolio → **Settings** (gear icon)
3. Navigate to **Accounts → WhatsApp Accounts**
4. Select the WABA → **WhatsApp Account Access** tab
5. Click **+Add people**, select the system user, assign access levels

# Database Structure

Canonical schema file: [`../supabase-schema.sql`](../supabase-schema.sql)

## Enums

### `app_role`

- `admin`
- `bailleur`
- `agence`
- `locataire`

### `house_status`

- `Disponible`
- `Réservé`
- `Loué`
- `Archivé`

### `contract_status`

- `brouillon`
- `pret_a_signer`
- `signe`
- `annule`

## Tables

### `role`

Reference table for application roles.

| Column | Type | Notes |
|---|---|---|
| `id` | `smallint` | Primary key. `1=admin`, `2=bailleur`, `3=agence`, `4=locataire` |
| `name` | `app_role` | Unique |
| `label` | `text` | Display label |
| `description` | `text` | Optional |
| `created_at` | `timestamptz` | Defaults to `now()` |

### `users`

Single source of truth for application users. It mirrors Supabase Auth identities through `auth.users(id)`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, references `auth.users(id)` |
| `role_id` | `smallint` | References `role(id)`, defaults to locataire |
| `full_name` | `text` | Required |
| `email` | `text` | Unique |
| `phone` | `text` | Optional |
| `verified` | `boolean` | Defaults to `false` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `updated_at` | `timestamptz` | Defaults to `now()` |

### `houses`

Rental listings published by admins, landlords, or agencies.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | References `users(id)` |
| `title` | `text` | Required |
| `description` | `text` | Required |
| `city` | `text` | Required |
| `commune` | `text` | Required |
| `district` | `text` | Neighborhood/quartier |
| `address` | `text` | Indicative address |
| `latitude` | `double precision` | Exact marker latitude |
| `longitude` | `double precision` | Exact marker longitude |
| `price` | `numeric(12,2)` | Monthly rent |
| `rooms` | `int` | Room count |
| `type` | `text` | Maison, Appartement, Villa, Studio |
| `status` | `house_status` | Defaults to `Disponible` |
| `image_url` | `text` | Public storage URL |
| `features` | `text[]` | Amenities |
| `created_at` | `timestamptz` | Defaults to `now()` |

### `rental_requests`

Contract requests initiated by tenants.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `house_id` | `uuid` | References `houses(id)` |
| `tenant_id` | `uuid` | References `users(id)` |
| `message` | `text` | Optional tenant message |
| `status` | `text` | `en_attente`, `approuvee`, `rejetee` |
| `created_at` | `timestamptz` | Defaults to `now()` |
| `updated_at` | `timestamptz` | Defaults to `now()` |

### `contracts`

Digital rental contracts.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `house_id` | `uuid` | References `houses(id)` |
| `owner_id` | `uuid` | References `users(id)` |
| `tenant_id` | `uuid` | References `users(id)` |
| `start_date` | `date` | Contract start date |
| `duration_months` | `int` | Defaults to `12` |
| `rent` | `numeric(12,2)` | Monthly rent |
| `status` | `contract_status` | Defaults to `brouillon` |
| `seal_code` | `text` | Unique digital seal |
| `contract_request_id` | `uuid` | References `rental_requests(id)` |
| `agreed_by_owner_at` | `timestamptz` | Owner approval timestamp |
| `agreed_by_tenant_at` | `timestamptz` | Tenant agreement timestamp |
| `signed_by_owner_at` | `timestamptz` | Owner signature timestamp |
| `signed_by_tenant_at` | `timestamptz` | Tenant signature timestamp |
| `created_at` | `timestamptz` | Defaults to `now()` |

### `notifications`

Persistent in-app notifications. Web Push is attempted in parallel when VAPID keys and subscriptions exist.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | Recipient, references `users(id)` |
| `actor_id` | `uuid` | Actor, references `users(id)` |
| `type` | `text` | Event type |
| `title` | `text` | Notification title |
| `body` | `text` | Notification body |
| `url` | `text` | Destination path |
| `read_at` | `timestamptz` | Null until read |
| `metadata` | `jsonb` | Event metadata |
| `created_at` | `timestamptz` | Defaults to `now()` |

### `messages`

Classic one-to-one messages attached to a house. A conversation is derived from the house and its two participants; no separate conversation record is required.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `house_id` | `uuid` | References `houses(id)` |
| `sender_id` | `uuid` | Sender, references `users(id)` |
| `recipient_id` | `uuid` | Recipient, references `users(id)` |
| `body` | `text` | Required, 1 to 2,000 trimmed characters |
| `read_at` | `timestamptz` | Null until the recipient opens the conversation |
| `created_at` | `timestamptz` | Defaults to `now()` |

### `push_subscriptions`

Browser Web Push subscriptions.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | References `users(id)` |
| `endpoint` | `text` | Unique browser endpoint |
| `subscription` | `jsonb` | Push subscription payload |
| `created_at` | `timestamptz` | Defaults to `now()` |

## Storage

### Bucket `house-images`

Public bucket for listing images.

Path convention:

```txt
house-images/{auth.uid()}/{timestamp}-{safe-file-name}
```

## Contract Workflow

1. Tenant clicks `Demander un contrat`.
2. A row is inserted into `rental_requests`.
3. The owner receives an in-app notification and Web Push if enabled.
4. Owner approves the request, creating a `contracts` row linked to `contract_request_id`.
5. Tenant receives a notification with `/contrats?house={id}`.
6. Owner signs the contract.
7. Tenant confirms agreement/signature.
8. Owner and admins receive notifications.

## RLS Summary

- Public read: `role`, `houses`
- Users: public read, own insert/update, admin update
- Houses: owner/admin write restrictions
- Rental requests: tenants create/read own; owners read/update requests for their houses
- Contracts: participants read/update; owner inserts after request approval; admins read
- Notifications: recipients read/update own notifications
- Push subscriptions: owners manage their own subscriptions

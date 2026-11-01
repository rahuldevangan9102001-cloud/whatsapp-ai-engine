# Database migrations

The WhatsApp server requires `lead_followup_events` to claim inactive-lead
follow-ups exactly once. If Supabase reports that the table is missing from its
schema cache, run `migrations/004_lead_followup_events.sql` in the Supabase SQL
Editor. The migration creates the table and uniqueness constraint used to avoid
duplicate follow-ups, then asks PostgREST to reload its schema cache.

For CRM-originated notifications, run
`migrations/005_crm_notification_events.sql` against the same Supabase project
configured by `SUPABASE_URL`. It creates the durable, idempotent outbound
notification queue used by both the CRM API and database events, then sends a
PostgREST schema-cache reload notification. If the table is still reported as
missing, confirm the migration ran in the correct project and wait briefly for
the schema cache to refresh before retrying. Enable Supabase Realtime for
`public.users` so new-user inserts trigger an onboarding alert to `ADMIN_PHONE`
and a welcome greeting to the new contact.

The CRM backend can call these authenticated endpoints using the same bearer
key as `/notify`. Every CRM request needs an `eventId` that stays stable across
retries.
The server listens on `127.0.0.1` by default. For a separate CRM host, set
`NOTIFY_HOST=0.0.0.0` behind a TLS reverse proxy and restrict inbound access
with a firewall; do not expose the unencrypted listener directly to the internet.

```http
POST /crm/messages HTTP/1.1
Authorization: Bearer <NOTIFY_API_KEY>
Content-Type: application/json

{"eventId":"crm-123","phone":"+15551234567","message":"Your update"}

POST /crm/welcome HTTP/1.1
Authorization: Bearer <NOTIFY_API_KEY>
Content-Type: application/json

{"eventId":"crm-124","phone":"+15551234567","name":"A Lead"}

POST /crm/zoom-reminders HTTP/1.1
Authorization: Bearer <NOTIFY_API_KEY>
Content-Type: application/json

{"eventId":"crm-125","phone":"+15551234567","name":"A Lead","stage":"planShow"}

POST /crm/events HTTP/1.1
Authorization: Bearer <NOTIFY_API_KEY>
Content-Type: application/json

{"eventId":"crm-126","type":"onboarding","phone":"+15551234567","name":"A Lead"}
```

`/crm/events` also accepts `message`, `welcome`, `zoom`, `zoom_reminder`, and
`onboarding` event types. Zoom reminders use `planShow`, `training`, or
`leadership` from
`config/config.js`; replace the example `*_link_here` URLs with real meeting
links before sending them. CRM endpoints return `202` after queueing. Failed
sends are retried with backoff up to eight times, then marked failed in
`crm_notification_events`.

Call the API from the CRM backend, not directly from browser code: keep
`NOTIFY_API_KEY` private, and expose the engine only to a trusted backend over
TLS. The optional [notify.js](../notify.js) helpers can be imported by a
server-side Node CRM integration.

The Baileys multi-file auth state is stored in the project-root `auth_session`
directory by default. `WHATSAPP_AUTH_DIR` can override that location; QR codes
are printed to the terminal when WhatsApp requests pairing. Keep this directory
persistent between restarts and do not commit its contents.

After running the migrations, allow the Supabase schema cache to reload before
retrying.

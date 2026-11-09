# Database migrations

The WhatsApp server requires `lead_followup_events` to claim inactive-lead
follow-ups exactly once. If Supabase reports that the table is missing from its
schema cache, run `migrations/004_lead_followup_events.sql` in the Supabase SQL
Editor. The migration creates the table and uniqueness constraint used to avoid
duplicate follow-ups, then asks PostgREST to reload its schema cache.

The chat response uses `users.lead_notes` and timestamped `conversation_logs`
for conversational context. It reads the 50 newest records for existing
personal-memory handling and searches older records for up to three message
terms or a recognizable date, always scoped to the current user. Times shown
to the model use Asia/Kolkata (IST); search results are bounded and are not an
exhaustive transcript. Portal-link replies are recorded after a successful send
so they can be recalled later. Other pre-existing early-return flows and CRM or
scheduled messages are not necessarily recorded in `conversation_logs`.
No schema migration is required for this memory feature. It cannot recall
messages that were not logged, and client need (money versus products) is
inferred from available context rather than saved as a permanent profile.

Messages containing `link`, `portal`, or `binary` anywhere in the text
(case-insensitive), or their Hindi equivalents, bypass account verification and
AI and receive only `BINARY_TREE_URL` in one reply. This also applies to
unrelated links, negated requests, and messages mentioning account data; the
user can ask about those topics separately without these words. Existing app,
chart, and downline link matching also remains in place. A missing URL produces one
configuration-error reply instead. Pending account verification resumes only
when the user supplies identity details or makes another account-data request.

For saved customers, the sales workflow can update `current_step`,
`nodes_count`, and `lead_notes` and synchronizes those updates through the
existing Google Sheets service. Older notes without the consultant-flow version
are mapped to the applicable saved step. New users start at step 1 with the
current flow version and use the AI path until their saved step changes.
Explicit QR, UPI, and payment-details requests can send a single payment text
or QR image with caption; payment-completion messages and screenshots retain
the acknowledgement path. Portal-link and private account verification retain
their earlier precedence. Financial difficulty receives a supportive sales
response rather than a payment pitch. Successfully sent sales replies are logged
to `conversation_logs`, including QR captions.

Before starting the updated WhatsApp server, run
`migrations/006_whatsapp_inbound_claims.sql` in the SQL Editor of the WhatsApp
Supabase project used by `server.js`, then allow the PostgREST schema cache to
reload. A service-role Supabase credential is required. The server atomically
claims a hash of the WhatsApp account and inbound message ID before running
intent handlers, AI, or the single outbound send path. The primary key prevents
the same account/message ID from being processed again across processes and
restarts, including when a JID changes between device forms. Different message
IDs are not suppressed merely because their text is the same.

Claims are retained permanently; deleting them permits old events to be
processed again. Without the migration, a working database, or stable account
and message IDs, inbound replies are blocked and errors are logged. A claim is
not retried after a processing failure, an uncertain send, or a crash: this
prioritizes at-most-once sending over guaranteed delivery and can leave a
message unanswered. An ID collision for the same account also suppresses the
later message. The guard applies only to bot instances using this claim table;
other applications and independently scheduled or CRM notifications are not
deduplicated by it. Use one live bot per WhatsApp session because concurrent
Baileys sessions can still interfere with connectivity.
On socket close, the server removes its incoming-message listener from that
socket; late connection updates from an older socket cannot replace the current
connection state. Events already being processed still use the durable claim.

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

# Binary Tree CRM integration

The WhatsApp agent uses the existing Supabase `users` and `members` tables in
read-only queries to answer about the downline associated with the sender's
WhatsApp number. Messages containing `link`, `portal`, or `binary`
(case-insensitive, including within a longer word), or their supported Hindi
equivalents, receive the shared portal URL before account verification. This
also applies when a message asks for account information or a verification is
pending. Link replies are recorded in conversation history after sending; a
durable inbound-message claim is required to prevent duplicate replies.
Separate personal account-data requests still require a name and registered
mobile number.

Configure the shared CRM/tree portal link in the runtime environment:

```env
BINARY_TREE_URL=https://your-crm.example.com/
```

Configure an HTTP or HTTPS URL without embedded credentials. If it is not
configured, the agent reports that directly rather than inventing one.

The integration expects these existing columns:

- `users`: `phone_number`, `name`, `sponsor_phone`, `leg_position`,
  `payment_status`, `is_active`, `is_locked`, `left_count`, `right_count`
- `members`: `phone`, `name`, `status`

Descendant reads are bounded to five levels and 100 nodes by default. The AI
context contains names and aggregate/tree status only. `users.phone_number` is
used internally to traverse the tree, then removed before the data is exposed
to the AI; member phone numbers, CRM login IDs, and passwords are not retrieved
or passed to Gemini and are never sent in WhatsApp messages. Flexible name
matching is only for finding a corresponding member record; it is not
authentication and never enables credential disclosure. Login-help requests
receive secure password-reset guidance; payment does not guarantee live-tree
access unless current official terms confirm it.

The URL is shared, not a personalized login link. For login help, users must use
the organization's secure password-reset option. Account/payment status is
based on the current CRM record. Images remain in WhatsApp and are not sent for
external review.

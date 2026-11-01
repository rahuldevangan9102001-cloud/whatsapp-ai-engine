# Binary Tree CRM integration

The WhatsApp agent uses the existing Supabase `users` and `members` tables in
read-only queries to answer about the downline associated with the sender's
WhatsApp number. A binary-tree display, link, or login-details request first asks
the user to provide/confirm their name and mobile number. After both are
provided, the server checks the name against a Supabase member record associated
with the sender's WhatsApp number using case-insensitive normalized, partial,
and minor-typo-tolerant matching, then sends the configured shared portal URL
regardless of whether the details matched.

Configure the shared CRM/tree portal link in the runtime environment:

```env
BINARY_TREE_URL=https://your-crm.example.com/
```

The URL must use HTTP or HTTPS and must not contain embedded credentials. If it
is not configured, the agent reports that directly rather than inventing one.

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

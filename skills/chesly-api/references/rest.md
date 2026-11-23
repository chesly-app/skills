# The REST API

The base URL is `https://api.chesly.app/v1`. The OpenAPI 3.1 document, generated from the code that runs the API, is at https://api.chesly.app/v1/openapi.json (Wave 2).

Rows and sections marked (Wave 2) arrive with the API's second wave.

## Contents

- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Pages](#pages)
- [Filters, networks and email (Wave 2)](#filters-networks-and-email-wave-2)
- [IDs](#ids)
- [Errors](#errors)
- [Idempotency (Wave 2)](#idempotency-wave-2)
- [Sending (Wave 2)](#sending-wave-2)
- [Files](#files)
- [Editing and deleting](#editing-and-deleting)
- [Contacts and transcripts (Wave 2)](#contacts-and-transcripts-wave-2)
- [Limits](#limits)
- [Plans and billing](#plans-and-billing)

## Authentication

Every request carries the user's key as a bearer token: `Authorization: Bearer ck_live_…`.

```bash
curl https://api.chesly.app/v1/me -H "Authorization: Bearer $CHESLY_API_KEY"
```

- A missing or refused key is `401` `invalid_api_key`.
- A read-only key may only `GET`; anything else it asks is `403` `insufficient_scope`.
- Every answer carries `Chesly-Version`, the API version the key was made on (`2026-11-01`). Changes within a version only add fields and endpoints.

## Endpoints

| Endpoint | What it does |
|---|---|
| `GET /v1/me` | The key, the plan (`plan`) and its usage this period, and the `limits`: the plan's requests, keys and webhooks, and each account's send limits. (Wave 2) |
| `GET /v1/accounts` | The connected accounts: `id`, `network`, `display_name`, `status` (`connected`, `disconnected` or `needs_attention`) and `connected_at`. |
| `GET /v1/chats` | Chats, pinned first, then the newest: `account_id`, `unread`, `archived` (`true`, `false` or `all`), `q` (a name), `sort` (`recent` or `unread`), `limit`, `cursor`. |
| `GET /v1/chats/{chat_id}` | One chat. |
| `GET /v1/chats/{chat_id}/messages` | A chat's messages, newest first: `limit`, `cursor`. |
| `POST /v1/chats/{chat_id}/read` | Marks a chat read, as the apps do, and answers `{ read: true, receipt_sent }`. A message request is marked read with no receipt. |
| `GET /v1/messages/{message_id}` | One message, with its `delivery` when it was sent through the API. (Wave 2) |
| `GET /v1/messages/search` | Messages that match `q` (at most 200 characters), newest first: `chat_id`, `account_id`, `limit` (1 to 100, default 20). Each hit is a message plus `chat_name` and `network`. |
| `GET /v1/messages` | Everything new across the chats since `since`, a page at a time: `limit` (1 to 200, default 100), `cursor`. It answers `messages`, `next_cursor` and `until`; the next walk starts at `since=<until>`. Email reaches it up to 10 seconds after it arrives. |
| `GET /v1/catch_up` | The unread chats that aren't muted or archived, each with its newest messages, in one call: `chats` (1 to 50, default 20), `per_chat` (1 to 20, default 5). |
| `GET /v1/media/{media_id}` | The bytes of a message's file (`media.id`) or of an email's attachment (its `id` in `email.attachments`). See [Files](#files). |
| `POST /v1/chats/{chat_id}/messages` | Sends a message. See [Sending](#sending-wave-2). (Wave 2) |
| `POST /v1/media` | Uploads a file to send. See [Files](#files). (Wave 2) |
| `GET /v1/downloads/{token}`, `PUT /v1/uploads/{token}` | The one-time links that the MCP tools `get_media` and `create_upload` hand out, used without a key. See [Files](#files). |
| `PATCH /v1/messages/{message_id}`, `DELETE /v1/messages/{message_id}` | Edits the text of a message the user sent from Chesly, or deletes any message the user sent, for everyone in the chat. See [Editing and deleting](#editing-and-deleting). |
| `GET /v1/contacts` | The people of the user's direct chats, by name. (Wave 2) |
| `POST /v1/messages/{message_id}/transcript` | A voice note as text. (Wave 2) |
| `GET /v1/events`, `GET /v1/events/stream` | The event log, polled or streamed: [events-and-webhooks.md](events-and-webhooks.md). (Wave 2) |
| `GET /v1/webhooks`, `POST /v1/webhooks`, `GET /v1/webhooks/{id}`, `PATCH /v1/webhooks/{id}`, `DELETE /v1/webhooks/{id}` | Webhooks: [events-and-webhooks.md](events-and-webhooks.md#webhooks). (Wave 2) |
| `POST /v1/webhooks/{id}/rotate_secret`, `POST /v1/webhooks/{id}/test`, `GET /v1/webhooks/{id}/deliveries` | A webhook's new secret, a test delivery, and its delivery log. (Wave 2) |
| `GET /v1/keys`, `DELETE /v1/keys/{key_id}` | The user's API keys, and revoking one. (Wave 2) |
| `GET /v1/openapi.json` | The OpenAPI document, without a key. (Wave 2) |

A chat has `id`, `account_id`, `network`, `name`, `type` (`dm` or `group`), `unread_count`, `last_message_at`, `is_archived`, `is_pinned`, `is_muted`, `is_message_request` and `member_count`. A message has `id`, `chat_id`, `sender` (`name`, `is_me`), `text`, `truncated`, `type` (`text`, `image`, `video`, `audio`, `file` or `other`), `media` (`id`, `mime_type`, `file_name`), `sent_at`, `edited`, `deleted`, `reply_to` and `delivery`. Text is cut at 4,000 UTF-16 code units, and `truncated` says so. An email message also has `email`: `subject`, `from`, `to`, `cc` and `attachments`, each with `id`, `file_name`, `mime_type` and `size`; its `type` is `text` and its `media` is `null`.

## Pages

- Lists page with opaque cursors: pass `limit` (1 to 100, default 50) and the page before's `next_cursor` as `cursor`. The last page's `next_cursor` is null.
- `GET /v1/messages?since=` takes up to 200 a page (default 100). Search answers one page.
- A cursor that isn't one, or has expired, is `400` `invalid_cursor`: start again without it.
- Unknown query parameters are refused (`400` `invalid_request`), so a misspelt filter can't widen the answer.

## Filters, networks and email (Wave 2)

- `network` keeps `GET /v1/chats`, `GET /v1/catch_up`, `GET /v1/messages?since=` and `GET /v1/messages/search` to one network. The names: `whatsapp`, `imessage`, `instagram`, `messenger`, `telegram`, `signal`, `line`, `discord`, `slack`, `linkedin`, `twitter` (X), `reddit`, `gmessages` (Google Messages), `googlechat` (Google Chat), `grokbot` (Grok Bot), `chatgptdots` (OpenAI Dots), `muse` and `email`. `tiktok` and `wechat` are coming soon: only accounts that can connect them have chats there.
- Email is opt-in: those lists leave it out unless `network=email`, or `account_id` names an email account. An email chat or message is always reachable by its ID. An email read answers `409` `account_reconnect_required` when its account needs the user to reconnect it in the Chesly app. Don't retry. An email thread's `name` is its subject, and an email message also has `email` (`subject`, `from`, `to`, `cc`, `attachments`).
- `updated_since` on `GET /v1/chats` keeps the chats whose `last_message_at` is at or after it.
- `before` and `after` on `GET /v1/chats/{chat_id}/messages` keep the messages sent before or after those times, still newest first.
- Times are ISO 8601 with an offset, such as `2026-10-27T09:30:00Z`.

## IDs

IDs are opaque and prefixed: `acct_`, `chat_`, `msg_` and `media_`, and from Wave 2 `evt_`, `wh_`, `dlv_` and `contact_`. They are Chesly's own, not the networks'. Use them as they come; don't parse or build them. A message ID is long because it carries its chat.

## Errors

Every error is `application/problem+json` (RFC 9457):

```json
{
  "type": "https://agents.chesly.app/docs/errors#rate_limited",
  "title": "Too many requests.",
  "status": 429,
  "detail": "This API key made more than 900 requests in one minute. Retry in 4 s.",
  "code": "rate_limited",
  "request_id": "571d003e-ad60-4a08-858a-b7b5353f39db",
  "retry_after": 4
}
```

- Branch on `code`. `type` is `https://agents.chesly.app/docs/errors#<code>`, that code's entry, and https://agents.chesly.app/docs/errors lists them all.
- `title` is fixed per code; `detail` explains this occurrence. `request_id` is what support looks up.
- A `400` from bad parameters lists each problem in `errors`, with its `detail` and `pointer`.
- A `429` or `503` carries `Retry-After` and `retry_after`, in seconds. A `503` `upstream_unavailable` is temporary: retry it.
- Codes to expect: `invalid_api_key` (401), `insufficient_scope` (403), `chat_not_found`, `message_not_found` and `media_not_found` (404), `message_not_editable` and `message_not_deletable` (409), `file_url_invalid` (400) and `file_fetch_failed` (422) for a file sent by URL, `rate_limited` and `send_limit_reached` (429), `api_plan_required` and `transcription_limit_reached` (402), `upstream_unavailable` and `plan_unavailable` (503).

## Idempotency (Wave 2)

- Every `POST` under `/v1` takes an `Idempotency-Key` header: 1 to 255 characters of letters, digits, `.`, `_`, `:` and `-`, such as a UUID. Chesly keeps it 24 hours.
- The same key again gets the first answer back, with `Idempotent-Replayed: true`.
- The same key with a different request is `422` `idempotency_key_reused`. While the first request still runs, it is `409` `idempotency_in_progress` with `Retry-After: 1`.
- A `5xx` or `429` answer isn't kept: a retry with the same key runs again, and a send keeps its identity, so it still goes out only once.
- `POST /v1/media` ignores the key: an upload changes nothing on its own.
- The key is optional. Send one on every `POST` anyway, and reuse it on each retry of that request.

## Sending (Wave 2)

`POST /v1/chats/{chat_id}/messages` takes JSON with `text`, `reply_to` (a message ID in the same chat) and one file, as `media_id` or `file_url` ([Files](#files)): text, a file, or both.

```bash
curl https://api.chesly.app/v1/chats/chat_x1R7KTsNtH88aWCJvUyo/messages \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -H "Idempotency-Key: 8d4faeef-90bb-4b3a-8760-de2fde14c267" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{"text": "Landed safe! Calling you tonight"}
EOF
```

The body comes from a quoted heredoc, so the shell leaves the text alone: inside double quotes it would turn `$20` into `0` and run backticks and `$(…)`. The heredoc holds JSON, so the text is escaped as JSON (`\"`, `\n`). In code, build the body with a JSON library, never by pasting text into a string.

The answer, `201`, is the message, its delivery `queued`:

```json
{
  "id": "msg_x1R7KTsNtH88aWCJvUyo.JFp5TUlnekJnT3RVZ2RMdHgtbTZwLWNWWGtyazNSamdfRXVPOUNuR3dJdDg",
  "chat_id": "chat_x1R7KTsNtH88aWCJvUyo",
  "sender": { "name": "Sam Reyes", "is_me": true },
  "text": "Landed safe! Calling you tonight",
  "truncated": false,
  "type": "text",
  "media": null,
  "sent_at": "2026-10-27T09:52:31.204Z",
  "edited": false,
  "deleted": false,
  "reply_to": null,
  "delivery": { "status": "queued", "error": null, "updated_at": "2026-10-27T09:52:31.236Z" }
}
```

- `delivery.status` moves on to `sent`, which is success: most networks stop at `sent`, and `delivered` comes only where the network reports it. Or it moves to `failed`, with `delivery.error`: a `code`, a `message`, and `certain`.
- `network_rejected`, `not_logged_in`, `rate_limited_by_network` and `unsupported` are certain and final. `timeout` and `unknown` are uncertain: the message may have been delivered, so don't resend. Read the chat, or wait for a second `message.delivery_failed` with `certain: true`, after which a resend is safe.
- `GET /v1/messages/{message_id}` shows where a message is, and a failure is also a `message.delivery_failed` event. Messages sent through the API in the last 30 days carry `delivery`; every other message has `delivery: null`.
- Text limits, in UTF-16 code units: Instagram 1,000; Discord 2,000; Telegram 4,096; LINE 5,000; email 100,000; every other network 10,000. Longer is `400` `text_too_long`, and a NUL character is `400` `invalid_request`.
- Refused: a message request (`409` `message_request`), a chat Chesly can't send to (`400` `unsupported_chat`), a `reply_to` from another chat (`400` `invalid_reply_to`), a send over the limit (`429` `send_limit_reached`), and any send while Chesly pauses a network (`503` `network_unavailable`).
- A send to an email chat is a reply: it goes to everyone on the message it answers (`reply_to`, or else the newest message from someone else), with "Re:" and the thread's subject. It takes text and one file, as its attachment, of at most 25 MB (25,000,000 bytes), as email providers refuse bigger ones: over that is `400` `media_too_large`, and a kind of file the Chesly apps never email, such as a program or a script, is `400` `invalid_request`. A disconnected email account is `409` `account_reconnect_required`, an account that can't send mail, such as a Microsoft 365 account whose organization turned sending off, is `400` `unsupported_chat`, and an email provider that refuses the message is `502` `email_send_failed`.
- An email the mail server took for only some of its recipients is `sent`, with `delivery.error` `some_recipients_rejected` (`certain: true`): it reached everyone else. Who was refused isn't told.

## Files

A message carries at most one file: `type` says what it is (`image`, `video`, `audio` or `file`), and `media` has its `id`, `mime_type` and `file_name`. An email lists its files in `email.attachments` instead, each with an `id` (`media_…`), `file_name`, `mime_type` and `size` in bytes as the email declares it (0 when it doesn't say); images its body shows are left out.

### Download

`GET /v1/media/{media_id}` answers the file's bytes, for a message's `media.id` or an attachment's `id`. An unknown ID is `404` `media_not_found`, and a file no longer stored is `410` `media_expired`.

### Send

A send carries one file, given one of two ways (both at once is `400` `invalid_request`):

- `media_id`: a file uploaded with `POST /v1/media` (below), or any message's `media.id` or an email attachment's `id`, which forwards that file with no download or upload. An unknown one is `404` `media_not_found`.
- `file_url`: a public `https://` URL, which Chesly fetches and sends, following up to 3 redirects, at most 50 MB (50,000,000 bytes) within 60 s. `file_name` names the file; without it, Chesly uses the name its server gives, else the URL's last path segment. A URL that isn't `https://`, carries a user name or password, or points to a private address is `400` `file_url_invalid`: Chesly never fetches from a private network. A fetch that fails, such as an answer other than `200`, an empty file or a server too slow, is `422` `file_fetch_failed`, whose `detail` names the status but never the URL. With an `Idempotency-Key`, the URL is fetched once however often the send is retried.

```bash
curl https://api.chesly.app/v1/chats/chat_x1R7KTsNtH88aWCJvUyo/messages \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -H "Idempotency-Key: 3f1b7c52-6a0e-4d49-9a57-1d2c8e4b7f10" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{"text": "The menu for tonight", "file_url": "https://example.com/menu.pdf", "file_name": "menu.pdf"}
EOF
```

Any `text` is the file's caption, or an email's body. One file a message, of at most 50 MB (50,000,000 bytes), or 25 MB to email; a bigger one is `400` `media_too_large`.

### Upload (Wave 2)

```bash
curl https://api.chesly.app/v1/media \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -F "file=@report.pdf"
```

The answer, `201`, is `{ "id": "media_…", "mime_type": "application/pdf", "size": 48213, "file_name": "report.pdf" }`. Send it as `media_id` within 24 hours.

A too-slow upload (under 50 KB/s after 10 s, or not finished within 60 s) answers `408` `upload_timeout`, and the account's uploads are then held for 60 s (`429` `rate_limited`): wait about 60 s and send again, or send a smaller file on a slow connection.

### One-time links

The MCP tools `get_media` and `create_upload` hand an agent links it uses without a key: the link itself is the credential.

- `GET /v1/downloads/{token}`, from `get_media`'s `download_url`: the file, as an attachment, any number of times for 15 minutes.
- `PUT /v1/uploads/{token}`, from `create_upload`'s `upload_url`: the request body is the file (`curl -sS -T <path> '<upload_url>'`), at most 50 MB (50,000,000 bytes), once within 15 minutes. It answers `201` with the upload's JSON, whose `id` goes in `media_id` within 24 hours.
- A link that is unknown, used or expired is `404` `link_not_found`: ask for a new one. Each address may use 300 download links and 60 upload links a minute (`429` `rate_limited`).
- A link keeps working until it expires even if the key that made it is revoked: 15 minutes at most. Keep links out of chats and logs, as you would a key.

## Editing and deleting

`PATCH /v1/messages/{message_id}` changes the text of a message the user sent, and `DELETE /v1/messages/{message_id}` deletes one, for everyone in the chat. Both need a full-access key: a read-only key gets `403` `insufficient_scope`.

- Only the user's own messages (`sender.is_me` is true). A delete takes any of them, including one sent in the network's own app, such as WhatsApp on their phone. An edit takes only one sent from Chesly: its apps or the API. One sent in the network's own app is refused, as Chesly can't change its text on the network.
- An edit takes text messages only: not photos, videos, files, voice notes, stickers, locations, polls or calls, and not a deleted message.
- Email takes neither: an email can't be edited or unsent.

Each network's time limits apply. Past them the API refuses instead of pretending, because the network would keep showing the old message:

| Network | Edit | Delete for everyone |
|---|---|---|
| WhatsApp | 15 minutes | 2 days |
| Signal | 24 hours, at most 10 edits | 24 hours |
| Telegram | 48 hours | no limit |
| Instagram | 15 minutes | no limit |
| Messenger | 15 minutes | 10 minutes |
| Google Messages | 15 minutes | 15 minutes |
| LinkedIn | 1 hour | 1 hour |
| iMessage | 15 minutes, at most 5 edits | 2 minutes |
| Discord, Slack, Google Chat, TikTok | no limit | no limit |
| X | no limit | not possible (X keeps it for the other person) |
| OpenAI Dots | no limit | not possible |
| WeChat | not possible | 2 minutes |
| LINE | not possible | 24 hours |
| Snapchat, Reddit | not possible | no limit |
| Grok Bot, Muse | not possible | not possible |

```bash
curl -X PATCH https://api.chesly.app/v1/messages/<msg_id> \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{"text": "Landed safe! Calling you at 8"}
EOF

curl -X DELETE https://api.chesly.app/v1/messages/<msg_id> \
  -H "Authorization: Bearer $CHESLY_API_KEY"
```

- The body is `{"text": "…"}` and nothing else: an unknown field is `400` `invalid_request`. The text follows a send's rules: blank text is `400` `invalid_request`, and text over the network's cap is `400` `text_too_long` (in UTF-16 code units: Instagram 1,000; Discord 2,000; Telegram 4,096; every other network 10,000). Like a send's, it comes from a quoted heredoc or a JSON library, never pasted into a string.
- An edit answers `200` with the message, as `GET /v1/messages/{message_id}` answers it, with the new `text` and `edited: true`. A delete answers `204`, with no body. A deleted message can't be brought back.
- Both are safe to retry and take no `Idempotency-Key` (an edit ignores one): an edit to the text the message already has sends nothing new and answers the message, and a delete of a deleted message answers `204` again.
- A refused edit is `409` `message_not_editable`, and a refused delete `409` `message_not_deletable`. The `detail` says why: not the user's, not sent from Chesly (an edit), not text, deleted, email, a network that takes none, or past the network's time limit, which it names. Don't retry: tell the user.
- Also refused: a chat that is a message request (`409` `message_request`), and any edit or delete while Chesly pauses a network (`503` `network_unavailable`).
- An account may edit or delete as many messages an hour as it may send: 60 on WhatsApp, 30 elsewhere. Past that, `429` `rate_limited` with `Retry-After`.
- An edit reaches the event stream and webhooks as `message.edited`, and a delete as `message.deleted`.

## Contacts and transcripts (Wave 2)

- `GET /v1/contacts?q=<name>` finds the people the user has direct chats with, on every network: `q` is 1 to 100 characters, `limit` 1 to 50 (default 20). Each contact has `id` (`contact_…`), `name`, `network`, `account_id` and `chat_id`, the direct chat to send to. No phone numbers or handles.
- `POST /v1/messages/{message_id}/transcript` answers `{ message_id, text, language, duration_seconds, cached }`. It needs a full-access key and uses the plan's transcription minutes: `plan.transcription_seconds_this_period` of `plan.transcription_seconds_included` in `GET /v1/me`. The same voice note again uses none (`cached` is true). A message that isn't a voice note is `400` `not_a_voice_note`; while transcription is down, `503` `transcription_unavailable`.
- Past the period's minutes on Personal or Pro, it is `402` `transcription_limit_reached` until the next period: tell the user they come back then, or that Pro has 3,000 minutes. Starter has no transcription (`plan.transcription_seconds_included` is 0), so even the first voice note gets it: tell the user transcription needs Personal or Pro. Don't retry.

## Limits

| Limit | Value |
|---|---|
| Requests, per key and for all of a user's keys together | The plan's: `limits.requests_per_second` and `limits.requests_per_minute` |
| Since-feed pages (`GET /v1/messages?since=`) | 30 a minute, per user (Wave 2) |
| Searches, catch-ups | 30 a minute each, per user |
| Sends on WhatsApp | 60 an hour and 250 a day, per account |
| Sends on every other network, email included | 30 an hour and 150 a day, per account |
| Files | One per message, up to 50 MB (50,000,000 bytes), or 25 MB (25,000,000 bytes) to email |
| Live streams | The plan's: `limits.event_streams` |
| Webhooks | The plan's: `limits.webhooks` |
| Active keys | Up to 100 on every plan (`limits.api_keys`) |

Past a limit: `429` with `Retry-After`. More keys separate agents, but never add requests: a user's keys share the plan's limit. `GET /v1/me` has the plan's numbers in `limits`, and each account's sends so far (`limits.sends`: `per_hour`, `per_day`, `used_last_hour`, `used_last_day`). Every answer carries `RateLimit` and `RateLimit-Policy` headers.

## Plans and billing

Three flat plans, with the same API: reads, sends, events, webhooks, the CLI and MCP, on every connected account. They differ in limits and support:

| | Starter | Personal | Pro |
|---|---|---|---|
| Price | $20 a month | $49 a month | $199 a month |
| Transcription a period | none | 600 minutes | 3,000 minutes |
| Webhooks | 5 | 25 | 100 |
| Requests, per key and for all of a user's keys together | 5 a second, 300 a minute | 15 a second, 900 a minute | 30 a second, 1,800 a minute |
| Live event streams per user | 2 | 10 | 25 |
| Event history | 1 day | 7 days | 30 days |
| Support | email | email | priority email |
| Includes | no Chesly app plan | Chesly Plus | Chesly Max |
| Connected accounts (app caps) | 5, one per app (the free app's) | 10, up to 3 per app (Plus's) | 50, up to 10 per app |

Every plan allows up to 100 active API keys: a cap against runaway scripts, not a plan difference, since a user's keys share the request limits.

- Calls are counted, never billed: `plan.calls_this_period` in `GET /v1/me` shows them.
- `plan` in `GET /v1/me` says which plan it is (`starter`, `personal` or `pro`), its status and its period, and `limits` has its numbers. Read them rather than assume.
- Each plan starts with a 7-day trial, with a card and the plan's full limits.
- An upgrade applies at once. A downgrade applies at the end of the billing period, so its lower limits start then; until then `plan.scheduled_change` shows it (`{ plan, at }`, or `null` when nothing is waiting). A downgrade deletes nothing, but a new key or webhook past the plan's limit is refused (`key_limit_reached`, `webhook_limit_reached`).
- `402` `api_plan_required` means there is no plan. The user buys, switches and manages it at https://web.chesly.app/api/billing.

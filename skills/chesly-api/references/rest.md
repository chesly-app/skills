# The REST API

The base URL is `https://api.chesly.app/v1`. The OpenAPI 3.1 document, generated from the code that runs the API, is at https://api.chesly.app/v1/openapi.json.

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
- [Files (Wave 2)](#files-wave-2)
- [Contacts and transcripts (Wave 2)](#contacts-and-transcripts-wave-2)
- [Limits](#limits)
- [Calls and billing](#calls-and-billing)

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
| `GET /v1/me` | The key, the plan, usage this period and the limits, with each account's send limits. |
| `GET /v1/accounts` | The connected accounts: `id`, `network`, `display_name`, `status` (`connected`, `disconnected` or `needs_attention`) and `connected_at`. |
| `GET /v1/chats` | Chats, pinned first, then the newest: `account_id`, `unread`, `archived` (`true`, `false` or `all`), `q` (a name), `sort` (`recent` or `unread`), `limit`, `cursor`. |
| `GET /v1/chats/{chat_id}` | One chat. |
| `GET /v1/chats/{chat_id}/messages` | A chat's messages, newest first: `limit`, `cursor`. |
| `POST /v1/chats/{chat_id}/read` | Marks a chat read, as the apps do, and answers `{ read: true, receipt_sent }`. A message request is marked read with no receipt. |
| `GET /v1/messages/{message_id}` | One message, with its `delivery` when it was sent through the API. |
| `GET /v1/messages/search` | Messages that match `q` (at most 200 characters), newest first: `chat_id`, `account_id`, `limit` (1 to 100, default 20). Each hit is a message plus `chat_name` and `network`. |
| `GET /v1/messages` | Everything new across the chats since `since`, a page at a time: `limit` (1 to 200, default 100), `cursor`. It answers `messages`, `next_cursor` and `until`; the next walk starts at `since=<until>`. |
| `GET /v1/catch_up` | The unread chats that aren't muted or archived, each with its newest messages, in one call: `chats` (1 to 50, default 20), `per_chat` (1 to 20, default 5). |
| `GET /v1/media/{media_id}` | The bytes of a message's media (`media.id`), up to 50 MB. |
| `POST /v1/chats/{chat_id}/messages` | Sends a message. See [Sending](#sending-wave-2). (Wave 2) |
| `POST /v1/media` | Uploads a file to send. See [Files](#files-wave-2). (Wave 2) |
| `GET /v1/contacts` | The people of the user's direct chats, by name. (Wave 2) |
| `POST /v1/messages/{message_id}/transcript` | A voice note as text. (Wave 2) |
| `GET /v1/events`, `GET /v1/events/stream` | The event log, polled or streamed: [events-and-webhooks.md](events-and-webhooks.md). (Wave 2) |
| `GET /v1/webhooks`, `POST /v1/webhooks`, `GET /v1/webhooks/{id}`, `PATCH /v1/webhooks/{id}`, `DELETE /v1/webhooks/{id}` | Webhooks: [events-and-webhooks.md](events-and-webhooks.md#webhooks). (Wave 2) |
| `POST /v1/webhooks/{id}/rotate_secret`, `POST /v1/webhooks/{id}/test`, `GET /v1/webhooks/{id}/deliveries` | A webhook's new secret, a test delivery, and its delivery log. (Wave 2) |
| `GET /v1/keys`, `DELETE /v1/keys/{key_id}` | The user's API keys, and revoking one. (Wave 2) |
| `GET /v1/openapi.json` | The OpenAPI document, without a key. (Wave 2) |

A chat has `id`, `account_id`, `network`, `name`, `type` (`dm` or `group`), `unread_count`, `last_message_at`, `is_archived`, `is_pinned`, `is_muted`, `is_message_request` and `member_count`. A message has `id`, `chat_id`, `sender` (`name`, `is_me`), `text`, `truncated`, `type` (`text`, `image`, `video`, `audio`, `file` or `other`), `media` (`id`, `mime_type`, `file_name`), `sent_at`, `edited`, `deleted`, `reply_to` and `delivery`. Text is cut at 4,000 UTF-16 code units, and `truncated` says so.

## Pages

- Lists page with opaque cursors: pass `limit` (1 to 100, default 50) and the page before's `next_cursor` as `cursor`. The last page's `next_cursor` is null.
- `GET /v1/messages?since=` takes up to 200 a page (default 100). Search answers one page.
- A cursor that isn't one, or has expired, is `400` `invalid_cursor`: start again without it.
- Unknown query parameters are refused (`400` `invalid_request`), so a misspelt filter can't widen the answer.

## Filters, networks and email (Wave 2)

- `network` keeps `GET /v1/chats`, `GET /v1/catch_up`, `GET /v1/messages?since=` and `GET /v1/messages/search` to one network. The names: `whatsapp`, `imessage`, `instagram`, `messenger`, `telegram`, `signal`, `discord`, `slack`, `linkedin`, `twitter` (X), `gmessages` (Google Messages), `googlechat` (Google Chat), `reddit` and `email`.
- Email is opt-in: those lists leave it out unless `network=email`, or `account_id` names an email account. An email chat or message is always reachable by its ID. An email thread's `name` is its subject, and an email message also has `email` (`subject`, `from`, `to`, `cc`).
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
  "detail": "This API key made more than 600 requests in one minute. Retry in 4 s.",
  "code": "rate_limited",
  "request_id": "571d003e-ad60-4a08-858a-b7b5353f39db",
  "retry_after": 4
}
```

- Branch on `code`. `type` is `https://agents.chesly.app/docs/errors#<code>`, that code's entry, and https://agents.chesly.app/docs/errors lists them all.
- `title` is fixed per code; `detail` explains this occurrence. `request_id` is what support looks up.
- A `400` from bad parameters lists each problem in `errors`, with its `detail` and `pointer`.
- A `429` or `503` carries `Retry-After` and `retry_after`, in seconds. A `503` `upstream_unavailable` is temporary: retry it.
- Codes to expect: `invalid_api_key` (401), `insufficient_scope` (403), `chat_not_found` and `message_not_found` (404), `rate_limited` and `send_limit_reached` (429), `api_plan_required` and `spend_limit_reached` (402), `upstream_unavailable` (503).

## Idempotency (Wave 2)

- Every `POST` under `/v1` takes an `Idempotency-Key` header: 1 to 255 characters of letters, digits, `.`, `_`, `:` and `-`, such as a UUID. Chesly keeps it 24 hours.
- The same key again gets the first answer back, with `Idempotent-Replayed: true`.
- The same key with a different request is `422` `idempotency_key_reused`. While the first request still runs, it is `409` `idempotency_in_progress` with `Retry-After: 1`.
- A `5xx` or `429` answer isn't kept: a retry with the same key runs again, and a send keeps its identity, so it still goes out only once.
- `POST /v1/media` ignores the key: an upload changes nothing on its own.
- The key is optional. Send one on every `POST` anyway, and reuse it on each retry of that request.

## Sending (Wave 2)

`POST /v1/chats/{chat_id}/messages` takes JSON with `text`, `reply_to` (a message ID in the same chat) and `media_id` (from `POST /v1/media`): at least one of `text` and `media_id`.

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

- `delivery.status` moves on to `sent` and `delivered`, or to `failed` with `delivery.error`: a `code` (`network_rejected`, `not_logged_in`, `rate_limited_by_network`, `unsupported`, `timeout` or `unknown`), a `message`, and `certain`. When `certain` is false, the message may have gone out anyway: check the chat before you send it again.
- `GET /v1/messages/{message_id}` shows where a message is, and a failure is also a `message.delivery_failed` event. Messages sent through the API in the last 30 days carry `delivery`; every other message has `delivery: null`.
- Text limits, in UTF-16 code units: Instagram 1,000; Discord 2,000; Telegram 4,096; email 100,000; every other network 10,000. Longer is `400` `text_too_long`, and a NUL character is `400` `invalid_request`.
- Refused: a message request (`409` `message_request`), a chat Chesly can't send to (`400` `unsupported_chat`), a `reply_to` from another chat (`400` `invalid_reply_to`), a send over the limit (`429` `send_limit_reached`), and any send while Chesly pauses a network (`503` `network_unavailable`).
- Email takes text only; a file is `400` `invalid_request`. The reply goes to everyone on the message it answers (`reply_to`, or else the newest message from someone else), with "Re:" and the thread's subject. A disconnected email account is `409` `account_reconnect_required`, and an email provider that refuses the message is `502` `email_send_failed`.

## Files (Wave 2)

```bash
curl https://api.chesly.app/v1/media \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -F "file=@report.pdf"
```

The answer, `201`, is `{ "id": "media_…", "mime_type": "application/pdf", "size": 48213, "file_name": "report.pdf" }`. Send it as `media_id`, with any `text` as its caption. One file a message, at most 50 MB (`400` `media_too_large`).

## Contacts and transcripts (Wave 2)

- `GET /v1/contacts?q=<name>` finds the people the user has direct chats with, on every network: `q` is 1 to 100 characters, `limit` 1 to 50 (default 20). Each contact has `id` (`contact_…`), `name`, `network`, `account_id` and `chat_id`, the direct chat to send to. No phone numbers or handles.
- `POST /v1/messages/{message_id}/transcript` answers `{ message_id, text, language, duration_seconds, cached }`. It needs a full-access key and costs $0.02 a minute of audio; transcribing the same voice note again costs no minutes (`cached` is true). A message that isn't a voice note is `400` `not_a_voice_note`; while transcription is down, `503` `transcription_unavailable`.

## Limits

| Limit | Value |
|---|---|
| Requests per key | 10 a second and 600 a minute |
| Searches, catch-ups | 30 a minute each, per user |
| Sends on WhatsApp | 60 an hour and 250 a day, per account |
| Sends on every other network, email included | 30 an hour and 150 a day, per account |
| Files | One per message, up to 50 MB |
| Live streams | 5 open at once |
| Webhooks | 10 |
| Keys | 25 |

Past a limit: `429` with `Retry-After`. Every answer carries `RateLimit` and `RateLimit-Policy` headers, and `GET /v1/me` shows each account's sends so far (`limits.sends`: `per_hour`, `per_day`, `used_last_hour`, `used_last_day`).

## Calls and billing

- The plan is $49 a month with 50,000 calls, then $1 per 1,000 calls; voice note transcripts are $0.02 a minute. It starts with a 7-day trial.
- A call is a REST request or an MCP tool call. Free: events, the live stream, webhook deliveries, `GET /v1/openapi.json`, and any `402`, `429` or `5xx` answer.
- A spend limit caps what a month costs beyond the $49: $250 unless the user changes it. At the limit, calls answer `402` `spend_limit_reached`, and `GET /v1/me` keeps answering.
- The user buys and manages the plan at https://web.chesly.app/api/billing.

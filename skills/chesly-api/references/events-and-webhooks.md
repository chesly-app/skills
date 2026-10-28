# Events and webhooks (Wave 2)

Every change to the user's chats lands in one log, kept 4 days and ordered per user. There are three ways to take it, with the same events:

| Way | Best for |
|---|---|
| [Webhooks](#webhooks): Chesly posts each event to your URL, signed | A server that is always up |
| [The live stream](#the-live-stream), `GET /v1/events/stream`: server-sent events | A long-running process |
| [The feed](#the-feed), `GET /v1/events?after=`: a page of events at a time | A cron job, or catching up after downtime |

None of them count as calls, and any key, read-only included, can read them. Creating, changing, rotating, testing or deleting a webhook needs a full-access key. Delivery is at least once: the same event can arrive twice, so skip an `id` you have handled.

## Contents

- [An event](#an-event)
- [The catalog](#the-catalog)
- [The feed](#the-feed)
- [The live stream](#the-live-stream)
- [Webhooks](#webhooks)

## An event

```json
{
  "id": "evt_LOBiK493MDUR1TH599lfcIHZ",
  "type": "message.received",
  "timestamp": "2026-10-27T10:02:07.518Z",
  "data": {
    "message": {
      "id": "msg_UXw90uk2Q0SkBgQdA7uY.JGNXcGE1THJaY3JiMnFwRGIxM3ZjZXBaYS1tbjBEc2l3ZnA5d2Uxek9RVnc",
      "chat_id": "chat_UXw90uk2Q0SkBgQdA7uY",
      "sender": { "name": "Priya Patel", "is_me": false },
      "text": "Got the deck, thank you! Looks great.",
      "truncated": false,
      "type": "text",
      "media": null,
      "sent_at": "2026-10-27T10:02:07.518Z",
      "edited": false,
      "deleted": false,
      "reply_to": null,
      "delivery": null
    },
    "chat": { "id": "chat_UXw90uk2Q0SkBgQdA7uY", "name": "Priya Patel", "network": "slack", "type": "dm" }
  }
}
```

## The catalog

| Type | When | `data` |
|---|---|---|
| `message.received` | Someone sends the user a message | `message`, and `chat` (`id`, `name`, `network`, `type`) |
| `message.sent` | The user sends a message, from any device or the API | The same |
| `message.edited` | A message is edited | The same, with the text after the edit |
| `message.deleted` | A message is deleted | `message_id`, `chat_id` |
| `message.delivery_failed` | A message sent through the API didn't go through | `message_id`, `chat_id`, and `error` (`code`, `message`, `certain`) |
| `chat.created` | The user joins a new chat | `chat` |
| `chat.updated` | A chat is renamed, archived, pinned, muted or left | `chat_id`, `chat` (null once left), and `changes` (`name`, `archived`, `pinned`, `muted`, `left`) |
| `chat.read` | The user reads a chat, on any device | `chat_id`, `last_read_message_id` |
| `account.connected` | An account connects | `account` |
| `account.disconnected` | An account disconnects | `account` |
| `account.needs_attention` | An account needs the user, in the Chesly app | `account` |
| `reaction.added` | A reaction is added to a message | `message_id`, `chat_id`, and `reaction` (`key`, and `sender` with `name` and `is_me`) |
| `reaction.removed` | A reaction is taken back | The same |

Email events (`message.received` and `message.sent`) come only when the filter names `email`.

## The feed

```bash
curl "https://api.chesly.app/v1/events?after=evt_LOBiK493MDUR1TH599lfcIHZ&types=message.received" \
  -H "Authorization: Bearer $CHESLY_API_KEY"
```

- It answers `{ events, next_cursor, has_more }`, oldest first. Without `after`, it starts at the oldest event kept.
- Keep the last event's `id` and pass it as `after` next time: `next_cursor` is that ID, or your `after` when nothing new came. While `has_more` is true, ask again at once.
- Filters: `types` and `networks` (comma-separated), `chat_id`, `account_id`, and `limit` (1 to 100, default 50).
- An `after` that is unknown, or older than 4 days, is `410` `events_expired`: start again without it.

## The live stream

```bash
curl -N https://api.chesly.app/v1/events/stream \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -H "Last-Event-ID: evt_LOBiK493MDUR1TH599lfcIHZ"
```

- Server-sent events: the answer starts with `retry: 3000`, then each event is an `id:` line (`evt_…`), an `event:` line (its type) and a `data:` line (the event's JSON), then a blank line. A `: ping` comment comes every 15 seconds.
- Without `Last-Event-ID` (or `?after=`), it sends new events only. To resume after a drop, reconnect with `Last-Event-ID` set to the last `id` you handled: you get every event after it, once, in order.
- It takes the feed's filters, and an unknown or expired `Last-Event-ID` is `410` `events_expired` before the stream starts.
- A user can keep 5 streams open; a sixth is `429` `too_many_streams`.
- `chesly watch` reads this stream.

## Webhooks

### Create one

```bash
curl https://api.chesly.app/v1/webhooks \
  -H "Authorization: Bearer $CHESLY_API_KEY" \
  -H "Idempotency-Key: 6e9865aa-b31e-43b1-9a29-57e5a7ff4b6b" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/hooks/chesly", "event_types": ["message.received"]}'
```

The `201` answer is the webhook with its `secret` (`whsec_…`), shown only this once: keep it with your server's other secrets. `chesly webhooks create https://example.com/hooks/chesly --types message.received --json` does the same.

- `url`: `https://` only, at most 2,048 characters, with no user name or password, on a host that resolves to a public address. Chesly checks when you create it and on every delivery; anything else is `400` `invalid_webhook_url`.
- `event_types`: the events to send. Empty or left out: every event.
- `networks`: the networks. Empty or left out: every network but email.
- `payload`: `full` (the default) or `ids`, where `data` holds only the event's IDs (`message_id`, `chat_id`, `account_id`) and your code fetches the rest with its key. Use `ids` when message text shouldn't pass through the service that receives your webhooks.
- `description`: a note for you.
- At most 10 webhooks; the eleventh is `400` `webhook_limit_reached`.

`PATCH /v1/webhooks/{id}` changes any of those, and `{"enabled": false}` or `{"enabled": true}` turns the webhook off or on. `DELETE /v1/webhooks/{id}` removes it and drops its pending deliveries. `GET /v1/webhooks` lists them, never with their secrets.

### The request

Each delivery is a `POST` to your URL with `Content-Type: application/json`, `User-Agent: Chesly-Webhooks/1.0`, the event's JSON as its body, and the Standard Webhooks headers:

| Header | Value |
|---|---|
| `webhook-id` | The event's `id`, the same on every retry of it |
| `webhook-timestamp` | When this attempt was signed, in Unix seconds |
| `webhook-signature` | `v1,` and the base64 HMAC-SHA256 of `<webhook-id>.<webhook-timestamp>.<body>`, keyed with the secret. For 24 hours after a rotation there are two, separated by a space. |

### Verify it

Check every delivery against the raw body as it arrived, before you parse it. A Standard Webhooks library does the check, takes the secret with its `whsec_` prefix, and refuses a timestamp more than 5 minutes off, so an old delivery can't be replayed.

TypeScript, with `npm install standardwebhooks`:

```ts
import { Webhook } from "standardwebhooks";

const webhook = new Webhook(process.env.CHESLY_WEBHOOK_SECRET!); // whsec_…

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  let event: { id: string; type: string; data: Record<string, unknown> };
  try {
    event = webhook.verify(body, Object.fromEntries(request.headers)) as typeof event;
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  // Handle event.id once, then answer quickly: do slow work after the 2xx.
  return new Response(null, { status: 204 });
}
```

Python, with `pip install standardwebhooks`:

```python
import os
from flask import Flask, request
from standardwebhooks import Webhook, WebhookVerificationError

app = Flask(__name__)
webhook = Webhook(os.environ["CHESLY_WEBHOOK_SECRET"])  # whsec_…

@app.post("/hooks/chesly")
def chesly_webhook():
    try:
        event = webhook.verify(request.get_data(), dict(request.headers))
    except WebhookVerificationError:
        return "invalid signature", 400
    # Handle event["id"] once, then answer quickly.
    return "", 204
```

### Retries

Any `2xx` within 15 seconds is a success. Anything else is a failure: another status, no answer in time, or a redirect, which Chesly never follows. After a failure, Chesly tries again in 5 seconds, then 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours and 10 hours: 8 attempts over about 28 hours. Waits of 5 minutes or more vary by up to 10%. When you answer `429`, `502`, `503` or `504` with a longer `Retry-After`, Chesly waits that long instead, up to 10 hours.

A retried event can arrive after newer ones: order events by `timestamp`, and skip a `webhook-id` you have handled.

### When a webhook turns off

- A `410` answer turns it off at once (`disabled_reason` `gone`).
- Failing for 3 days turns it off (`failing`); any `2xx` in between starts the count again.
- While it is off, its pending deliveries are dropped. `PATCH` it with `{"enabled": true}` to turn it back on.
- While the account has no API plan, deliveries are dropped instead of sent.

### Rotate, test and debug

- `POST /v1/webhooks/{id}/rotate_secret` answers `{ secret, previous_secret_expires_at }`. For the next 24 hours each delivery is signed with both secrets, so you can switch your server over without missing one.
- `POST /v1/webhooks/{id}/test` answers `202` with `{ delivery_id }` and sends a test delivery now; its `webhook-id` starts with `evt_test_`.
- `GET /v1/webhooks/{id}/deliveries` lists the recent deliveries: each one's `status` (`pending`, `succeeded`, `failed` or `discarded`), `attempts`, `last_status_code`, `last_error` and `last_response_excerpt` (the first 1,024 characters of your answer). `?status=failed` keeps the failures.
- The `chesly webhooks` commands do all of this from a terminal.

# chesly commands

`chesly --help` and `chesly <command> --help` describe every command. Every command also takes `--json`, which prints the API's JSON as it is (the default when the output is piped), and `--help`. Nothing ever prompts.

Rows marked (Wave 2) arrive with the Chesly API's second wave, in CLI 0.2.

## Contents

- [Signing in](#signing-in)
- [Reading](#reading)
- [Chat names](#chat-names)
- [Sending](#sending)
- [Watching](#watching)
- [Webhooks](#webhooks)
- [Keys and usage](#keys-and-usage)
- [Network names](#network-names)
- [Exit codes](#exit-codes)
- [Errors](#errors)
- [Environment](#environment)

## Signing in

| Command | What it does |
|---|---|
| `chesly login --no-wait` | Starts a sign-in and exits 0 at once. It prints `{"status":"pending","verification_uri_complete":"…","user_code":"…","expires_in":600}` on standard output, and opens the browser on the link where one can show. (Wave 2) |
| `chesly login --wait` | Finishes that sign-in: waits until the user approves the code, stores the key, and prints `{"status":"signed_in",…}`. Cut short (Ctrl+C, a tool's time limit), it can run again. (Wave 2) |
| `chesly login` | Both steps in one, for a person at a terminal: prints the link and the code, opens the browser where it can, and waits for the approval. |
| `chesly login --no-browser` | Signs in without opening a browser, to approve on another device. (Wave 2) |
| `chesly login --force` | Signs in with a new key even though the stored one still works. Without it, `chesly login` says "Already signed in" (`already_signed_in`) and makes no new key. (Wave 2) |
| `chesly login --key -` | Reads a key the user already has from standard input, checks it, then stores it. (Wave 2) |
| `chesly logout` | Revokes the stored key, so it stops working everywhere, then removes it from this computer. Offline, or with a read-only key, it still signs out, and says the key is still active. (Wave 2) |
| `chesly whoami` | The key in use: its name, scope (`full` or `read`), API version, limits and usage. |
| `chesly key [--reveal]` | The key in use, masked. `--reveal` prints the whole key and nothing else, for MCP clients. |

Never put a key itself on a command line: the process list and shell history keep it. On a server or in CI, the user sets `CHESLY_API_KEY` instead (it wins over the stored key), or pipes the key to `chesly login --key -`.

The key goes to the OS keychain, or to `~/.config/chesly/credentials.json` (mode 0600) where there is no keychain. A pending sign-in waits in `~/.config/chesly/pending-login.json` until `--wait` finishes it or the code expires, 10 minutes later; `--wait` then fails with `expired_token`, and a new `--no-wait` starts over. A denied sign-in fails with `access_denied`. Each sign-in makes a new key, and an account can have 25.

A read-only key (scope `read`) can read, search and watch, but not send.

## Reading

| Command | What it does |
|---|---|
| `chesly accounts` | The connected accounts: each one's `id` (`acct_…`), `network`, `display_name` and `status` (`connected`, `disconnected` or `needs_attention`). |
| `chesly chats [--unread] [--account <acct_id>] [--limit <n>] [--cursor <cursor>]` | Chats, pinned first, then the most recent. `--limit` is 1 to 100 (default 50). |
| `chesly read <chat> [--limit <n>] [--cursor <cursor>]` | A chat's messages, newest first in JSON. `--limit` is 1 to 100 (default 50). |
| `chesly search <query> [--chat <chat>] [--limit <n>]` | Messages that match, newest first, in every chat or one. Each result also has `chat_name` and `network`. The query is at most 200 characters; `--limit` is 1 to 100 (default 20). |
| `chesly catchup [--chats <n>] [--per-chat <n>]` | Unread chats that aren't muted or archived, newest first, each with its newest messages: `--chats` 1 to 50 (default 20), `--per-chat` 1 to 20 (default 5). `truncated` is true when some text was left out to keep the answer short. |
| `chesly chats --network <name>`, `chesly catchup --network <name>`, `chesly search <query> --network <name>` | Only that network. These lists leave email out unless the network is `email`. (Wave 2) |
| `chesly read <chat> --network <name>` | Looks the chat name up on that network only, such as an email thread by its subject. (Wave 2) |

A chat has `id`, `account_id`, `network`, `name`, `type` (`dm` or `group`), `unread_count`, `last_message_at`, `is_archived`, `is_pinned`, `is_muted`, `is_message_request` and `member_count`.

A message has `id` (`msg_…`), `chat_id`, `sender` (`name`, `is_me`), `text`, `truncated`, `type` (`text`, `image`, `video`, `audio`, `file` or `other`), `media`, `sent_at`, `edited`, `deleted`, `reply_to` and `delivery`. Text is cut at 4,000 characters, and `truncated` says so. An email message also has `email` (`subject`, `from`, `to`, `cc`).

When there is more, the JSON has a `next_cursor`, and the same command with `--cursor <next_cursor>` gets the next page (older messages, for `read`).

## Chat names

A `<chat>` is a chat ID (`chat_…`) or a name, looked up across the user's chats, archived ones included:

- an exact name wins, in any case (`mom` finds "Mom");
- otherwise, the only partial match wins ("book" finds "Mom's book club");
- no match exits 4 with `chat_not_found`;
- several matches exit 4 with `ambiguous_chat` and `candidates`: the chats it could mean, each with its `id`. Run the command again with one of those IDs.

Names are looked up among chat networks only. To find an email thread by its subject, add `--network email`.

## Sending

| Command | What it does |
|---|---|
| `chesly send <chat> [<text>] [--reply-to <msg_id>] [--file <path>] [--wait] [--idempotency-key <key>]` | Sends a message, from the user's own account, to a chat they already have. (Wave 2) |
| `chesly send <chat> <text> --network <name>` | Looks the chat name up on that network first: `--network email` answers an email thread. (Wave 2) |

- A `<text>` of `-` reads the text from standard input, which keeps quoting simple: `printf '%s' "$TEXT" | chesly send "Mom" - --json`.
- Text that starts with `-` goes after `--`: `chesly send "Mom" --json -- "-5 degrees here"`.
- `--reply-to <msg_id>` quotes one message of that chat: an `id` from `read`, `catchup` or `search`.
- `--file <path>` attaches one file of at most 50 MB, and the text becomes its caption. Email takes text only.
- The answer is the sent message, its `delivery.status` `queued`. `--wait` waits up to 30 seconds for `sent`, `delivered` or `failed`. A failed delivery exits 1, with the reason in `delivery.error.message`. When `delivery.error.certain` is false, the message may have gone out anyway.
- Every send carries an `Idempotency-Key`, and the CLI's own retries (after a network error, a 502, 503 or 504, or while a first attempt still runs) reuse it, so one command sends at most once. When it gives up without knowing whether the message went out, the error carries the key as `idempotency_key`: run the same command again with `--idempotency-key <that key>`, and the API answers with the first attempt's result instead of sending again.
- Each connected account may send 60 messages an hour and 250 a day on WhatsApp, and 30 an hour and 150 a day on every other network, email included. Over a limit, the send exits 5 with `send_limit_reached` and `retry_after`.
- Text limits, in UTF-16 code units: Instagram 1,000; Discord 2,000; Telegram 4,096; email 100,000; every other network 10,000. Longer text is refused with `text_too_long`.
- Also refused: a message request (`message_request`), a chat Chesly can't send to (`unsupported_chat`), a `--reply-to` from another chat (`invalid_reply_to`), and any send with a read-only key (`insufficient_scope`).
- An email reply goes to everyone on the message it answers (by default the newest one from someone else), with "Re:" and the thread's subject.

## Watching

| Command | What it does |
|---|---|
| `chesly watch [--chat <chat>] [--account <acct_id>] [--types <a,b>] [--networks <a,b>] [--after <evt_id>]` | Streams the user's events as they happen, one JSON object a line, until stopped. (Wave 2) |

- Each line is an event: `id` (`evt_…`), `type`, `timestamp` and `data`.
- The types: `message.received`, `message.sent` (the user's own, from any device), `message.edited`, `message.deleted`, `message.delivery_failed`, `chat.created`, `chat.updated`, `chat.read`, `account.connected`, `account.disconnected`, `account.needs_attention`, `reaction.added` and `reaction.removed`.
- For `message.received`, `message.sent` and `message.edited`, `data` holds `message` and `chat` (`id`, `name`, `network`, `type`).
- Without `--after`, the stream starts with new events. It reconnects by itself after a drop and resumes after the last event it printed. To resume after a restart, pass `--after` with the last `id` you handled. Events are kept 4 days: an older resume point starts again from new events, with a warning.
- The same event can arrive twice: skip an `id` you have seen.
- Email events come only when `--networks` names `email`.
- At most 5 streams can be open at once; a sixth exits 5 with `too_many_streams`.

## Webhooks

| Command | What it does |
|---|---|
| `chesly webhooks list` | The user's webhooks, without their secrets. (Wave 2) |
| `chesly webhooks create <url> [--types <a,b>] [--networks <a,b>] [--payload <full or ids>] [--description <text>]` | Adds a webhook for an `https://` URL. Its signing secret (`whsec_…`) is printed this once. (Wave 2) |
| `chesly webhooks delete <id>` | Deletes a webhook (`wh_…`). (Wave 2) |
| `chesly webhooks rotate <id>` | Replaces its secret; the old one keeps signing for 24 hours. (Wave 2) |
| `chesly webhooks test <id>` | Sends it a test event now. (Wave 2) |
| `chesly webhooks deliveries <id> [--status <status>] [--limit <n>] [--cursor <cursor>]` | Its recent deliveries: each one's status (`pending`, `succeeded`, `failed` or `discarded`), attempts and the endpoint's answer. (Wave 2) |

Without `--networks`, a webhook gets every network but email. The `chesly-api` skill covers receiving and verifying webhooks.

## Keys and usage

| Command | What it does |
|---|---|
| `chesly keys list` | The user's active API keys: `id`, `name`, `scope`, `prefix`, `last4`, `created_at` and `last_used_at`. (Wave 2) |
| `chesly keys revoke <key_id>` | Revokes a key. Its next request is refused. (Wave 2) |
| `chesly usage` | The plan, this period's calls and estimated cost, and how many messages each account can still send. (Wave 2) |

New keys come from `chesly login`, or from https://web.chesly.app/api/keys. `keys list` marks the key this CLI uses; after revoking that one, run `chesly login` again.

## Network names

`--network` and `--networks` take the API's names: `whatsapp`, `imessage`, `instagram`, `messenger`, `telegram`, `signal`, `discord`, `slack`, `linkedin`, `twitter` (X), `gmessages` (Google Messages), `googlechat` (Google Chat), `reddit` and `email`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | error |
| 2 | usage |
| 3 | not signed in (no key, a malformed one, or the key was rejected) |
| 4 | not found (an unknown chat, webhook or key, or a name that matches no chat), or ambiguous (a name that matches several) |
| 5 | temporary, retry later: rate limited (a 429: too many requests, a send cap, or too many open event streams) or briefly unavailable (a 503). `retry_after` says when, if the answer has it |
| 6 | payment required: the account needs an API plan, or a limit of its plan is reached |

A `400` `invalid_request` also exits 2, as a usage error. A send whose first attempt still runs after the CLI's retries (`409` `idempotency_in_progress`) exits 5, and its error carries the `idempotency_key` to retry with. Those two, exit 5 for a 503, and exit 6 arrive with Wave 2. On exit 6, the user starts the plan, or raises its limit, at https://web.chesly.app/api/billing.

## Errors

In JSON mode, an error is one line on standard error, as problem details:

```json
{"type":"https://agents.chesly.app/docs/errors#rate_limited","title":"Too many requests.","status":429,"detail":"This API key made more than 600 requests in one minute. Retry in 4 s.","code":"rate_limited","request_id":"571d003e-ad60-4a08-858a-b7b5353f39db","retry_after":4}
```

- Branch on `code`. https://agents.chesly.app/docs/errors lists every code.
- The CLI's own errors carry `type`, `title` and `code`, plus fields of their own: `candidates` for an ambiguous chat name, `idempotency_key` for a send that may or may not have gone out.
- An answer that isn't problem details, such as a gateway's 502 during a Chesly deploy, gets a code built from its status: `http_502` and the like, or `http_error`. Run the command again after a few seconds.
- Notices, such as `watch` reconnecting, also go to standard error, one JSON line each: `{"warning":"<code>","message":"…"}`.

## Environment

| Variable | Use |
|---|---|
| `CHESLY_API_KEY` | The key to use instead of the stored one |
| `CHESLY_API_URL` | The API's base URL (default `https://api.chesly.app`) |

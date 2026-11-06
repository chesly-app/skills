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
| `chesly login --wait` | Finishes that sign-in: waits until the user approves the code, stores the key, and prints `{"status":"signed_in",…}`. Cut short (Ctrl+C, a tool's time limit), it can run again; with no sign-in waiting, it fails with `login_not_started`. (Wave 2) |
| `chesly login` | Both steps in one, for a person at a terminal: prints the link and the code, opens the browser where it can, and waits for the approval. |
| `chesly login --no-browser` | Signs in without opening a browser, to approve on another device. (Wave 2) |
| `chesly login --force` | Signs in with a new key even though the stored one still works, and revokes the key it replaces (so does a `--wait` that stores a new key). A plugin or MCP client set up with the old key stops working; if the old key can't be revoked, a `key_still_active` warning names it. Without `--force`, `chesly login` says "Already signed in" (`already_signed_in`) and makes no new key. (Wave 2) |
| `chesly login --key -` | Reads a key the user already has from standard input, checks it, then stores it. (Wave 2) |
| `chesly logout` | Revokes the stored key, so it stops working everywhere, a plugin or MCP client set up with it included, then removes it from this computer. Offline, or with a read-only key, it still signs out, and a `key_still_active` warning names the key to revoke. (Wave 2) |
| `chesly whoami` | The key in use: its name, scope (`full` or `read`), API version, limits and usage. |
| `chesly key` | The key in use, masked. `$(chesly key --reveal)` hands the whole key to another command, such as an MCP client's header. Use `--reveal` only inside `$(…)`: on its own, it prints the key into your transcript. |

Never type or paste a key itself: on a command line, the process list and the shell history keep it. On a server or in CI, the user sets `CHESLY_API_KEY` instead (it wins over the stored key), or pipes the key to `chesly login --key -`.

The key goes to the OS keychain, or to `~/.config/chesly/credentials.json` (mode 0600) where there is no keychain. A pending sign-in waits in `~/.config/chesly/pending-login.json` until `--wait` finishes it or the code expires, 10 minutes later; `--wait` then fails with `expired_token`, and a new `--no-wait` starts over. A denied sign-in fails with `access_denied`. Each sign-in makes a new key, up to 100 active keys on either plan (`limits.api_keys` in `chesly whoami --json`); past it, a new one is refused (`key_limit_reached`).

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

An email read can answer `account_reconnect_required`: the user reconnects that account in the Chesly app. Don't retry.

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
| `chesly send <chat> - [--reply-to <msg_id>] [--file <path>] [--media-id <media_id>] [--wait] [--idempotency-key <key>] <<'EOF'` | Sends a message, from the user's own account, to a chat they already have, with the text from the heredoc that follows. (Wave 2) |
| `chesly send <chat> - --network <name> <<'EOF'` | Looks the chat name up on that network first: `--network email` answers an email thread. (Wave 2) |

- The text comes on standard input, never as an argument: pass `-`, then a quoted heredoc (`<<'EOF'`, the text, then a line `EOF`) or a file (`< reply.txt`). A quoted heredoc keeps the text exactly as written. Inside double quotes on the command line, or typed into a variable, the shell rewrites it: `$20` becomes `0`, and backticks or `$(…)` copied from a message run. If a line of the text is exactly `EOF`, pick another delimiter.

  ```bash
  chesly send chat_7Hq2mR9xLp4vT1sK8nWz - --wait --json <<'EOF'
  Paid the $20, thanks! `Invoice 42` is settled.
  EOF
  ```

- A file alone needs no text: `chesly send <chat_id> --file <path> --wait --json`.
- `--reply-to <msg_id>` quotes one message of that chat: an `id` from `read`, `catchup` or `search`.
- `--file <path>` attaches one file of at most 50 MB (50,000,000 bytes), and the text becomes its caption. A file that can't be read fails with `file_unreadable` before anything is sent. Email takes text only.
- A too-slow upload (under 50 KB/s after 10 s, or not finished within 60 s) exits 5 with `upload_timeout`, and the account's uploads are then held for 60 s (`rate_limited`): wait about 60 s and send again, or send a smaller file on a slow connection.
- `--media-id <media_id>` attaches a file uploaded before, instead of `--file`: it is how a file send that gave up is retried.
- The answer is the sent message, its `delivery.status` `queued`. `--wait` asks once a second, within 30 seconds in all, until it is `sent` (success: most networks stop there), `delivered` (only where the network reports it) or `failed`; each ask counts as a call. A failure the network confirmed exits 1 with `delivery_failed`, the reason in `delivery.error.message`. One it didn't confirm (`delivery.error.certain` false) reads `unconfirmed`: `--wait` keeps asking, and if it stays so, the send exits 5 with `delivery_unconfirmed`. It may have been delivered, so don't resend until a later `message.delivery_failed` with `certain: true` says it wasn't. Once the message went out, it is always printed and the exit is 0, even when following it fails: that is a `delivery_wait_failed` warning, with the `idempotency_key` that asks the API for its answer again.
- Every send carries an `Idempotency-Key`, and the CLI's own retries (after a network error, a 502, 503 or 504, or while a first attempt still runs: 3 tries) reuse it, so one command sends at most once. When it gives up without knowing whether the message went out, the error carries the key as `idempotency_key`: run the same command again, with the same text and `--idempotency-key <that key>`, and the API answers with the first attempt's result instead of sending again. A file send's error also carries its upload as `media_id`: retry with `--media-id <media_id> --idempotency-key <key>`, without `--file`, since a new upload would be another media ID, which the same key refuses (`422` `idempotency_key_reused`).
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
- Without `--after`, the stream starts with new events. It reconnects by itself after a drop and resumes after the last event it printed. To resume after a restart, pass `--after` with the last `id` you handled. Events are kept for the plan's event history (`limits.event_retention_days`: 7 or 30 days); an older resume point gets `410` `events_expired`, and `chesly watch` starts again from now, with an `events_expired` warning.
- The same event can arrive twice: skip an `id` you have seen.
- In a terminal, a `message.delivery_failed` reads "failed" when `certain` is true, else "unconfirmed, it may have been delivered".
- Email events come only when `--networks` names `email`.
- The plan sets how many streams can be open at once (`limits.event_streams`); one more exits 5 with `too_many_streams`.

## Webhooks

| Command | What it does |
|---|---|
| `chesly webhooks list` | The user's webhooks, without their secrets. (Wave 2) |
| `chesly webhooks create <url> [--types <a,b>] [--networks <a,b>] [--payload <full or ids>] [--description <text>] [--idempotency-key <key>]` | Adds a webhook for an `https://` URL. Its signing secret (`whsec_…`) is printed this once. (Wave 2) |
| `chesly webhooks delete <id>` | Deletes a webhook (`wh_…`). (Wave 2) |
| `chesly webhooks rotate <id> [--idempotency-key <key>]` | Replaces its secret; the old one keeps signing for 24 hours. (Wave 2) |
| `chesly webhooks test <id> [--idempotency-key <key>]` | Sends it a test event now. (Wave 2) |
| `chesly webhooks deliveries <id> [--status <status>] [--limit <n>] [--cursor <cursor>]` | Its recent deliveries: each one's status (`pending`, `succeeded`, `failed` or `discarded`), attempts and the endpoint's answer. (Wave 2) |

Without `--networks`, a webhook gets every network but email. The plan sets how many webhooks there can be (`limits.webhooks`). When the plan can't be checked just now, `webhooks create` exits 5 with `plan_unavailable`: wait `retry_after` and try again once or twice. Don't tell the user to upgrade. `create`, `rotate` and `test` do it at most once per `--idempotency-key`, however often the command runs: a retried `rotate` shows the same new secret instead of rotating twice. The `chesly-api` skill covers receiving and verifying webhooks.

## Keys and usage

| Command | What it does |
|---|---|
| `chesly keys list` | The user's active API keys: `id`, `name`, `scope`, `prefix`, `last4`, `created_at` and `last_used_at`. (Wave 2) |
| `chesly keys revoke <key_id>` | Revokes a key. Its next request is refused. (Wave 2) |
| `chesly usage` | The plan and its limits, this period's calls (counted, never billed) and transcription minutes, and how many messages each account can still send. (Wave 2) |

New keys come from `chesly login`, or from https://web.chesly.app/api/keys. `keys list` marks the key this CLI uses; after revoking that one, run `chesly login` again.

## Network names

`--network` and `--networks` take the API's names: `whatsapp`, `imessage`, `instagram`, `messenger`, `telegram`, `signal`, `line`, `discord`, `slack`, `linkedin`, `twitter` (X), `reddit`, `gmessages` (Google Messages), `googlechat` (Google Chat), `grokbot` (Grok Bot), `chatgptdots` (OpenAI Dots), `muse` and `email`. `tiktok` and `wechat` are coming soon: only accounts that can connect them have chats there.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | ok |
| 1 | error |
| 2 | usage |
| 3 | not signed in (no key, a malformed one, or the key was rejected) |
| 4 | not found (an unknown chat, webhook or key, or a name that matches no chat), or ambiguous (a name that matches several) |
| 5 | not final, come back to it: rate limited (a 429: too many requests, a send cap, uploads held after a slow one, or too many open event streams), a request that took too long to arrive (a 408, such as an upload's `upload_timeout`), briefly unavailable (a 502, 503 or 504, from the API or a gateway), a first attempt still running (a 409 `idempotency_in_progress`), or a send the network didn't confirm (`delivery_unconfirmed`: check the chat before you send it again). `retry_after` says when, if the answer has it |
| 6 | payment required: the account needs an API plan, or this period's transcription minutes are used up |

A `400` `invalid_request` also exits 2, as a usage error. A send still running after the CLI's 3 tries carries the `idempotency_key` to retry with. Exit 5 without `retry_after`, such as a gateway's 502 or 504: wait a few seconds, then try again, and give up after a few tries. Exit 2 for a `400`, exit 5 for a 408, 409, 502, 503, 504 or `delivery_unconfirmed`, and exit 6 arrive with Wave 2. On exit 6 with `api_plan_required`, the user starts a plan at https://web.chesly.app/api/billing; with `transcription_limit_reached`, the minutes come back next period, or Pro has 3,000 minutes.

## Errors

In JSON mode, an error is one line on standard error, as problem details:

```json
{"type":"https://agents.chesly.app/docs/errors#rate_limited","title":"Too many requests.","status":429,"detail":"This API key made more than 900 requests in one minute. Retry in 4 s.","code":"rate_limited","request_id":"571d003e-ad60-4a08-858a-b7b5353f39db","retry_after":4}
```

- Branch on `code`. https://agents.chesly.app/docs/errors lists every code.
- The CLI's own errors carry `type`, `title` and `code`, plus fields of their own: `candidates` for an ambiguous chat name; `idempotency_key`, and `media_id` for a file send, for a send that may or may not have gone out; `message_id` and `delivery` for `delivery_failed` and `delivery_unconfirmed`.
- The CLI's own codes: `access_denied`, `ambiguous_chat`, `chat_not_found`, `credentials_file_error`, `delivery_failed`, `delivery_unconfirmed`, `expired_token`, `file_unreadable`, `internal_error`, `invalid_api_url`, `invalid_key_format`, `invalid_response`, `keychain_error`, `keychain_timeout`, `login_not_started`, `media_too_large`, `network_error`, `not_signed_in` and `usage_error`.
- An answer that isn't problem details, such as a gateway's 502 during a Chesly deploy, gets a code built from its status: `http_400`, `http_404`, `http_413`, `http_429`, `http_500`, `http_502`, `http_503` or `http_504`, and `http_error` for any other. A 502, 503 or 504 exits 5: run the command again after a few seconds.
- Warnings never change the exit code. In JSON mode each is one line on standard error, `{"warning":"<code>","message":"…"}`: `delivery_wait_failed` (the message went out, but following its delivery failed), `env_key_set` (`CHESLY_API_KEY` wins over the stored key), `event_too_large` (an event too large to read was skipped), `events_expired` (the resume point is gone, so `watch` starts from now), `invalid_event` (an event the CLI couldn't read was skipped), `key_details_unavailable` (a new key's details didn't load), `key_still_active` (a key this CLI no longer uses wasn't revoked) and `reconnecting` (`watch` is reconnecting).

## Environment

| Variable | Use |
|---|---|
| `CHESLY_API_KEY` | The key to use instead of the stored one |
| `CHESLY_API_URL` | The API's base URL (default `https://api.chesly.app`) |

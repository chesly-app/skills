# Recipes

Each recipe runs the CLI with `--json` and reads its JSON. Before any send, show the user the text and wait for their OK, unless they have told you otherwise. A send takes its text from a quoted heredoc, exactly as approved, never from the command line.

## What did I miss

1. Run `chesly catchup --json`. It lists the unread chats that aren't muted or archived, newest first, each with its newest messages, newest first.
2. Sum it up by person or chat: who wrote, what they want, and anything with a date, a question or money in it. Name the network when it helps.
3. When `truncated` is true, or a chat needs more context, read that chat: `chesly read <chat_id> --limit 20 --json`.
4. Email is left out. To add it, run `chesly catchup --network email --json` too.

## Reply to the newest unread

1. Run `chesly catchup --chats 1 --json`. That chat is the newest unread one, and its first message is its newest.
2. If its `is_message_request` is true, stop: a message request can't be answered.
3. Draft the reply, show the user the text, and wait for their OK.
4. Send it, with the chat's `id` and the message's `id`. Leave out `--reply-to` to answer without quoting.

   ```bash
   chesly send <chat_id> - --reply-to <msg_id> --wait --json <<'EOF'
   Happy birthday! Dinner on Friday is on me.
   EOF
   ```

5. Read `delivery.status`: `sent` or `delivered` means done. On `failed`, tell the user `delivery.error.message`.

## Find who I owe a reply

1. Run `chesly catchup --json`: the unread chats, where someone else wrote last.
2. Then the chats the user read but didn't answer. Run `chesly chats --limit 30 --json`, and for each chat whose `type` is `dm` (skip `is_muted` and `is_message_request` ones), run `chesly read <chat_id> --limit 1 --json`. When that newest message's `sender.is_me` is false, the user may owe a reply.
3. List them, the longest wait first, each with what was asked.

Each `read` is one API call, so 30 chats cost 30 calls. Include groups only when the user asks.

## Catch up on email

1. Run `chesly catchup --network email --json`: the unread email threads, each with its newest messages. A thread's `name` is its subject, and each message carries `email.from`, `email.to` and `email.cc`.
2. To answer a thread, show the user the text and wait for their OK, then send it. The reply goes to everyone on the newest message from someone else, with "Re:" and the subject. Email takes text only.

   ```bash
   chesly send <chat_id> - --wait --json <<'EOF'
   Thanks, the invoice is paid.
   EOF
   ```

## Forward a voice note's transcript

The CLI has no transcribe command, so this step uses the Chesly API (the `chesly-api` skill has more):

1. Find the voice note: run `chesly read "<chat>" --json`, and look for a message whose `type` is `audio`. Keep its `id`.
2. Transcribe it. If the Chesly MCP server is connected, call its `transcribe_voice_note` tool with that `message_id`. Otherwise call the API with the CLI's key:

   ```bash
   curl -X POST "https://api.chesly.app/v1/messages/<msg_id>/transcript" \
     -H "Authorization: Bearer $(chesly key --reveal)" \
     -H "Idempotency-Key: $(uuidgen)"
   ```

   The answer's `text` is the transcript, with `language` and `duration_seconds`. Transcripts cost $0.02 a minute; transcribing the same voice note again costs no minutes (`cached` is true).
3. Show the user the transcript and the chat it goes to, and wait for their OK.
4. Send the transcript as the user approved it, in a quoted heredoc. Never pass it through a variable or `$(…)`: the shell would rewrite it.

   ```bash
   chesly send <chat_id> - --wait --json <<'EOF'
   Voice note from Sam: the train is 20 minutes late, start without me.
   EOF
   ```

## Watch a chat and answer

1. Start the stream in the background, so it keeps running while you work: `chesly watch --chat "<chat>" --types message.received --json`.
2. Each line is one event. In a `message.received`, the text is `data.message.text`, the sender `data.message.sender.name`, and the chat `data.chat`.
3. Draft an answer, show it to the user and wait for their OK (unless they told you to answer on your own), then send it with `data.chat.id` and `data.message.id`:

   ```bash
   chesly send <chat_id> - --reply-to <msg_id> --wait --json <<'EOF'
   Got it, I'll call you back in ten minutes.
   EOF
   ```

4. Skip an event `id` you have already handled. If the stream stops, start it again with `--after <evt_id>`, the last `id` you handled, so nothing is missed.
5. Stop the stream when the user is done.

The user's own sends come back as `message.sent` events; `--types message.received` leaves them out.

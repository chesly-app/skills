// The repo's own checks: what the skills tell an agent must be true of the chesly CLI, the REST API
// and the MCP server. Run with `npm test` (node:test, no dependencies).
//
// The facts below mirror the CLI (`chesly --help`) and the API (its OpenAPI document at
// https://api.chesly.app/v1/openapi.json, and the MCP server's tools/list). When either changes,
// change them here first, then the skills: a skill that names a command, option, exit code,
// endpoint, tool, event type, field or error code the product lacks fails.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------------------------

/**
 * The chesly CLI's commands and options. Each carries the wave that brings it: 1 is the alpha,
 * 2 is the API's Wave 2 (CLI 0.2). A command's own wave also covers a change in what it does:
 * `logout` revokes its key from Wave 2 on, and `--key` reads the key from stdin (`--key -`), the
 * only form a skill shows. Every command also takes GLOBAL_OPTIONS.
 */
const CLI = {
  login: { wave: 1, options: { '--key': 2, '--no-browser': 2, '--no-wait': 2, '--wait': 2, '--force': 2 } },
  logout: { wave: 2, options: {} },
  whoami: { wave: 1, options: {} },
  key: { wave: 1, options: { '--reveal': 1 } },
  accounts: { wave: 1, options: {} },
  chats: { wave: 1, options: { '--unread': 1, '--account': 1, '--limit': 1, '--cursor': 1, '--network': 2 } },
  read: { wave: 1, options: { '--limit': 1, '--cursor': 1, '--network': 2 } },
  search: { wave: 1, options: { '--chat': 1, '--limit': 1, '--network': 2 } },
  catchup: { wave: 1, options: { '--chats': 1, '--per-chat': 1, '--network': 2 } },
  send: {
    wave: 2,
    options: { '--reply-to': 2, '--file': 2, '--media-id': 2, '--wait': 2, '--idempotency-key': 2, '--network': 2 },
  },
  watch: { wave: 2, options: { '--chat': 2, '--account': 2, '--types': 2, '--networks': 2, '--after': 2 } },
  webhooks: {
    wave: 2,
    subcommands: {
      list: {},
      create: { '--types': 2, '--networks': 2, '--payload': 2, '--description': 2, '--idempotency-key': 2 },
      delete: {},
      rotate: { '--idempotency-key': 2 },
      test: { '--idempotency-key': 2 },
      deliveries: { '--status': 2, '--limit': 2, '--cursor': 2 },
    },
  },
  keys: { wave: 2, subcommands: { list: {}, revoke: {} } },
  usage: { wave: 2, options: {} },
};
const GLOBAL_OPTIONS = ['--json', '--help'];
/** What `chesly` takes before a command. */
const TOP_LEVEL_OPTIONS = ['--version', '--help', '--json'];

/** The CLI's exit codes, word for word as the CLI's README has them. */
const EXIT_CODES = [
  '| 0 | ok |',
  '| 1 | error |',
  '| 2 | usage |',
  '| 3 | not signed in (no key, a malformed one, or the key was rejected) |',
  '| 4 | not found (an unknown chat, webhook or key, or a name that matches no chat), or ambiguous (a name that matches several) |',
  '| 5 | not final, come back to it: rate limited (a 429: too many requests, a send cap, uploads held after a slow one, or too many open event streams), a request that took too long to arrive (a 408, such as an upload\'s `upload_timeout`), briefly unavailable (a 502, 503 or 504, from the API or a gateway), a first attempt still running (a 409 `idempotency_in_progress`), or a send the network didn\'t confirm (`delivery_unconfirmed`: check the chat before you send it again). `retry_after` says when, if the answer has it |',
  '| 6 | payment required: the account needs an API plan, or this period\'s transcription minutes are used up |',
];

/** The codes the CLI raises itself, and its warnings, as its errors export lists them (`LOCAL_ERROR_CODES`, `LOCAL_WARNING_CODES`). */
const CLI_ERROR_CODES = ['access_denied', 'ambiguous_chat', 'chat_not_found', 'credentials_file_error', 'delivery_failed',
  'delivery_unconfirmed', 'expired_token', 'file_unreadable', 'internal_error', 'invalid_api_url', 'invalid_key_format', 'invalid_response',
  'keychain_error', 'keychain_timeout', 'login_not_started', 'media_too_large', 'network_error', 'not_signed_in',
  'usage_error', 'http_400', 'http_404', 'http_413', 'http_429', 'http_500', 'http_502', 'http_503', 'http_504',
  'http_error'];
const CLI_WARNING_CODES = ['delivery_wait_failed', 'env_key_set', 'event_too_large', 'events_expired', 'invalid_event',
  'key_details_unavailable', 'key_still_active', 'reconnecting'];

/** The networks, as people name them and as the API does (`network`, `--network`). */
const NETWORK_NAMES = ['WhatsApp', 'iMessage', 'Instagram', 'Messenger', 'Telegram', 'Signal', 'Discord', 'Slack',
  'LinkedIn', 'X', 'Google Messages', 'Google Chat', 'Reddit', 'email'];
const NETWORK_IDS = ['whatsapp', 'imessage', 'instagram', 'messenger', 'telegram', 'signal', 'discord', 'slack',
  'linkedin', 'twitter', 'gmessages', 'googlechat', 'reddit', 'email'];

/** The REST API's endpoints, each with the wave that brings it. */
const ENDPOINTS = {
  'GET /v1/me': 1,
  'GET /v1/accounts': 1,
  'GET /v1/chats': 1,
  'GET /v1/chats/{chat_id}': 1,
  'GET /v1/chats/{chat_id}/messages': 1,
  'POST /v1/chats/{chat_id}/read': 1,
  'GET /v1/messages': 1,
  'GET /v1/messages/search': 1,
  'GET /v1/messages/{message_id}': 1,
  'GET /v1/catch_up': 1,
  'GET /v1/media/{media_id}': 1,
  'POST /v1/media': 2,
  'POST /v1/chats/{chat_id}/messages': 2,
  'GET /v1/events': 2,
  'GET /v1/events/stream': 2,
  'GET /v1/webhooks': 2,
  'POST /v1/webhooks': 2,
  'GET /v1/webhooks/{id}': 2,
  'PATCH /v1/webhooks/{id}': 2,
  'DELETE /v1/webhooks/{id}': 2,
  'POST /v1/webhooks/{id}/rotate_secret': 2,
  'POST /v1/webhooks/{id}/test': 2,
  'GET /v1/webhooks/{id}/deliveries': 2,
  'GET /v1/contacts': 2,
  'POST /v1/messages/{message_id}/transcript': 2,
  'GET /v1/keys': 2,
  'DELETE /v1/keys/{key_id}': 2,
  'GET /v1/openapi.json': 2,
};

/** The MCP server's tools: the wave that brings each, and whether a read-only key sees it. */
const TOOLS = {
  list_accounts: { wave: 1, readKey: true },
  list_chats: { wave: 1, readKey: true },
  catch_up: { wave: 1, readKey: true },
  read_chat: { wave: 1, readKey: true },
  search_messages: { wave: 1, readKey: true },
  get_message: { wave: 1, readKey: true },
  mark_read: { wave: 1, readKey: false },
  send_message: { wave: 2, readKey: false },
  find_contact: { wave: 2, readKey: true },
  transcribe_voice_note: { wave: 2, readKey: false },
};
/** The tools that take a `network` input (Wave 2). */
const NETWORK_INPUT_TOOLS = ['list_chats', 'catch_up', 'search_messages'];
/** Older endpoints and tools whose answers Wave 2 extends: `GET /v1/me`'s plan and send limits, a message's `delivery`. */
const WAVE_2_CONTENT = ['GET /v1/me', 'GET /v1/messages/{message_id}', 'get_message'];
/** The verbs a tool name starts with: a name shaped like one that isn't a tool is a wrong tool name. */
const TOOL_SHAPE = /^(list|get|send|search|read|mark|find|transcribe|catch|create|update|delete|upload|fetch|watch|reply|add|remove)_[a-z_]+$/;

/** The event catalog. */
const EVENT_TYPES = ['message.received', 'message.sent', 'message.edited', 'message.deleted', 'message.delivery_failed',
  'chat.created', 'chat.updated', 'chat.read', 'account.connected', 'account.disconnected', 'account.needs_attention',
  'reaction.added', 'reaction.removed'];

/**
 * Every snake_case name a skill may write: the tools and their inputs, query parameters, the
 * fields of the API's answers and events, error codes, and the settings of the clients the MCP
 * setup covers.
 */
const API_NAMES = new Set([
  ...Object.keys(TOOLS),
  // Tool inputs and query parameters.
  'per_chat', 'chat_id', 'message_id', 'reply_to', 'media_id', 'idempotency_key', 'account_id', 'updated_since',
  // Fields: accounts, chats, messages and pages.
  'display_name', 'connected_at', 'unread_count', 'last_message_at', 'is_archived', 'is_pinned', 'is_muted',
  'is_message_request', 'member_count', 'is_me', 'sent_at', 'mime_type', 'file_name', 'next_cursor', 'has_more',
  'chat_name', 'receipt_sent',
  // Fields: GET /v1/me, its plan (PlanSummary v2) and its limits.
  'api_version', 'requests_per_second', 'requests_per_minute', 'api_keys', 'event_streams', 'per_hour', 'per_day',
  'used_last_hour', 'used_last_day', 'period_start', 'period_end', 'trial_ends_at', 'cancel_at', 'calls_this_period',
  'transcription_seconds_this_period', 'transcription_seconds_included', 'scheduled_change', 'event_retention_days',
  // Fields: delivery, events, webhooks and their deliveries, contacts, transcripts, keys and problems.
  'updated_at', 'created_at', 'last_read_message_id', 'event_types', 'disabled_reason', 'failing_since',
  'previous_secret_expires_at', 'delivery_id', 'event_id', 'event_type', 'next_attempt_at', 'last_attempt_at',
  'last_status_code', 'last_error', 'last_response_excerpt', 'delivered_at', 'duration_seconds', 'created_via',
  'last_used_at', 'request_id', 'retry_after',
  // chesly login's answers: --no-wait (the device flow), --wait, and a login that keeps a working key.
  'verification_uri_complete', 'user_code', 'expires_in', 'signed_in', 'already_signed_in', 'stored_in',
  // Values: an account's status, a plan's status, why a webhook is off.
  'needs_attention', 'past_due', 'key_revoked',
  // Error codes: the API's.
  'account_not_found', 'chat_not_found', 'message_not_found', 'media_not_found', 'media_expired', 'media_too_large',
  'media_unavailable', 'invalid_cursor', 'rate_limited', 'network_unavailable', 'search_unavailable', 'feed_unavailable',
  'upstream_unavailable', 'signing_key_missing', 'invalid_request', 'invalid_api_key', 'insufficient_scope', 'not_found',
  'internal_error', 'idempotency_key_invalid', 'idempotency_key_reused', 'idempotency_in_progress', 'message_request',
  'send_limit_reached', 'text_too_long', 'invalid_reply_to', 'unsupported_chat', 'events_expired', 'too_many_streams',
  'webhook_not_found', 'webhook_limit_reached', 'invalid_webhook_url', 'not_a_voice_note', 'transcription_unavailable',
  'key_not_found', 'key_limit_reached', 'api_plan_required', 'transcription_limit_reached', 'plan_unavailable',
  'already_subscribed', 'terms_changed', 'email_send_failed', 'account_reconnect_required', 'api_paused',
  'payload_too_large', 'upload_timeout',
  // Error and warning codes: the CLI's own, and a failed delivery's.
  ...CLI_ERROR_CODES, ...CLI_WARNING_CODES, 'network_rejected', 'not_logged_in', 'rate_limited_by_network',
  // Other clients' settings: OpenAI's Responses API and Codex.
  'server_label', 'server_url', 'allowed_tools', 'require_approval', 'bearer_token_env_var', 'mcp_servers',
]);

/** The MCP server's one URL in this repo, until the mcp.chesly.app name is live. */
const MCP_URL = 'https://api.chesly.app/mcp';

const SKILLS = {
  chesly: {
    description:
      "Read, search, watch and reply to the user's own messages across the chat networks and email they connected in Chesly, using the chesly CLI. Use when the user asks what they missed, about a chat or a person, who they owe a reply, to find a message, to answer someone, or to keep watching for new messages.",
    references: ['references/commands.md', 'references/recipes.md'],
  },
  'chesly-api': {
    description:
      "Build with the Chesly API: REST at https://api.chesly.app/v1, live events over SSE or signed webhooks, and the remote MCP server, for the user's own chats and email. Use when writing code or agent configuration that reads, sends or reacts to the user's messages.",
    references: ['references/rest.md', 'references/events-and-webhooks.md', 'references/mcp.md'],
  },
};

/** The ruling every skill keeps: show the message and wait for the user's OK, unless they said otherwise. */
const ASK_BEFORE_SENDING = /before you send[^.]*show[^.]*text[^.]*wait[^.]*\bOK\b[^.]*unless[^.]*otherwise/i;

// ---------------------------------------------------------------------------------------------
// Reading the repo
// ---------------------------------------------------------------------------------------------

/** Every file under the repo root, relative to it, outside .git and node_modules. */
function repoFiles(dir = ROOT) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? repoFiles(path) : [relative(ROOT, path)];
  });
}

const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const markdownFiles = () => repoFiles().filter((file) => file.endsWith('.md'));
const skillFiles = (skill) => markdownFiles().filter((file) => file.startsWith(`skills${sep}${skill}${sep}`));
/** The files people and agents read: Markdown and JSON. */
const copyFiles = () => repoFiles().filter((file) => /\.(md|json)$/.test(file));

const FENCE = /^(?<indent>[ \t]*)(?<fence>```|~~~)[^\n]*\n(?<body>[\s\S]*?)^\k<indent>\k<fence>[ \t]*$/gm;
const INLINE_CODE = /(?<ticks>`+)(?!`)(?<body>[\s\S]*?[^`])\k<ticks>(?!`)/g;

/** Markdown split into its fenced code blocks, its inline code spans, and the prose around them. */
function parseMarkdown(markdown) {
  const blocks = [...markdown.matchAll(FENCE)].map((match) => match.groups.body);
  const outside = markdown.replace(FENCE, '\n');
  const inline = [...outside.matchAll(INLINE_CODE)].map((match) => match.groups.body.trim());
  const prose = outside.replace(INLINE_CODE, ' ');
  return { blocks, inline, prose };
}

/** Every piece of code in a Markdown file: inline spans and fenced blocks. */
const codeOf = (markdown) => {
  const { blocks, inline } = parseMarkdown(markdown);
  return [...inline, ...blocks];
};

/** A SKILL.md's frontmatter: one `key: value` a line, each value plain or double-quoted. */
function frontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  assert.ok(match, 'no frontmatter between --- lines at the top');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const field = /^([a-z][a-z-]*): (.+)$/.exec(line);
    assert.ok(field, `a frontmatter line isn't "key: value": ${line}`);
    const [, key, value] = field;
    if (value.startsWith('"')) {
      fields[key] = JSON.parse(value);
    } else {
      assert.equal(plainValueProblem(value), null, `${key} needs quotes`);
      fields[key] = value;
    }
  }
  return fields;
}

/**
 * Why YAML would read a plain (unquoted) value as something other than that text, or null: ": " or
 * " #" inside it, a start that opens a structure, comment, alias, tag or block (`#`, `- `, `? `,
 * `]`, a quote, `{`, `[`…), a trailing `:`, or a whole value YAML reads as a boolean, null or number.
 */
function plainValueProblem(value) {
  if (/: | #/.test(value)) return '": " or " #" inside';
  if (/^(?:[#'"{}[\]>|&*!%@`,]|[-?:](?:\s|$))/.test(value)) return 'its first character';
  if (/:$/.test(value)) return 'a trailing ":"';
  if (/^(?:y|yes|n|no|true|false|on|off|null|~)$/i.test(value)) return 'a boolean or null';
  if (/^[-+]?(?:\d[\d_.]*(?:e[-+]?\d+)?|\.\d+|\.inf|\.nan|0x[\da-f]+|0o[0-7]+)$/i.test(value)) return 'a number';
  return null;
}

/** The text under a heading, up to the next heading of the same level or higher. */
function section(markdown, title) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^#{1,6} ${title}$`).test(line));
  assert.notEqual(start, -1, `no "${title}" heading`);
  const level = /^#+/.exec(lines[start])[0].length;
  const end = lines.findIndex((line, index) => index > start && /^#+ /.test(line) && /^#+/.exec(line)[0].length <= level);
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

/** The anchors GitHub gives a file's headings (github-slugger). */
function headingSlugs(markdown) {
  const counts = new Map();
  const slugs = new Set();
  for (const [, title] of markdown.replace(FENCE, '\n').matchAll(/^#{1,6}[ \t]+(.+?)[ \t]*$/gm)) {
    const base = title
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    slugs.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return slugs;
}

// ---------------------------------------------------------------------------------------------
// Reading chesly commands out of shell
// ---------------------------------------------------------------------------------------------

/** Where a shell command starts: the beginning, a new line, a pipe or list, `(`, `{` or `$(`. */
const COMMAND_START = /(^|\n|[|;&({`]|\$\()[ \t]*(?:[A-Z_][A-Z0-9_]*=\S*[ \t]+)*chesly(?=[\s)`]|$)/g;
/** A heredoc's start, `<<'EOF'`: a quoted delimiter keeps the body as written, an unquoted one lets the shell expand it. */
const HEREDOC = /^<<-?[ \t]*(?:'(?<single>[^'\n]+)'|"(?<double>[^"\n]+)"|(?<bare>[\w.-]+))/;

/**
 * Every `chesly …` command in a piece of shell: its words after `chesly`; `stdin`, where a `-` reads
 * the text from (`quoted heredoc`, `heredoc`, `file`, or null for a pipe or nothing); and `via`,
 * what it follows (`$(` inside a command substitution, `|` in a pipe).
 */
function cheslyCommands(code) {
  const shell = withoutHeredocBodies(code);
  return [...shell.matchAll(COMMAND_START)].map((match) => ({
    ...wordsFrom(shell, match.index + match[0].length),
    via: match[1] === '' || match[1] === '\n' ? null : match[1],
  }));
}

/** Shell with every heredoc's body left out: a message's text is never a command. */
function withoutHeredocBodies(code) {
  const lines = code.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    kept.push(lines[i]);
    const opener = lines[i].indexOf('<<');
    const heredoc = opener === -1 ? null : HEREDOC.exec(lines[i].slice(opener));
    if (heredoc === null) continue;
    const { single, double, bare } = heredoc.groups;
    while (i + 1 < lines.length && lines[i + 1].trim() !== (single ?? double ?? bare)) i++;
    i++;
  }
  return kept.join('\n');
}

/**
 * The words of one command from `from` on, as the shell splits them: quotes join, a `<placeholder>`
 * is one word, a `\` line end continues the command, and `[ ]` (optional parts) are dropped. A
 * heredoc or a `< file` redirect sets `stdin` and adds no word.
 */
function wordsFrom(code, from) {
  const words = [];
  let word = '';
  let quote = null;
  let depth = 0;
  let stdin = null;
  let redirected = false;
  const endWord = () => {
    if (word !== '' && redirected) redirected = false;
    else if (word !== '') words.push(word);
    word = '';
  };
  for (let i = from; i < code.length; i++) {
    const ch = code[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '<' && code[i + 1] === '<') {
      const heredoc = HEREDOC.exec(code.slice(i));
      if (heredoc === null) break;
      stdin = heredoc.groups.bare === undefined ? 'quoted heredoc' : 'heredoc';
      i += heredoc[0].length - 1;
    } else if (ch === '<' && /\s/.test(code[i + 1] ?? '')) {
      stdin = 'file';
      redirected = true;
    } else if (ch === '<') {
      const end = code.indexOf('>', i);
      if (end === -1) break;
      word += code.slice(i, end + 1);
      i = end;
    } else if (ch === '\\' && code[i + 1] === '\n') {
      i++;
    } else if (ch === '$' && code[i + 1] === '(') {
      depth++;
      word += '$(';
      i++;
    } else if (ch === ')' && depth > 0) {
      depth--;
      word += ch;
    } else if (depth === 0 && (ch === ')' || ch === '\n' || ch === '|' || ch === ';' || ch === '&' || ch === '`')) {
      break;
    } else if (ch === '#' && word === '') {
      break;
    } else if (/\s/.test(ch)) {
      endWord();
    } else {
      word += ch;
    }
  }
  endWord();
  return {
    words: words.map((w) => w.replace(/^\[+|\]+$/g, '')).filter((w) => w !== '' && w !== '…' && w !== '...'),
    stdin,
  };
}

/** The options that take no value; every other option takes the word after it. */
const SWITCHES = ['--json', '--help', '--version', '--no-wait', '--wait', '--no-browser', '--force', '--reveal', '--unread'];

/** A command's positional arguments, after its name and subcommand: options and their values left out. */
function positionals(words) {
  const [name, ...rest] = words;
  const args = CLI[name]?.subcommands === undefined ? rest : rest.slice(1);
  const found = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') return [...found, ...args.slice(i + 1)];
    if (args[i] === '-' || !args[i].startsWith('-')) found.push(args[i]);
    else if (!SWITCHES.includes(args[i].split('=')[0]) && !args[i].includes('=')) i++;
  }
  return found;
}

/** The options a command's words may use, with the wave of each, or null for an unknown command. */
function optionsOf(words) {
  const [name, sub] = words;
  const command = CLI[name];
  if (command === undefined) return null;
  if (command.subcommands === undefined) return command.options;
  return command.subcommands[sub] ?? {};
}

/** What is wrong with one `chesly …` command: an unknown command, subcommand or option. */
function commandProblems(words) {
  if (words.length === 0) return [];
  const [name, sub, ...rest] = words;
  if (name.startsWith('-')) return TOP_LEVEL_OPTIONS.includes(name) ? [] : [`chesly has no option ${name}`];
  if (name.startsWith('<')) return []; // `chesly <command> --help`: any command
  const command = CLI[name];
  if (command === undefined) return [`there is no command "${name}"`];
  let args = [sub, ...rest].filter((word) => word !== undefined);
  if (command.subcommands !== undefined && sub !== undefined && !sub.startsWith('-')) {
    if (!(sub in command.subcommands)) return [`"${name}" has no subcommand "${sub}"`];
    args = rest;
  }
  const options = optionsOf(words);
  const problems = [];
  for (const word of args) {
    if (word === '--') break;
    if (word === '-' || !word.startsWith('-')) continue;
    const option = word.split('=')[0];
    if (!(option in options) && !GLOBAL_OPTIONS.includes(option)) problems.push(`"${name}" has no option ${option}`);
  }
  return problems;
}

const problemsIn = (code) => cheslyCommands(code).flatMap(({ words }) => commandProblems(words));

// ---------------------------------------------------------------------------------------------
// Reading endpoints, tools, event types and API names out of Markdown
// ---------------------------------------------------------------------------------------------

/** A path under /v1, its IDs written as `{chat_id}`, `<msg_id>` or real IDs. A sentence's last dot isn't in it. */
const V1_PATH = String.raw`\/v1(?:\/(?:<[^>\s]*>|\{[^}\s]*\}|[\w…-]+(?:\.[\w…-]+)*))*`;
const METHOD_PATH = new RegExp(String.raw`\b(GET|POST|PATCH|PUT|DELETE|HEAD) (${V1_PATH})`, 'g');
const API_URL_PATH = new RegExp(String.raw`https:\/\/api\.chesly\.app(${V1_PATH})`, 'g');
const BARE_PATH = new RegExp(String.raw`(?<![\w./-])(${V1_PATH})`, 'g');
/** A path segment that stands for an ID: `{chat_id}`, `<msg_id>`, `:id`, or a real ID such as `chat_…`. */
const ID_SEGMENT = /^(\{[^}]*\}|<[^>]*>|:\w+|(acct|chat|msg|media|evt|wh|dlv|contact)_.*)$/;

const normalizePath = (path) =>
  path.replace(/\/+$/, '').split('/').map((segment) => (ID_SEGMENT.test(segment) ? '{}' : segment)).join('/');
const endpointKey = (method, path) => `${method} ${normalizePath(path)}`;
const ENDPOINT_WAVES = new Map(Object.entries(ENDPOINTS).map(([endpoint, wave]) => [endpointKey(...endpoint.split(' ')), wave]));
/** Every path an endpoint has, and the API's base. */
const PATHS = new Set(['/v1', ...[...ENDPOINT_WAVES.keys()].map((endpoint) => endpoint.split(' ')[1])]);

/** A piece of shell's commands one a line: `\` line ends joined, heredoc bodies left out. */
const logicalLines = (code) => withoutHeredocBodies(code).replace(/\\\n/g, ' ').split('\n');

/** Each curl request to the API in a piece of shell, as [method, path, the command line]. */
function curlRequests(code) {
  return logicalLines(code)
    .filter((line) => /\bcurl\b/.test(line))
    .flatMap((line) => {
      const named = /(?:-X|--request) ([A-Z]+)/.exec(line)?.[1];
      const method = named ?? (/ (-d|--data[\w-]*|-F|--form|--json) /.test(line) ? 'POST' : 'GET');
      return [...line.matchAll(API_URL_PATH)].map((match) => [method, match[1], line]);
    });
}

/**
 * How a piece of shell gives a send its text, where the shell could rewrite it (R74): as an argument,
 * from a pipe or an unquoted heredoc, or in a curl body on the command line. The text reaches a send
 * only through a quoted heredoc (`<<'EOF'`) or a file: inside double quotes, `$20` becomes `0`, and
 * backticks or `$(…)` copied from a message run.
 */
function sendTextProblems(code) {
  const problems = [];
  for (const { words, stdin } of cheslyCommands(code)) {
    if (words[0] !== 'send') continue;
    const [, text] = positionals(words);
    const command = `chesly ${words.join(' ')}`;
    if (text !== undefined && text !== '-') problems.push(`${command}: the text is an argument; pass - and a quoted heredoc`);
    else if (text === '-' && stdin !== 'quoted heredoc' && stdin !== 'file') {
      problems.push(`${command}: - reads ${stdin ?? 'a pipe or nothing'}; give it a quoted heredoc (<<'EOF') or a file`);
    }
  }
  for (const [method, path, line] of curlRequests(code)) {
    if (endpointKey(method, path) !== 'POST /v1/chats/{}/messages') continue;
    const body = /\s(?:-d|--data[\w-]*|--json) +(\S+)/.exec(line)?.[1];
    const fromHeredoc = body === '@-' && /<<-?[ \t]*['"]/.test(line);
    const fromFile = body !== undefined && body.startsWith('@') && body !== '@-';
    if (!fromHeredoc && !fromFile) problems.push(`curl sends the text on its command line; send the body from a quoted heredoc (--data-binary @- <<'EOF') or a file`);
  }
  return problems;
}

/** What is wrong with the endpoints a Markdown text names: a path, method or request the API lacks. */
function endpointProblems(markdown) {
  const problems = [];
  for (const regex of [API_URL_PATH, BARE_PATH]) {
    for (const [, path] of markdown.matchAll(regex)) {
      if (!PATHS.has(normalizePath(path))) problems.push(`no endpoint has the path ${path}`);
    }
  }
  for (const [, method, path] of markdown.matchAll(METHOD_PATH)) {
    if (PATHS.has(normalizePath(path)) && !ENDPOINT_WAVES.has(endpointKey(method, path))) problems.push(`there is no ${method} ${path}`);
  }
  for (const code of codeOf(markdown)) {
    for (const [method, path] of curlRequests(code)) {
      if (PATHS.has(normalizePath(path)) && !ENDPOINT_WAVES.has(endpointKey(method, path))) problems.push(`curl sends ${method} ${path}, which the API lacks`);
    }
  }
  return problems;
}

/** Names shaped like a tool's: inline code that is one name, and quoted names in code blocks. */
function toolProblems(markdown) {
  const { blocks, inline } = parseMarkdown(markdown);
  const quoted = blocks.flatMap((block) => [...block.matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]));
  return [...inline, ...quoted]
    .filter((name) => TOOL_SHAPE.test(name) && !(name in TOOLS) && !API_NAMES.has(name))
    .map((name) => `${name} is not one of the 10 tools`);
}

const SNAKE_NAME = /(?<![\w$-])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![\w-])/g;
/** An event type's shape, such as `message.delivery_failed`: eventTypeProblems checks those. */
const EVENT_TYPE_SHAPE = /(?<![\w.$])(?:message|chat|account|reaction)\.[a-z_]+\b(?!\()/g;

/** What the name check leaves out of inline code: placeholders, quoted text, URLs and /v1 paths. */
const NOT_NAMES = new RegExp(String.raw`<[^>]*>|"[^"]*"|'[^']*'|https?:\/\/\S+|${V1_PATH}`, 'g');

/**
 * The snake_case names a Markdown text uses that the API doesn't have: in inline code (placeholders,
 * quoted text, URLs, paths and event types aside), and as the keys of JSON code blocks.
 */
function nameProblems(markdown) {
  const { blocks, inline } = parseMarkdown(markdown);
  const inInline = inline.flatMap((span) =>
    [...span.replace(NOT_NAMES, ' ').replace(EVENT_TYPE_SHAPE, ' ').matchAll(SNAKE_NAME)].map((match) => match[0]));
  const inJson = blocks
    .filter((block) => /^\s*[{[]/.test(block))
    .flatMap((block) => [...block.matchAll(/"([^"\s]+)"\s*:/g)].map((match) => match[1]))
    .filter((key) => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(key));
  return [...inInline, ...inJson].filter((name) => !API_NAMES.has(name)).map((name) => `the API has no ${name}`);
}

/** Event types a Markdown text names in code that aren't in the catalog. */
function eventTypeProblems(markdown) {
  return codeOf(markdown)
    .flatMap((code) => [...code.matchAll(EVENT_TYPE_SHAPE)].map((match) => match[0]))
    .filter((type) => !EVENT_TYPES.includes(type))
    .map((type) => `there is no event ${type}`);
}

// ---------------------------------------------------------------------------------------------
// The checker's own behaviour
// ---------------------------------------------------------------------------------------------

test('the_command_check_finds_unknown_commands_subcommands_and_options', () => {
  assert.deepEqual(problemsIn('chesly catchup --network email --json'), []);
  assert.deepEqual(problemsIn('chesly send "Mom" "On my way" --reply-to <msg_id> --wait --json'), []);
  assert.deepEqual(problemsIn('chesly send <chat> [<text>] [--file <path>] [--idempotency-key <key>]'), []);
  assert.deepEqual(problemsIn('chesly send Mom -- "-5 degrees here"'), []);
  assert.deepEqual(problemsIn('chesly webhooks create <url> [--payload <full or ids>]'), []);
  assert.deepEqual(problemsIn('chesly <command> --help'), []);
  assert.deepEqual(problemsIn('npm install -g chesly'), [], 'chesly as an argument is no command');
  assert.deepEqual(problemsIn('claude mcp add --transport http chesly https://example.com --header "x"'), []);
  assert.deepEqual(problemsIn('chesly reed "Mom"'), ['there is no command "reed"']);
  assert.deepEqual(problemsIn('chesly send "Mom" "hi" --replyto <msg_id>'), ['"send" has no option --replyto']);
  assert.deepEqual(problemsIn('chesly webhooks remove wh_1'), ['"webhooks" has no subcommand "remove"']);
  assert.deepEqual(problemsIn('--header "Authorization: Bearer $(chesly key --revael)"'), ['"key" has no option --revael']);
  assert.deepEqual(problemsIn('chesly catchup --json | jq .\nchesly chats --unred'), ['"chats" has no option --unred']);
});

test('the_endpoint_check_finds_paths_methods_and_requests_the_api_lacks', () => {
  assert.deepEqual(endpointProblems('`GET /v1/chats/{chat_id}/messages` and `POST /v1/messages/<msg_id>/transcript`'), []);
  assert.deepEqual(endpointProblems('`curl -N "https://api.chesly.app/v1/events/stream?after=evt_1"`'), []);
  assert.deepEqual(endpointProblems('```bash\ncurl https://api.chesly.app/v1/chats/chat_x/messages \\\n  -d \'{"text":"hi"}\'\n```'), []);
  assert.deepEqual(endpointProblems('REST at https://api.chesly.app/v1, and `GET /v1/messages?since=`'), []);
  assert.deepEqual(endpointProblems('The document is at https://api.chesly.app/v1/openapi.json.'), []);
  assert.deepEqual(endpointProblems('`GET /v1/conversations`'), ['no endpoint has the path /v1/conversations']);
  assert.deepEqual(endpointProblems('`DELETE /v1/chats/{chat_id}`'), ['there is no DELETE /v1/chats/{chat_id}']);
  assert.deepEqual(endpointProblems('```bash\ncurl https://api.chesly.app/v1/webhooks/wh_1/test\n```'), [
    'curl sends GET /v1/webhooks/wh_1/test, which the API lacks',
  ]);
});

test('the_tool_name_and_event_checks_find_what_the_api_lacks', () => {
  assert.deepEqual(toolProblems('`send_message`, `catch_up`, `send_limit_reached` and `"allowed_tools": ["read_chat"]`'), []);
  assert.deepEqual(toolProblems('`send_messages`\n```json\n{"allowed_tools": ["list_contacts"]}\n```'), [
    'send_messages is not one of the 10 tools',
    'list_contacts is not one of the 10 tools',
  ]);
  assert.deepEqual(nameProblems('`next_cursor`, `data.message.sender.is_me`, `--reply-to <msg_id>`, `CHESLY_API_KEY`'), []);
  assert.deepEqual(nameProblems('`message.delivery_failed` and `account.needs_attention` are event types'), []);
  assert.deepEqual(nameProblems('`DELETE /v1/keys/{key_id}` and `POST /v1/webhooks/{id}/rotate_secret` are paths'), []);
  assert.deepEqual(nameProblems('`retry_afer`\n```json\n{"request_id": "x", "chat_title": "y"}\n```'), [
    'the API has no retry_afer',
    'the API has no chat_title',
  ]);
  assert.deepEqual(eventTypeProblems('`message.received`, `data.message.text`, `--types chat.read,reaction.added`'), []);
  assert.deepEqual(eventTypeProblems('`message.created` and `{"type": "chat.renamed"}`'), [
    'there is no event message.created',
    'there is no event chat.renamed',
  ]);
});

test('the_send_check_reads_heredocs_files_and_pipes', () => {
  const read = (code) => cheslyCommands(code).map(({ words, stdin, via }) => [words.join(' '), stdin, via]);
  assert.deepEqual(read("chesly send chat_1 - --json <<'EOF'\nchesly is $20 `x`\nEOF\nchesly read chat_1 --json"), [
    ['send chat_1 - --json', 'quoted heredoc', null],
    ['read chat_1 --json', null, null],
  ]);
  assert.deepEqual(read('chesly send chat_1 - --json < reply.txt'), [['send chat_1 - --json', 'file', null]]);
  assert.deepEqual(read('x --header "Bearer $(chesly key --reveal)"'), [['key --reveal', null, '$(']]);
  assert.deepEqual(sendTextProblems("chesly send <chat_id> - --reply-to <msg_id> --wait --json <<'EOF'"), []);
  assert.deepEqual(sendTextProblems('chesly send "Mom" - --json < reply.txt'), []);
  assert.deepEqual(sendTextProblems('chesly send chat_1 --file report.pdf --wait --json'), [], 'a file alone has no text');
  assert.deepEqual(sendTextProblems("curl https://api.chesly.app/v1/chats/chat_1/messages \\\n  --data-binary @- <<'EOF'\n{\"text\": \"hi\"}\nEOF"), []);
  for (const code of ['chesly send "Mom" "On my way $20" --json', 'chesly send "Mom" --json -- "-5 degrees"',
    'chesly send chat_1 - --json <<EOF\nhi\nEOF', 'printf "%s" "$TEXT" | chesly send chat_1 - --json',
    `curl https://api.chesly.app/v1/chats/chat_1/messages -d '{"text": "hi"}'`]) {
    assert.equal(sendTextProblems(code).length, 1, code);
  }
});

test('the_frontmatter_check_quotes_what_yaml_would_misread', () => {
  for (const value of ['chesly', 'chesly-api', 'Reads the user\'s chats, using the chesly CLI.', '3 ways in', 'Use it when: never']) {
    assert.equal(plainValueProblem(value), value === 'Use it when: never' ? '": " or " #" inside' : null, value);
  }
  for (const value of ['# not a comment', '- a list', '? a key', '] closes', 'ends with:', 'yes', 'Null', '~', 'off',
    '1.0', '-3', 'Build: REST', 'it # comment', "'quoted", '*alias', '!tag', '{a}', '[a]']) {
    assert.notEqual(plainValueProblem(value), null, value);
  }
});

test('the_section_and_slug_readers_follow_github', () => {
  const markdown = '# Title\n\n## Exit codes\ntext\n### Deeper\nmore\n## Next\n\n## `chesly send`\n## Exit codes\n';
  assert.equal(section(markdown, 'Exit codes'), '## Exit codes\ntext\n### Deeper\nmore');
  assert.deepEqual([...headingSlugs(markdown)], ['title', 'exit-codes', 'deeper', 'next', 'chesly-send', 'exit-codes-1']);
});

// ---------------------------------------------------------------------------------------------
// Every skill
// ---------------------------------------------------------------------------------------------

test('every_skill_has_a_valid_name_and_description', () => {
  const skills = readdirSync(join(ROOT, 'skills'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.deepEqual(skills.map((entry) => entry.name).sort(), Object.keys(SKILLS).sort());
  for (const { name } of skills) {
    const fields = frontmatter(read(join('skills', name, 'SKILL.md')));
    assert.deepEqual(Object.keys(fields).sort(), ['description', 'name'], `${name}: only name and description`);
    assert.equal(fields.name, name, 'the name is the skill directory');
    assert.match(fields.name, /^(?!-)(?!.*--)[a-z0-9-]{1,64}(?<!-)$/);
    assert.ok(fields.description.length >= 1 && fields.description.length <= 1024, `${name}: description length`);
    assert.equal(fields.description, SKILLS[name].description, `${name}: the planned description`);
  }
});

test('every_skill_links_its_references', () => {
  for (const [name, { references }] of Object.entries(SKILLS)) {
    const { prose } = parseMarkdown(read(join('skills', name, 'SKILL.md')));
    for (const reference of references) assert.ok(prose.includes(`](${reference})`), `${name} links ${reference}`);
  }
});

test('relative_links_resolve_inside_their_skill', () => {
  for (const file of markdownFiles()) {
    const markdown = read(file);
    for (const [, target] of parseMarkdown(markdown).prose.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [path, fragment] = target.split('#');
      const resolved = path === '' ? file : join(dirname(file), decodeURI(path));
      assert.ok(existsSync(join(ROOT, resolved)), `${file}: ${target} doesn't resolve`);
      // `npx skills add` copies a skill's own directory only, so a skill links nothing outside it.
      const skill = /^skills[\\/][^\\/]+[\\/]/.exec(file)?.[0];
      if (skill !== undefined) assert.ok(resolved.startsWith(skill), `${file}: ${target} leaves the skill`);
      if (fragment !== undefined) {
        assert.ok(headingSlugs(read(resolved)).has(fragment), `${file}: ${target} names no heading`);
      }
    }
  }
});

test('every_chesly_command_and_option_exists', () => {
  const problems = [];
  for (const file of markdownFiles()) {
    for (const code of codeOf(read(file))) {
      for (const { words } of cheslyCommands(code)) {
        for (const problem of commandProblems(words)) problems.push(`${file}: chesly ${words.join(' ')}: ${problem}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('no_command_puts_a_key_on_the_command_line', () => {
  // The process list and shell history keep argv: a key comes from CHESLY_API_KEY or stdin (`--key -`).
  for (const file of markdownFiles()) {
    for (const code of codeOf(read(file))) {
      assert.doesNotMatch(code, /ck_live_[A-Za-z0-9_-]{4,}/, `${file}: a key in the text`);
      for (const { words } of cheslyCommands(code)) {
        if (words[0] !== 'login') continue;
        assert.ok(!words.some((word) => word.startsWith('--key=')), `${file}: chesly ${words.join(' ')}`);
        const at = words.indexOf('--key');
        if (at !== -1) assert.equal(words[at + 1], '-', `${file}: chesly ${words.join(' ')} reads the key from stdin`);
      }
    }
  }
});

test('every_send_reads_its_text_from_a_quoted_heredoc_or_a_file', () => {
  const problems = markdownFiles().flatMap((file) =>
    codeOf(read(file)).flatMap((code) => sendTextProblems(code).map((problem) => `${file}: ${problem}`)));
  assert.deepEqual(problems, []);
});

test('every_skill_says_message_text_never_goes_through_the_shell', () => {
  for (const skill of Object.keys(SKILLS)) {
    const markdown = read(join('skills', skill, 'SKILL.md'));
    assert.match(parseMarkdown(markdown).prose, /Message text never goes through the shell/, skill);
    assert.ok(parseMarkdown(markdown).blocks.some((block) => /<<'EOF'\n[\s\S]*\n[ \t]*EOF[ \t]*\n?$/.test(block)), `${skill} shows a quoted heredoc`);
  }
});

test('every_endpoint_named_is_the_apis', () => {
  assert.deepEqual(markdownFiles().flatMap((file) => endpointProblems(read(file)).map((problem) => `${file}: ${problem}`)), []);
});

test('every_tool_named_is_one_of_the_ten', () => {
  assert.deepEqual(markdownFiles().flatMap((file) => toolProblems(read(file)).map((problem) => `${file}: ${problem}`)), []);
});

test('every_snake_case_name_is_the_apis', () => {
  assert.deepEqual(markdownFiles().flatMap((file) => nameProblems(read(file)).map((problem) => `${file}: ${problem}`)), []);
});

test('every_event_type_is_in_the_catalog', () => {
  assert.deepEqual(markdownFiles().flatMap((file) => eventTypeProblems(read(file)).map((problem) => `${file}: ${problem}`)), []);
});

test('the_mcp_url_is_one_value', () => {
  for (const file of copyFiles()) {
    const text = read(file);
    for (const [url] of text.matchAll(/https?:\/\/[\w.-]*chesly\.app\/mcp\b/g)) assert.equal(url, MCP_URL, file);
    assert.doesNotMatch(text, /mcp\.chesly\.app/, `${file}: the MCP server is at ${MCP_URL} until mcp.chesly.app is live`);
  }
});

test('no_end_to_end_claims_and_no_legal_language', () => {
  for (const file of copyFiles()) {
    const text = read(file);
    assert.doesNotMatch(text, /end[- ]to[- ]end|\be2ee?\b/i, `${file}: Chesly is hosted, never end-to-end`);
    assert.doesNotMatch(text, /\b(lawyers?|legal|liabilit\w*|indemnif\w*|compliance|terms of service)\b/i, `${file}`);
  }
});

test('hidden_networks_are_never_named', () => {
  for (const file of copyFiles()) assert.doesNotMatch(read(file), /tik ?tok|chatgpt ?dots/i, file);
});

test('every_network_is_named_linkedin_included', () => {
  for (const file of ['README.md', ...Object.keys(SKILLS).map((skill) => join('skills', skill, 'SKILL.md'))]) {
    const text = parseMarkdown(read(file)).prose;
    for (const network of NETWORK_NAMES) assert.match(text, new RegExp(`\\b${network}\\b`), `${file} names ${network}`);
  }
});

// ---------------------------------------------------------------------------------------------
// The chesly skill
// ---------------------------------------------------------------------------------------------

test('the_chesly_skill_guides_a_user_without_the_plugin', () => {
  const setup = section(read(join('skills', 'chesly', 'SKILL.md')), 'Setup');
  const code = codeOf(setup);
  assert.ok(code.includes('npm install -g chesly'), 'the setup installs the CLI');
  assert.ok(code.some((piece) => /^chesly login\b/.test(piece)), 'the setup signs in with chesly login');
  assert.ok(code.some((piece) => /^chesly whoami --json$/.test(piece)), 'the setup checks the sign-in first');
  assert.doesNotMatch(setup, /\bMCP\b/, 'the setup never needs the MCP server');
  assert.match(setup, /connects them in the Chesly app\./, 'accounts are connected in the Chesly app, wherever it runs');
  assert.match(setup, /[Nn]ever type or paste a key itself/, 'a key never passes through a command line or the chat');
});

test('the_key_is_revealed_only_inside_a_command_substitution', () => {
  // `chesly key --reveal` on its own prints the key into the agent's transcript; `$(…)` hands it straight on.
  for (const skill of Object.keys(SKILLS)) {
    for (const file of skillFiles(skill)) {
      for (const code of codeOf(read(file))) {
        for (const { words, via } of cheslyCommands(code)) {
          if (words[0] === 'key' && words.includes('--reveal')) assert.equal(via, '$(', `${file}: chesly ${words.join(' ')}`);
        }
      }
    }
  }
});

test('the_command_reference_warns_that_a_revoked_key_breaks_its_setups', () => {
  const rows = read(join('skills', 'chesly', 'references', 'commands.md')).split('\n');
  for (const command of ['chesly login --force', 'chesly logout']) {
    const row = rows.find((line) => line.startsWith(`| \`${command}\` |`));
    assert.ok(row !== undefined, command);
    assert.match(row, /revokes/i, `${command} says it revokes the old key`);
    assert.match(row, /plugin/, `${command} says a plugin set up with that key stops working`);
  }
});

test('every_skill_shows_the_text_and_waits_for_ok_before_sending', () => {
  for (const skill of Object.keys(SKILLS)) {
    assert.match(parseMarkdown(read(join('skills', skill, 'SKILL.md'))).prose, ASK_BEFORE_SENDING, skill);
  }
});

test('every_command_the_chesly_skill_runs_passes_json', () => {
  for (const file of [join('skills', 'chesly', 'SKILL.md'), join('skills', 'chesly', 'references', 'recipes.md')]) {
    for (const code of codeOf(read(file))) {
      for (const { words } of cheslyCommands(code)) {
        if (words.length === 0 || words[0].startsWith('-') || (words[0] === 'key' && words.includes('--reveal'))) continue;
        assert.ok(words.includes('--json'), `${file}: chesly ${words.join(' ')} needs --json`);
      }
    }
  }
});

test('the_command_reference_covers_every_command_and_option', () => {
  const seen = new Set();
  for (const code of codeOf(read(join('skills', 'chesly', 'references', 'commands.md')))) {
    for (const { words } of cheslyCommands(code)) {
      const [name, sub] = words;
      const command = CLI[name] === undefined || CLI[name].subcommands?.[sub] === undefined ? name : `${name} ${sub}`;
      seen.add(command);
      for (const word of words) if (word.startsWith('--')) seen.add(`${command} ${word.split('=')[0]}`);
    }
  }
  const expected = Object.entries(CLI).flatMap(([name, command]) =>
    Object.entries(command.subcommands ?? { '': command.options }).flatMap(([sub, options]) => {
      const full = sub === '' ? name : `${name} ${sub}`;
      return [full, ...Object.keys(options).map((option) => `${full} ${option}`)];
    }),
  );
  assert.deepEqual(expected.filter((entry) => !seen.has(entry)), []);
});

test('the_command_reference_marks_what_wave_2_adds', () => {
  const rows = read(join('skills', 'chesly', 'references', 'commands.md')).split('\n').filter((line) => line.startsWith('| `chesly'));
  assert.ok(rows.length > 0, 'the commands are in a table');
  for (const row of rows) {
    const [, cell] = row.split('|');
    const commands = codeOf(cell).flatMap(cheslyCommands).map(({ words }) => words);
    const wave2 = commands.some((words) => {
      const options = optionsOf(words) ?? {};
      return CLI[words[0]]?.wave === 2 || words.some((word) => options[word.split('=')[0]] === 2);
    });
    assert.equal(row.includes('(Wave 2)'), wave2, `${row}\nshould ${wave2 ? '' : 'not '}be marked (Wave 2)`);
  }
});

test('the_exit_codes_are_the_clis', () => {
  const table = section(read(join('skills', 'chesly', 'references', 'commands.md')), 'Exit codes');
  assert.deepEqual(table.split('\n').filter((line) => /^\| `?\d+`? \|/.test(line)), EXIT_CODES);
  for (const file of skillFiles('chesly')) {
    for (const [, code] of read(file).matchAll(/\bexits? (?:with |code )?(\d+)\b/gi)) {
      assert.ok(Number(code) <= 6, `${file}: there is no exit code ${code}`);
    }
  }
});

test('the_command_reference_lists_the_clis_own_codes_and_warnings', () => {
  const { inline } = parseMarkdown(section(read(join('skills', 'chesly', 'references', 'commands.md')), 'Errors'));
  assert.deepEqual([...CLI_ERROR_CODES, ...CLI_WARNING_CODES].filter((code) => !inline.includes(code)), []);
});

test('the_chesly_skill_says_how_to_handle_a_failed_or_unclear_send', () => {
  const skill = read(join('skills', 'chesly', 'SKILL.md'));
  const { inline } = parseMarkdown(skill);
  for (const words of ['delivery_failed', 'idempotency_key', '--idempotency-key <that key>', '--media-id <media_id> --idempotency-key <key>', '--file']) {
    assert.ok(inline.includes(words), `the chesly skill names ${words}`);
  }
  assert.match(skill, /without `retry_after`[^.]*a few seconds[^.]*give up after a few tries/, 'exit 5 with no retry_after');
});

test('the_references_name_every_network', () => {
  for (const file of [join('skills', 'chesly', 'references', 'commands.md'), join('skills', 'chesly-api', 'references', 'rest.md')]) {
    const inline = parseMarkdown(read(file)).inline;
    assert.deepEqual(NETWORK_IDS.filter((network) => !inline.includes(network)), [], file);
  }
});

test('the_recipes_cover_the_planned_tasks', () => {
  const recipes = read(join('skills', 'chesly', 'references', 'recipes.md'));
  for (const title of ['What did I miss', 'Reply to the newest unread', 'Find who I owe a reply', 'Catch up on email',
    "Forward a voice note's transcript", 'Watch a chat and answer']) {
    assert.match(recipes, new RegExp(`^## ${title}`, 'm'), `a recipe for "${title}"`);
  }
  assert.ok(codeOf(section(recipes, 'Catch up on email')).includes('chesly catchup --network email --json'));
});

// ---------------------------------------------------------------------------------------------
// The chesly-api skill
// ---------------------------------------------------------------------------------------------

const apiReference = (name) => read(join('skills', 'chesly-api', 'references', name));

test('the_rest_reference_covers_every_endpoint_and_marks_wave_2', () => {
  const rest = apiReference('rest.md');
  const named = new Set([...rest.matchAll(METHOD_PATH)].map(([, method, path]) => endpointKey(method, path)));
  assert.deepEqual([...ENDPOINT_WAVES.keys()].filter((endpoint) => !named.has(endpoint)), []);
  const rows = rest.split('\n').filter((line) => /^\| `(GET|POST|PATCH|DELETE) /.test(line));
  assert.ok(rows.length > 0, 'the endpoints are in a table');
  const extended = new Set(WAVE_2_CONTENT.filter((name) => name.includes(' ')).map((name) => endpointKey(...name.split(' '))));
  for (const row of rows) {
    const endpoints = [...row.split('|')[1].matchAll(METHOD_PATH)].map(([, method, path]) => endpointKey(method, path));
    const wave2 = endpoints.some((endpoint) => ENDPOINT_WAVES.get(endpoint) === 2 || extended.has(endpoint));
    assert.equal(row.includes('(Wave 2)'), wave2, `${row}\nshould ${wave2 ? '' : 'not '}be marked (Wave 2)`);
  }
});

test('the_rest_reference_gives_the_plans_limits_and_the_per_user_ones', () => {
  // R65's per-user limit is the plan's own (R117); the feed-page budget stays.
  const limits = section(apiReference('rest.md'), 'Limits');
  assert.match(limits, /^\| Requests, per key and for all of a user's keys together \| The plan's: `limits\.requests_per_second` and `limits\.requests_per_minute` \|$/m);
  assert.match(limits, /^\| Active keys \| Up to 100 on both plans \(`limits\.api_keys`\) \|$/m);
  assert.match(limits, /^\| Live streams \| The plan's: `limits\.event_streams` \|$/m);
  assert.match(limits, /^\| Webhooks \| The plan's: `limits\.webhooks` \|$/m);
  assert.match(limits, /^\| Since-feed pages \(`GET \/v1\/messages\?since=`\) \| 30 a minute, per user \(Wave 2\) \|$/m);
});

test('wave_2_facts_in_prose_are_marked', () => {
  // A line that states one of these Wave 2 facts outside the marked tables carries the mark too.
  const facts = [/\b7 (?:of its 10 )?tools\b/, /OpenAPI 3\.1 document/];
  for (const file of skillFiles('chesly-api')) {
    for (const line of read(file).split('\n')) {
      if (facts.some((fact) => fact.test(line))) assert.ok(line.includes('(Wave 2)'), `${file}: ${line}`);
    }
  }
});

test('the_rest_reference_covers_the_planned_topics', () => {
  const rest = apiReference('rest.md');
  const code = codeOf(rest).join('\n');
  for (const words of ['Authorization: Bearer ck_live_…', 'application/problem+json', 'https://agents.chesly.app/docs/errors#',
    'Idempotency-Key', 'Idempotent-Replayed', 'next_cursor', 'network=email', 'updated_since', 'before', 'after',
    'Retry-After', 'Chesly-Version']) {
    assert.ok(code.includes(words), `rest.md covers ${words}`);
  }
  assert.ok(codeOf(rest).some((piece) => curlRequests(piece).some(([method, path]) => endpointKey(method, path) === 'POST /v1/chats/{}/messages')),
    'rest.md sends a message with curl');
  assert.match(rest, /https:\/\/api\.chesly\.app\/v1\/openapi\.json/);
  assert.match(rest, /opaque/i, 'IDs are opaque');
});

test('the_mcp_reference_covers_the_ten_tools_and_marks_wave_2', () => {
  const rows = apiReference('mcp.md').split('\n').filter((line) => /^\| `[a-z_]+` \|/.test(line));
  const tool = (row) => /^\| `([a-z_]+)`/.exec(row)[1];
  assert.deepEqual(rows.map(tool).sort(), Object.keys(TOOLS).sort());
  for (const row of rows) {
    const { wave, readKey } = TOOLS[tool(row)];
    const wave2 = wave === 2 || WAVE_2_CONTENT.includes(tool(row)) || (NETWORK_INPUT_TOOLS.includes(tool(row)) && row.includes('`network`'));
    assert.equal(row.includes('(Wave 2)'), wave2, `${row}\nshould ${wave2 ? '' : 'not '}be marked (Wave 2)`);
    assert.equal(row.split('|')[2].trim(), readKey ? 'any' : 'full', `${row}\nthe key it needs`);
  }
  for (const name of NETWORK_INPUT_TOOLS) assert.ok(rows.find((row) => tool(row) === name).includes('`network`'), name);
});

test('the_mcp_reference_sets_up_every_client', () => {
  const mcp = apiReference('mcp.md');
  for (const client of ['Claude Code', 'Codex', 'Cursor', "OpenAI's Responses API", 'OpenClaw', 'n8n']) {
    assert.match(mcp, new RegExp(`^### ${client}$`, 'm'), `a setup for ${client}`);
  }
  const code = codeOf(mcp).map((piece) => piece.replace(/\s*\\\n\s*/g, ' '));
  const claudeCode = `claude mcp add --transport http chesly ${MCP_URL} --header "Authorization: Bearer $(chesly key --reveal)"`;
  assert.ok(code.some((piece) => piece.includes(claudeCode)), 'the Claude Code command');
  assert.ok(code.some((piece) => /"type": "mcp"/.test(piece) && /server_url/.test(piece) && /authorization/.test(piece)), "OpenAI's mcp tool");
  assert.match(mcp, /\b502\b[^.]*\bretry/i, 'a deploy can answer 502 for a moment: retry');
});

test('the_events_reference_covers_the_catalog_and_the_webhook_wire', () => {
  const events = apiReference('events-and-webhooks.md');
  const { inline } = parseMarkdown(events);
  assert.deepEqual(EVENT_TYPES.filter((type) => !inline.includes(type)), []);
  const code = codeOf(events).join('\n');
  for (const words of ['Last-Event-ID', 'curl -N', 'after=', 'webhook-id', 'webhook-timestamp', 'webhook-signature',
    'import { Webhook } from "standardwebhooks"', 'from standardwebhooks import Webhook']) {
    assert.ok(code.includes(words), `the events reference covers ${words}`);
  }
  assert.match(events, /5 seconds, then 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours and 10 hours/, 'the retry schedule');
  assert.match(section(events, 'Events and webhooks \\(Wave 2\\)'), /webhook needs a full-access key/, 'webhook writes need a full key');
});

// ---------------------------------------------------------------------------------------------
// The Claude Code plugin and marketplace
// ---------------------------------------------------------------------------------------------

const readJson = (file) => JSON.parse(read(file));

test('the_plugin_manifest_has_the_planned_values', () => {
  assert.deepEqual(readJson(join('.claude-plugin', 'plugin.json')), {
    name: 'chesly',
    displayName: 'Chesly',
    version: '0.1.0',
    license: 'MIT',
    description: 'Your chats, as an API: read, search, watch and answer your messages across the networks you connected in Chesly.',
    author: { name: 'Chesly', url: 'https://agents.chesly.app' },
    homepage: 'https://agents.chesly.app',
    repository: 'https://github.com/chesly-app/skills',
    keywords: ['messages', 'chats', 'inbox', 'mcp', 'cli'],
    userConfig: {
      api_key: {
        type: 'string',
        title: 'Chesly API key',
        description: 'Run chesly key --reveal, or make a key at https://web.chesly.app/api/keys.',
        sensitive: true,
        required: true,
      },
    },
  });
});

test('the_marketplace_lists_the_repo_root_as_its_one_plugin', () => {
  assert.deepEqual(readJson(join('.claude-plugin', 'marketplace.json')), {
    name: 'chesly',
    owner: { name: 'Chesly', url: 'https://agents.chesly.app' },
    description: 'Chesly for Claude Code.',
    plugins: [{ name: 'chesly', source: './', description: 'Skills and the MCP server for your Chesly chats.' }],
  });
});

test('the_mcp_server_sends_the_key_kept_as_a_secret', () => {
  const { mcpServers } = readJson('.mcp.json');
  assert.deepEqual(mcpServers, {
    chesly: { type: 'http', url: MCP_URL, headers: { Authorization: 'Bearer ${user_config.api_key}' } },
  });
  // Claude Code keeps a sensitive option in the OS keychain, never in settings.json.
  const { userConfig } = readJson(join('.claude-plugin', 'plugin.json'));
  for (const [, option] of JSON.stringify(mcpServers).matchAll(/\$\{user_config\.(\w+)\}/g)) {
    assert.equal(userConfig[option]?.sensitive, true, `${option} is a declared, sensitive option`);
  }
});

test('the_readme_gives_the_install_lines', () => {
  const lines = codeOf(read('README.md')).flatMap((piece) => piece.split('\n'));
  for (const line of ['npx skills add chesly-app/skills', '/plugin marketplace add chesly-app/skills', '/plugin install chesly@chesly']) {
    assert.ok(lines.includes(line), `the README shows ${line}`);
  }
});

// ---------------------------------------------------------------------------------------------
// What the Wave 2 reviews settled (R96-R101)
// ---------------------------------------------------------------------------------------------

const skillMd = (skill) => read(join('skills', skill, 'SKILL.md'));
const UNCERTAIN_FAILURES = ['timeout', 'unknown'];
const CERTAIN_FAILURES = ['network_rejected', 'not_logged_in', 'rate_limited_by_network', 'unsupported'];

test('the_skills_say_when_a_failed_send_may_be_resent', () => {
  // R96, R98: an uncertain failure may have been delivered; only a later certain one makes a resend safe.
  for (const text of [skillMd('chesly'), skillMd('chesly-api'), apiReference('rest.md')]) {
    const { inline } = parseMarkdown(text);
    assert.deepEqual([...UNCERTAIN_FAILURES, ...CERTAIN_FAILURES].filter((code) => !inline.includes(code)), []);
    assert.match(text, /may have been delivered[^.]*don't resend/i);
    assert.match(text, /`certain: true`[^.]*resend is safe/);
    assert.match(text, /are (?:certain and )?final/);
  }
});

test('sent_is_success_and_delivered_only_where_reported', () => {
  for (const text of [skillMd('chesly'), skillMd('chesly-api'), apiReference('rest.md')]) {
    assert.match(text, /most networks stop at `sent`/);
    assert.match(text, /`delivered`[^.]*only where the network reports it/);
  }
});

test('every_file_cap_is_50_000_000_bytes', () => {
  // R97: the homeserver's cap. A "50 MB" that isn't spelled out in bytes is another number.
  for (const file of copyFiles()) {
    for (const [mention] of read(file).matchAll(/50 MB(?! \(50,000,000 bytes\))/g)) assert.fail(`${file}: ${mention} without its bytes`);
  }
  assert.match(apiReference('rest.md'), /50 MB \(50,000,000 bytes\)/);
  assert.match(read(join('skills', 'chesly', 'references', 'commands.md')), /50 MB \(50,000,000 bytes\)/);
});

test('an_email_account_to_reconnect_is_never_retried', () => {
  // R101: a 409 account_reconnect_required needs the user, in the Chesly app.
  for (const text of [skillMd('chesly'), skillMd('chesly-api'), apiReference('rest.md')]) {
    assert.match(text, /`account_reconnect_required`[^\n]*reconnect[^\n]*in the Chesly app[^\n]*[Dd]on't retry/);
  }
});

test('the_event_and_feed_timing_is_stated', () => {
  assert.match(apiReference('events-and-webhooks.md'), /`events_expired`[^\n]*from now/);
  assert.match(read(join('skills', 'chesly', 'references', 'commands.md')), /`events_expired`[^\n]*from now/);
  assert.match(apiReference('rest.md'), /[Ee]mail reaches it up to 10 seconds after it arrives/);
});

test('reply_to_is_a_message_of_the_same_chat', () => {
  for (const text of [read(join('skills', 'chesly', 'references', 'commands.md')), apiReference('rest.md'), apiReference('mcp.md')]) {
    assert.ok(parseMarkdown(text).inline.includes('invalid_reply_to'), 'names invalid_reply_to');
    assert.match(text, /same chat|that chat/);
  }
});

/** A text's clauses: split at a `.`, `;` or `:` before a space, and at line ends, code spans kept whole. */
function clauses(markdown) {
  const spans = [];
  const text = markdown.replace(INLINE_CODE, (span) => `\u0000${spans.push(span) - 1}\u0000`);
  return text.split(/[.;:](?=\s)|\n/).map((clause) => clause.replace(/\u0000(\d+)\u0000/g, (_, i) => spans[Number(i)]));
}

/**
 * Clauses that put an unconfirmed delivery under exit 1: the CLI exits 1 (`delivery_failed`) only for a
 * failure the network confirmed, and 5 (`delivery_unconfirmed`) for one it didn't, which may have arrived.
 */
function exitOneProblems(markdown) {
  return clauses(markdown).filter((clause) => /\bexits? 1\b/.test(clause) && /delivery_failed/.test(clause)
    && (!/confirmed|certain/.test(clause) || /didn't confirm|unconfirmed|certain` is false|`certain: false`/.test(clause)));
}

test('the_exit_1_check_finds_an_unconfirmed_failure_under_it', () => {
  assert.deepEqual(exitOneProblems('A failure the network confirmed exits 1 with `delivery_failed`. One it didn\'t confirm exits 5 with `delivery_unconfirmed`.'), []);
  assert.equal(exitOneProblems('A send whose delivery failed exits 1 with `delivery_failed`.').length, 1);
  assert.equal(exitOneProblems('If `delivery.error.certain` is false, it exits 1 with `delivery_failed`').length, 1);
  assert.equal(clauses('Read `delivery.error.certain`. Then: go; stop').length, 4, 'a dot inside code ends no clause');
});

test('an_unconfirmed_delivery_exits_5_never_1', () => {
  const chesly = (name) => read(join('skills', 'chesly', ...name.split('/')));
  for (const file of ['SKILL.md', 'references/commands.md', 'references/recipes.md']) {
    assert.deepEqual(exitOneProblems(chesly(file)), [], file);
    assert.ok(clauses(chesly(file)).some((clause) => /`delivery_unconfirmed`/.test(clause) && /\bexits? 5\b/.test(clause)), `${file} says delivery_unconfirmed exits 5`);
  }
  const exit5 = chesly('SKILL.md').split('\n').find((line) => line.startsWith('- Exit 5'));
  assert.match(exit5, /`delivery_unconfirmed`[^.]*don't resend/, 'the exit 5 rule never reruns an unconfirmed send');
});

// ---------------------------------------------------------------------------------------------
// The second and third pushes of Wave 2
// ---------------------------------------------------------------------------------------------

/** Why a webhook is off (`disabled_reason`). */
const WEBHOOK_DISABLED_REASONS = ['user', 'failing', 'gone', 'key_revoked'];

test('a_webhook_says_why_it_turned_off', () => {
  const off = section(apiReference('events-and-webhooks.md'), 'When a webhook turns off');
  const { inline } = parseMarkdown(off);
  assert.deepEqual(WEBHOOK_DISABLED_REASONS.filter((reason) => !inline.includes(reason)), []);
  const revoked = off.split('\n').find((line) => line.includes('`key_revoked`'));
  assert.match(revoked, /secret scanning/, 'a leaked key, revoked by secret scanning');
  assert.match(revoked, /emailed/, 'the owner hears about it');
  assert.match(revoked, /[Cc]heck the webhook's URL before you turn it back on/);
});

test('a_slow_upload_waits_out_the_hold', () => {
  const rest = section(apiReference('rest.md'), 'Files \\(Wave 2\\)');
  const sending = section(read(join('skills', 'chesly', 'references', 'commands.md')), 'Sending');
  for (const [text, outcome] of [[rest, /`408` `upload_timeout`/], [sending, /exits 5 with `upload_timeout`/]]) {
    const line = text.split('\n').find((candidate) => candidate.includes('`upload_timeout`'));
    assert.ok(line !== undefined, 'one line on a slow upload');
    assert.match(line, outcome);
    assert.match(line, /under 50 KB\/s after 10 s, or not finished within 60 s/);
    assert.match(line, /held for 60 s[^.]*`rate_limited`/);
    assert.match(line, /wait about 60 s and send again, or send a smaller file on a slow connection/);
  }
});

// ---------------------------------------------------------------------------------------------
// Pricing v2: two flat plans, no call metering (R117)
// ---------------------------------------------------------------------------------------------

/** The two plans: everything else is the same on both, and calls are counted, never billed. */
const PLANS = [
  ['Price', '$49 a month', '$199 a month'],
  ['Transcription a period', '600 minutes', '3,000 minutes'],
  ['Webhooks', '25', '100'],
  ['Requests, per key and for all of a user\'s keys together', '15 a second, 900 a minute', '30 a second, 1,800 a minute'],
  ['Live event streams per user', '10', '25'],
  ['Event history', '7 days', '30 days'],
  ['Support', 'email', 'priority email'],
  ['Chesly Plus', 'included', 'included'],
  ['Connected accounts (app caps)', '10, up to 3 per app (Plus\'s)', '50, up to 10 per app'],
];

test('the_plans_are_stated_once_with_their_limits', () => {
  const plans = section(apiReference('rest.md'), 'Plans and billing');
  assert.match(plans, /^\| \| Personal \| Pro \|$/m);
  for (const [what, personal, pro] of PLANS) assert.ok(plans.includes(`| ${what} | ${personal} | ${pro} |`), what);
  assert.match(plans, /[Cc]alls are counted, never billed/);
  assert.match(plans, /[Bb]oth plans allow up to 100 active API keys/, 'keys are a sanity cap, not a plan difference (R124)');
  assert.match(plans, /`key_limit_reached`[^\n]*`webhook_limit_reached`/, 'a downgrade refuses new ones, deletes none');
  for (const file of [join('skills', 'chesly-api', 'SKILL.md'), join('skills', 'chesly', 'references', 'commands.md')]) {
    assert.match(read(file), /`GET \/v1\/me`|`chesly whoami --json`/, `${file} sends the agent to the plan's limits`);
    assert.match(read(file), /`limits/, `${file} names the limits to read`);
  }
});

test('transcription_limit_reached_is_never_retried', () => {
  // R117: the period's minutes are used up until the next period. The user decides; no retry loop.
  for (const file of [join('skills', 'chesly-api', 'SKILL.md'), join('skills', 'chesly-api', 'references', 'rest.md'),
    join('skills', 'chesly-api', 'references', 'mcp.md'), join('skills', 'chesly', 'references', 'recipes.md')]) {
    const lines = read(file).split('\n').filter((candidate) => candidate.includes('`transcription_limit_reached`'));
    assert.ok(lines.length > 0, `${file} names transcription_limit_reached`);
    assert.ok(lines.some((line) => /next period/.test(line) && /Pro has 3,000 minutes/.test(line) && /[Dd]on't retry/.test(line)),
      `${file}: wait for the next period or Pro's 3,000 minutes, and don't retry`);
  }
});

test('no_metered_pricing_is_left', () => {
  for (const file of copyFiles()) {
    assert.doesNotMatch(read(file), /50,000 calls|overage|spend[ _]limit|calls_exhausted|trial_limit|per 1,000 calls|[$]0\.02|estimated|\bpacks?\b|metered/i, file);
  }
});

test('a_downgrade_waits_for_the_period_end', () => {
  // R118, R119: an upgrade applies at once; a downgrade at the period's end, shown in plan.scheduled_change.
  const plans = section(apiReference('rest.md'), 'Plans and billing');
  assert.match(plans, /An upgrade applies at once/);
  assert.match(plans, /A downgrade applies at the end of the billing period, so its lower limits start then/);
  assert.match(plans, /`plan\.scheduled_change`/);
  for (const file of copyFiles()) assert.doesNotMatch(read(file), /[Ss]witching plans changes the request limits at once/, file);
});

test('plan_unavailable_is_retried_not_upgraded', () => {
  // R121: creating a webhook while the plan can't be read is a short 503, never a reason to upgrade.
  const codes = section(apiReference('rest.md'), 'Errors').split('\n').find((line) => line.startsWith('- Codes to expect:'));
  assert.match(codes, /`plan_unavailable`/);
  const files = [apiReference('events-and-webhooks.md'), read(join('skills', 'chesly', 'references', 'commands.md'))];
  for (const [text, retry] of [[files[0], /wait `Retry-After`/], [files[1], /exits 5[^\n]*wait `retry_after`/]]) {
    const line = text.split('\n').find((candidate) => candidate.includes('`plan_unavailable`'));
    assert.ok(line !== undefined, 'one line on plan_unavailable');
    assert.match(line, retry);
    assert.match(line, /try again once or twice/);
    assert.match(line, /[Dd]on't tell the user to upgrade/);
  }
});

test('event_history_and_streams_follow_the_plan', () => {
  // R124: events are kept 7 or 30 days, and a user keeps 10 or 25 streams, by plan; GET /v1/me has both.
  for (const file of copyFiles()) {
    assert.doesNotMatch(read(file), /\b4 days\b|\b5 streams\b|5 open at once|a sixth (?:exits|is)/, `${file}: retention and streams are the plan's`);
  }
  for (const file of [apiReference('events-and-webhooks.md'), read(join('skills', 'chesly', 'references', 'commands.md'))]) {
    assert.match(file, /`limits\.event_retention_days`/);
    assert.match(file, /`limits\.event_streams`/);
  }
  assert.match(apiReference('events-and-webhooks.md'), /7 days on Personal, 30 on Pro/);
});

test('a_rate_limit_sample_quotes_a_real_limit', () => {
  // The 429 samples quote a per-minute limit; it must be a plan's (R124: 900 Personal, 1,800 Pro).
  for (const file of copyFiles()) {
    for (const [, limit] of read(file).matchAll(/more than ([\d,]+) requests in one minute/g)) {
      assert.ok(['900', '1,800', '1800'].includes(limit), `${file}: ${limit} a minute is no plan's limit`);
    }
  }
});

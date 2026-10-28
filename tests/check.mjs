// The repo's own checks: what the skills tell an agent must be true of the chesly CLI.
// Run with `npm test` (node:test, no dependencies).
//
// The facts below mirror the CLI (`chesly --help`). When the CLI changes, change them here first,
// then the skills: a skill that names a command, option or exit code the CLI lacks fails.

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
 * `logout` revokes its key from Wave 2 on. Every command also takes GLOBAL_OPTIONS.
 */
const CLI = {
  login: { wave: 1, options: { '--key': 1, '--no-wait': 2, '--wait': 2 } },
  logout: { wave: 2, options: {} },
  whoami: { wave: 1, options: {} },
  key: { wave: 1, options: { '--reveal': 1 } },
  accounts: { wave: 1, options: {} },
  chats: { wave: 1, options: { '--unread': 1, '--account': 1, '--limit': 1, '--cursor': 1, '--network': 2 } },
  read: { wave: 1, options: { '--limit': 1, '--cursor': 1, '--network': 2 } },
  search: { wave: 1, options: { '--chat': 1, '--limit': 1, '--network': 2 } },
  catchup: { wave: 1, options: { '--chats': 1, '--per-chat': 1, '--network': 2 } },
  send: { wave: 2, options: { '--reply-to': 2, '--file': 2, '--wait': 2, '--idempotency-key': 2, '--network': 2 } },
  watch: { wave: 2, options: { '--chat': 2, '--account': 2, '--types': 2, '--networks': 2, '--after': 2 } },
  webhooks: {
    wave: 2,
    subcommands: {
      list: {},
      create: { '--types': 2, '--networks': 2, '--payload': 2, '--description': 2 },
      delete: {},
      rotate: {},
      test: {},
      deliveries: { '--status': 2, '--limit': 2, '--cursor': 2 },
    },
  },
  keys: { wave: 2, subcommands: { list: {}, revoke: {} } },
  usage: { wave: 2, options: {} },
};
const GLOBAL_OPTIONS = ['--json', '--help'];
/** What `chesly` takes before a command. */
const TOP_LEVEL_OPTIONS = ['--version', '--help', '--json'];

/** The CLI's exit codes, each with words its description must use. */
const EXIT_CODES = [
  [0, /\bok\b/i],
  [1, /\berror\b/i],
  [2, /\busage\b/i],
  [3, /not signed in/i],
  [4, /not found/i],
  [5, /retry later/i],
  [6, /payment required/i],
];

/** The networks, as people name them and as the API does (`network`, `--network`). */
const NETWORK_NAMES = ['WhatsApp', 'iMessage', 'Instagram', 'Messenger', 'Telegram', 'Signal', 'Discord', 'Slack',
  'LinkedIn', 'X', 'Google Messages', 'Google Chat', 'Reddit', 'email'];
const NETWORK_IDS = ['whatsapp', 'imessage', 'instagram', 'messenger', 'telegram', 'signal', 'discord', 'slack',
  'linkedin', 'twitter', 'gmessages', 'googlechat', 'reddit', 'email'];

const SKILLS = {
  chesly: {
    description:
      "Read, search, watch and reply to the user's own messages across the chat networks and email they connected in Chesly, using the chesly CLI. Use when the user asks what they missed, about a chat or a person, who they owe a reply, to find a message, to answer someone, or to keep watching for new messages.",
    references: ['references/commands.md', 'references/recipes.md'],
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

const FENCE = /^([ \t]*)(```|~~~)([^\n]*)\n([\s\S]*?)^\1\2[ \t]*$/gm;
const INLINE_CODE = /(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;

/** Markdown split into its fenced code blocks, its inline code spans, and the prose around them. */
function parseMarkdown(markdown) {
  const blocks = [];
  const outside = markdown.replace(FENCE, (_, indent, fence, info, body) => {
    blocks.push(body);
    return '\n';
  });
  const inline = [];
  const prose = outside.replace(INLINE_CODE, (_, ticks, body) => {
    inline.push(body.trim());
    return ' ';
  });
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
      // YAML reads ": " or " #" in a plain value as structure or a comment, so such a value is quoted.
      assert.doesNotMatch(value, /: | #|^['>|&*!%@`{[]/, `${key} needs quotes`);
      fields[key] = value;
    }
  }
  return fields;
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
const COMMAND_START = /(?:^|\n|[|;&({`]|\$\()[ \t]*(?:[A-Z_][A-Z0-9_]*=\S*[ \t]+)*chesly(?=[\s)`]|$)/g;

/** The words of every `chesly …` command in a piece of shell, after `chesly`. */
function cheslyCommands(code) {
  return [...code.matchAll(COMMAND_START)].map((match) => wordsFrom(code, match.index + match[0].length));
}

/**
 * The words of one command from `from` on, as the shell splits them: quotes join, a `<placeholder>`
 * is one word, a `\` line end continues the command, and `[ ]` (optional parts) are dropped.
 */
function wordsFrom(code, from) {
  const words = [];
  let word = '';
  let quote = null;
  let depth = 0;
  for (let i = from; i < code.length; i++) {
    const ch = code[i];
    if (quote !== null) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
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
      if (word !== '') words.push(word);
      word = '';
    } else {
      word += ch;
    }
  }
  if (word !== '') words.push(word);
  return words.map((w) => w.replace(/^\[+|\]+$/g, '')).filter((w) => w !== '' && w !== '…' && w !== '...');
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

const problemsIn = (code) => cheslyCommands(code).flatMap(commandProblems);

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
      for (const words of cheslyCommands(code)) {
        for (const problem of commandProblems(words)) problems.push(`${file}: chesly ${words.join(' ')}: ${problem}`);
      }
    }
  }
  assert.deepEqual(problems, []);
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
  for (const file of ['README.md', join('skills', 'chesly', 'SKILL.md')]) {
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
});

test('the_chesly_skill_shows_the_text_and_waits_for_ok_before_sending', () => {
  assert.match(parseMarkdown(read(join('skills', 'chesly', 'SKILL.md'))).prose, ASK_BEFORE_SENDING);
});

test('every_command_the_chesly_skill_runs_passes_json', () => {
  for (const file of [join('skills', 'chesly', 'SKILL.md'), join('skills', 'chesly', 'references', 'recipes.md')]) {
    for (const code of codeOf(read(file))) {
      for (const words of cheslyCommands(code)) {
        if (words.length === 0 || words[0].startsWith('-') || (words[0] === 'key' && words.includes('--reveal'))) continue;
        assert.ok(words.includes('--json'), `${file}: chesly ${words.join(' ')} needs --json`);
      }
    }
  }
});

test('the_command_reference_covers_every_command_and_option', () => {
  const seen = new Set();
  for (const code of codeOf(read(join('skills', 'chesly', 'references', 'commands.md')))) {
    for (const words of cheslyCommands(code)) {
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
    const commands = codeOf(cell).flatMap(cheslyCommands);
    const wave2 = commands.some((words) => {
      const options = optionsOf(words) ?? {};
      return CLI[words[0]]?.wave === 2 || words.some((word) => options[word.split('=')[0]] === 2);
    });
    assert.equal(row.includes('(Wave 2)'), wave2, `${row}\nshould ${wave2 ? '' : 'not '}be marked (Wave 2)`);
  }
});

test('the_exit_codes_are_the_clis', () => {
  const table = section(read(join('skills', 'chesly', 'references', 'commands.md')), 'Exit codes');
  const rows = table.split('\n').filter((line) => /^\| `?\d+`? \|/.test(line));
  assert.deepEqual(rows.map((row) => Number(/\d+/.exec(row)[0])), EXIT_CODES.map(([code]) => code));
  for (const [index, [code, words]] of EXIT_CODES.entries()) assert.match(rows[index], words, `exit ${code}`);
  for (const file of skillFiles('chesly')) {
    for (const [, code] of read(file).matchAll(/\bexits? (?:with |code )?(\d+)\b/gi)) {
      assert.ok(Number(code) <= 6, `${file}: there is no exit code ${code}`);
    }
  }
});

test('the_command_reference_names_every_network', () => {
  const inline = parseMarkdown(read(join('skills', 'chesly', 'references', 'commands.md'))).inline;
  assert.deepEqual(NETWORK_IDS.filter((network) => !inline.includes(network)), []);
});

test('the_recipes_cover_the_planned_tasks', () => {
  const recipes = read(join('skills', 'chesly', 'references', 'recipes.md'));
  for (const title of ['What did I miss', 'Reply to the newest unread', 'Find who I owe a reply', 'Catch up on email',
    "Forward a voice note's transcript", 'Watch a chat and answer']) {
    assert.match(recipes, new RegExp(`^## ${title}`, 'm'), `a recipe for "${title}"`);
  }
  assert.ok(codeOf(section(recipes, 'Catch up on email')).includes('chesly catchup --network email --json'));
});

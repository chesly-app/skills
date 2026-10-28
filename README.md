# Chesly skills

Agent skills for [Chesly](https://agents.chesly.app). With them, your agent reads, searches, watches and answers your messages on WhatsApp, iMessage, Instagram, Messenger, Telegram, Signal, Discord, Slack, LinkedIn, X, Google Messages, Google Chat, Reddit and email: the accounts you connected in the Chesly app.

| Skill | What your agent learns |
|---|---|
| [`chesly`](skills/chesly/SKILL.md) | The `chesly` CLI: catch up, read, search, reply and watch |

## Install

```bash
npx skills add chesly-app/skills
```

The skills CLI asks which of your agents get them. `-g` installs them for every project, `-a claude-code` picks the agent, and `-y` skips its questions. It needs Node 22.20 or later.

The `chesly` skill then has your agent install the CLI and sign in:

```bash
npm install -g chesly
chesly login
```

You need the Chesly app with at least one account connected, and an API plan. The plan starts with a 7-day trial at [web.chesly.app/api/billing](https://web.chesly.app/api/billing).

## Development

`npm test` checks every skill: its name and description, its links, and every `chesly` command and option it names, against the CLI's.

---

Chesly is an independent product of Chesly, Inc. It is not affiliated with, endorsed by, or sponsored by any messaging service it works with. Product names are trademarks of their respective owners and are used only to describe compatibility. iMessage is a trademark of Apple Inc., registered in the U.S. and other countries and regions.

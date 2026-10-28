# Chesly skills

Agent skills for [Chesly](https://agents.chesly.app). With them, your agent reads, searches, watches and answers your messages on WhatsApp, iMessage, Instagram, Messenger, Telegram, Signal, Discord, Slack, LinkedIn, X, Google Messages, Google Chat, Reddit and email: the accounts you connected in the Chesly app.

| Skill | What your agent learns |
|---|---|
| [`chesly`](skills/chesly/SKILL.md) | The `chesly` CLI: catch up, read, search, reply and watch |
| [`chesly-api`](skills/chesly-api/SKILL.md) | The Chesly API for code and agent setups: REST, live events, signed webhooks and the MCP server |

## Install

You need the Chesly app with at least one account connected, and an API plan. The plan starts with a 7-day trial at [web.chesly.app/api/billing](https://web.chesly.app/api/billing).

### Any agent

```bash
npx skills add chesly-app/skills
```

The skills CLI asks which of your agents get them. `-g` installs them for every project, `-a claude-code` picks the agent, and `-y` skips its questions. It needs Node 22.20 or later.

The `chesly` skill then has your agent install the CLI and sign you in: it shows you a link, and you approve the code on it. In a terminal of your own, that is:

```bash
npm install -g chesly
chesly login
```

### Claude Code plugin

In Claude Code:

```text
/plugin marketplace add chesly-app/skills
/plugin install chesly@chesly
```

The plugin brings both skills and the Chesly MCP server. Claude Code asks for your API key once and keeps it in your system's credential store: run `chesly key --reveal` to print the key the CLI uses, or make one at [web.chesly.app/api/keys](https://web.chesly.app/api/keys). `/mcp` then lists the Chesly server.

## Development

- `npm test` checks every skill: its name and description, its links, and every `chesly` command and option, endpoint, MCP tool, event type, field and error code it names, against the product's. It also checks the plugin's manifests.
- `npm run validate` runs `claude plugin validate . --strict`, Claude Code's own check of the plugin and the marketplace.
- `claude --plugin-dir .` starts Claude Code with the plugin loaded from this folder, without installing it.

---

Chesly is an independent product of Chesly, Inc. It is not affiliated with, endorsed by, or sponsored by any messaging service it works with. Product names are trademarks of their respective owners and are used only to describe compatibility. iMessage is a trademark of Apple Inc., registered in the U.S. and other countries and regions.

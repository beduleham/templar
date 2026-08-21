# ign8t MCP server setup

The ign8t MCP server is declared in [`.mcp.json`](../.mcp.json) at project scope, so
every session that opens this repo picks it up automatically.

## Credentials

`.mcp.json` reads the API key from the `IGN8T_API_KEY` environment variable
(`${IGN8T_API_KEY}`). The key is **never** stored in this repository.

- **Claude Code on the web:** add `IGN8T_API_KEY` to the environment's variables.
- **Local shell:** `export IGN8T_API_KEY=...`, or copy `.env.example` to `.env`
  (git-ignored) and load it before launching.

If the variable is missing, `claude mcp list` reports
`Missing environment variables: IGN8T_API_KEY`.

## Network egress

The server talks to `https://ign8t.com/api/mcp`. That host must be on the
session's network egress allowlist. When it is blocked, the server process starts
and connects fine but every tool call returns:

```
Error: Host not in allowlist: ign8t.com. Add this host to your network egress
settings to allow access.
```

## First-run approval

Project-scoped MCP servers require a one-time trust approval per machine. On the
first session Claude Code shows `Pending approval`; approve it when prompted.

## Project

Default project ID for this repo: `9d635318-4ded-4a09-8dca-da9b0617eeca`
(also in `.env.example` as `IGN8T_PROJECT_ID`). It is an identifier, not a secret.

## Available tools

Package `@ign8t/mcp@0.1.2` exposes:

| Tool | Purpose |
| --- | --- |
| `list_projects` | List your ign8t projects |
| `get_project` | Project detail (requires `project_id`) |
| `get_documents` | BRD / PRD / TRD docs — `document_type`: `brd`, `prd`, `trd`, `all` |
| `get_backlog` | Epics, stories, tasks |
| `get_next_task` | Next recommended task |
| `update_task_status` | Set status: `todo`, `in_progress`, `review`, `done`, `blocked` |
| `search_tasks` | Search tasks |
| `get_task_context` | Full context for one task |

> **Note:** there is no `get_specs` tool and no `master_spec` document type in the
> published package. The nearest equivalent is
> `get_documents(project_id=..., document_type="all")`.

# Paseo SDK, plugin RPC, daemon logs

Use the SDK for normal Paseo operations and a plugin RPC for plugin-specific backend work. Contract: [reference.md → Use the Paseo SDK](https://paseo.sh/docs/plugins/reference.md#use-the-paseo-sdk), [Add plugin-specific backend behavior](https://paseo.sh/docs/plugins/reference.md#add-plugin-specific-backend-behavior), [Debug backend output](https://paseo.sh/docs/plugins/reference.md#debug-backend-output).

## Choose the correct API

Use the existing Paseo SDK for normal Paseo operations. Use plugin RPC only for plugin-specific backend behavior.

### Call Paseo from a surface

`usePaseo()` borrows the selected host's current connection. Never create another client inside a surface. It is the plugin's one client in every surface: release your subscriptions in your cleanup; plugin teardown ends the rest.

```tsx
import { usePaseo } from "@getpaseo/plugin/client";

function PullRequestAction() {
  const paseo = usePaseo();

  async function createReviewWorkspace() {
    const workspace = await paseo.workspaces.create({
      title: "Review PR 42",
      source: {
        kind: "worktree",
        cwd: "/absolute/path/to/repository",
        action: "checkout",
        checkoutSource: { kind: "change_request", forge: "github", number: 42 },
      },
    });
    await workspace.agents.create({
      config: { provider: "codex/gpt-5.5" },
      prompt: "Review PR #42.",
    });
  }

  // Wire createReviewWorkspace to a Pressable.
  return null;
}
```

The API covers workspaces, agents, providers, and daemon config. It omits connection lifecycle because Paseo owns the connection. Consult the current [SDK reference](https://paseo.sh/docs/sdk/reference.md) for method details.

### Add daemon-side behavior

Define one Zod contract in `shared/`, register its subprocess handler in `index.server.ts`, and
call it from client code with `useRpc()`:

```ts
// shared/greeting.ts
import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const greeting = defineRpc({
  name: "greeting.create",
  input: z.object({ name: z.string() }),
  output: z.object({ message: z.string() }),
});
```

```ts
// server/greeting.ts
import type { RpcInput } from "@getpaseo/plugin";
import { greeting } from "../shared/greeting";

export async function createGreeting({ name }: RpcInput<typeof greeting>) {
  return { message: `Hello, ${name}!` };
}
```

```ts
// index.server.ts
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createGreeting } from "./server/greeting";
import { greeting } from "./shared/greeting";

export default function contribute(server: PluginServerContext) {
  server.handle(greeting, createGreeting);
  return () => {};
}
```

```tsx
// client/greeting.tsx
import { useRpc } from "@getpaseo/plugin/client";
import { greeting } from "../shared/greeting";

function Greeting() {
  const createGreeting = useRpc(greeting);
  // Use createGreeting({ name: "Ada" }) in a query, mutation, or event.
  return null;
}
```

Inputs and outputs are validated on both sides. Backend handlers receive the same `PaseoApi` as `{ paseo }`; their IPC-backed daemon session lives exactly as long as the subprocess. Backend code can use Node APIs and installed dependencies. Keep credentials, filesystem access, shell commands, and vendor API calls in the handler rather than the client surface.

Use TanStack Query for async request state, caching, and mutations.

### Stream events from the daemon

Use `defineSubscription` when a plugin panel needs live push updates rather than polling a query. Each subscriber has its own subprocess handler; it runs until the subscriber releases, the panel unmounts, the host disconnects, or the plugin stops. On reconnect, mounted `useSubscription` hooks subscribe again. Events are ordered, with no replay of missed events.

```ts
// shared/changes.ts
import { defineSubscription } from "@getpaseo/plugin";
import { z } from "zod";

export const changes = defineSubscription({
  name: "changes.watch",
  input: z.object({ path: z.string() }),
  event: z.object({ path: z.string(), kind: z.enum(["added", "modified", "deleted"]) }),
});
```

```ts
// index.server.ts
server.handle(changes, ({ path }, { push, signal }) => {
  const watcher = watchPath(path, (kind) => { void push({ path, kind }); });
  signal.addEventListener("abort", () => watcher.close(), { once: true });
});
```

`watchPath` is illustrative; implement it with a real watcher in the plugin's `server/` directory. In a React panel, call `useSubscription(changes, { path }, onEvent)` and inspect its `connecting | live | closed | error` status. For imperative subscriptions in client setup use `client.subscribe(changes, input, onEvent)` and release the returned handle in cleanup.

An RPC input/output or subscription event that is a **top-level** `Uint8Array` is transported as binary; a nested `Uint8Array` is invalid. Define byte contracts with `z.instanceof(Uint8Array)`. See the working `plugin-examples/diff-watch` and `plugin-examples/media-stream` for real subscribe and byte-RPC examples. Do not build a second transport or poll a subscription from the UI.

### Scoped agent tools and session MCP servers

Use the existing `server.before("agent.session_open", ...)` hook to attach tools or MCP servers
to **selected** agent sessions. Unlike `agent.create`, these contributions do not mutate saved
agent settings. They are rederived when a session is opened, resumed, imported, or reloaded.

```ts
import { defineAgentTool, type PluginServerContext } from "@getpaseo/plugin/server";
import { z } from "zod";

const noteTool = defineAgentTool({
  name: "save_note",
  description: "Save a short note for this agent",
  input: z.object({ note: z.string().min(1) }),
  async execute({ note }, { agent, signal }) {
    signal.throwIfAborted();
    // Store the note in plugin-owned storage here.
    return { text: `Received a note from ${agent.id}: ${note}` };
  },
});

export default function contribute(server: PluginServerContext) {
  server.before("agent.session_open", ({ request }) => {
    if (request.labels["notes/enabled"] !== "true") return;
    return { ...request, tools: [...request.tools, noteTool] };
  });
  return () => {};
}
```

The `execute` callback receives the validated input, the originating agent, a Paseo API handle,
and a cancellation signal. Tool names use lowercase letters, digits, and underscores. Names
colliding with built-in/compatibility names or other plugins are rejected.

For MCP servers, return `{ ...request, mcpServers: { ...request.mcpServers,
company: { type: "http", url: "https://your-real-mcp-server.example/mcp" } } }`
only for selected agents. The placeholder URL must be replaced with a real service.
A session-open MCP server name cannot override saved agent configuration, another plugin's server,
or Paseo's internal MCP endpoint. Unsupported providers are rejected. Disable/reload marks the
existing session stale: it reopens on its **next idle prompt**, not in the middle of a turn.
Explicit `paseo.agents.ref(id).reload()` reopens immediately and may interrupt a running turn.
History-only opens do not attach tools or plugin MCP servers.

Working examples: `plugin-examples/agent-tools` and `plugin-examples/session-mcp`.
No parallel tool transport or persisted plugin MCP config is needed.

### Debug daemon-side behavior

Backend contributions can use normal Node logging. `console.log()` writes to the plugin's stdout;
`console.error()` writes to stderr. Paseo captures both streams without interfering with plugin IPC.

Inspect recent output after install, reload, an RPC failure, or a subprocess crash:

```bash
paseo plugin logs my-plugin
paseo plugin logs my-plugin --json
paseo plugin logs my-plugin --host <url>
```

The same tail is available from **Settings → Plugins → Logs**. It includes initialization, handler,
cleanup, and final crash output. Reload, disable, and process failure retain the tail. Removing the
plugin clears it; restarting the daemon clears the in-memory tail. Structured copies also go to the
daemon log. Never log credentials or other secrets.

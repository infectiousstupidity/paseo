# Plugin UI surfaces

Worked examples for workspace panels, screens with sidebar items, and themes. The mechanics behind them: [reference.md → Screens and sidebar items](https://paseo.sh/docs/plugins/reference.md#screens-and-sidebar-items), [Workspace panels](https://paseo.sh/docs/plugins/reference.md#workspace-panels), [Contribute a theme](https://paseo.sh/docs/plugins/reference.md#contribute-a-theme).

## Add a workspace panel

Workspace panels live beside agents, terminals, files, and diffs. Plugins run on desktop and
mobile, and Paseo has multiple themes. Every `Text` must take its color from `theme.colors`.
Use `layout.compact` for padding and stacking. Unstyled text is black and fails in dark themes.

```tsx
import {
  type PluginClientContext,
  type PluginWorkspacePanelProps,
  useWorkspace,
} from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Text, View } from "react-native";

function Overview({ theme, layout, workspaceId }: PluginWorkspacePanelProps) {
  const name = useWorkspace(workspaceId, (workspace) => workspace.name);
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        padding: layout.compact ? 16 : 24,
        gap: layout.compact ? 8 : 12,
        backgroundColor: theme.colors.surface0,
      },
      title: { color: theme.colors.foreground, fontSize: layout.compact ? 20 : 24 },
    }),
    [theme, layout.compact],
  );
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{name}</Text>
    </View>
  );
}

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "overview",
    title: "Workspace overview",
    icon: "PanelsTopLeft",
    context: "workspace",
    Component: Overview,
  });
  client.addCommandCenterItem({
    id: "open-overview",
    title: "Open workspace overview",
    icon: "PanelsTopLeft",
    context: "workspace",
    onSelect({ openPanel }) {
      openPanel("overview");
    },
  });
  return () => {};
}
```

Use `useWorkspace(id, selector)` and `useAgent(id, selector)`. Selectors are required
and their results use shallow equality. Never select the whole snapshot or add an RPC to discover
the active workspace or agent. Command callbacks receive the selected host's `paseo`, typed
`rpc(contract, input)`, `openScreen({ screenId, params? })`, and contextual `openPanel(id)`
capabilities.

## File panels

Register `addFilePanel` to view or edit matching files inside the existing file tab. Read the
checkout's `public-docs/plugins/reference.md` → File panels for the file handle, tab lifecycle,
selectors, and conflict contracts. Use `plugin-examples/pdf-panel` for a document viewer or
`plugin-examples/markdown-panel` for an editor. File hooks come from `@getpaseo/plugin/client`;
host presentation components, including `DocumentFrame` and `Loading`, come from
`@getpaseo/plugin/client/ui`.

## Add a screen and a sidebar item

Plugin screens use React Native primitives and work across desktop, browser, iOS, and Android. A sidebar item, in the header or the footer, is a component: render one or more `SidebarRow`s from `@getpaseo/plugin/client/ui`, with `SidebarSeparator` between groups, and call `openScreen` or `openPopover` from them. A screen's `title` is a string or a function of its `params`; its component receives the `params` it was opened with. Color text from `theme.colors` and pad from `layout.compact`.

```tsx
import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

function Counter({ theme, layout }: PluginScreenProps) {
  const [count, setCount] = useState(0);
  const styles = useMemo(
    () => ({
      screen: {
        flex: 1,
        padding: layout.compact ? 16 : 24,
        gap: 16,
        backgroundColor: theme.colors.surface0,
      },
      count: { color: theme.colors.foreground, fontSize: layout.compact ? 36 : 48 },
      button: { padding: 14, borderRadius: 10, backgroundColor: theme.colors.accent },
      buttonText: { color: theme.colors.accentForeground, textAlign: "center" as const },
    }),
    [theme, layout.compact],
  );
  return (
    <View style={styles.screen}>
      <Text style={styles.count}>{count}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increment counter, currently ${count}`}
        onPress={() => setCount((value) => value + 1)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Count me in</Text>
      </Pressable>
    </View>
  );
}

function CounterItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListPlus"
      active={currentScreen?.screenId === "main"}
      onPress={() => openScreen({ screenId: "main" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "main", title: "Counter", Component: Counter });
  client.addSidebarHeaderItem({ id: "main", title: "Counter", Component: CounterItem });
  return () => {};
}
```

Icons are Lucide icon names, inline SVG (`{ svg }`), or components; see [Icons](https://paseo.sh/docs/plugins/reference.md#icons). `theme` is a typed `PluginTheme` on every screen and panel. Primary text uses `theme.colors.foreground`; labels use `theme.colors.foregroundMuted`; the root view uses `theme.colors.surface0`. `layout.compact` is true on mobile and narrow windows. Paseo owns the route, header, host picker, close action, error boundary, and per-installation query client.

Before writing imports, classify each module as shared, client, or server. Follow the
[SDK import boundaries](https://paseo.sh/docs/plugins/reference.md#runtime-modules), including
transitive and type dependencies. The root is shared-only; hooks and client contexts belong to
`@getpaseo/plugin/client`, server contexts to `/server`, and host UI to `/client/ui`.
Install dependencies locally for typechecking; Paseo supplies host runtime modules. JSX uses the
automatic runtime. Do not import `/client/host` from plugin code.

## Contribute a theme

`addTheme` takes a small light or dark palette; Paseo expands it into the full token set. Every color is a hex string.

```ts
client.addTheme({
  id: "mocha",
  name: "Catppuccin Mocha",
  appearance: "dark",
  colors: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    raised: "#313244",
    control: "#45475a",
    border: "#45475a",
    accent: "#cba6f7",
    mutedForeground: "#a6adc8",
    ring: "#6c7086",
  },
});
```

It appears under Settings → Appearance. A client that predates `addTheme` cannot evaluate the entry and reports `client.addTheme is not a function`; update the client. See `plugin-examples/catppuccin`.

## Host selection

When the same screen or sidebar item exists on several connected hosts, Paseo shows it once. The screen header has a host picker; a sidebar item uses the host of the screen on display, else the host last picked in one of the plugin's screens. The selected host owns the bundle, SDK calls, RPCs, and query cache. An offline selected host does not fall through to another host. Attachment sources stay scoped to the composer's host.

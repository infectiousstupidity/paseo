import { expect, test, vi } from "vitest";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { syncPluginCatalog } from "./catalog-sync-model";
import type { PluginRegistry } from "./registry";

test("temporary disconnect retains installations, stops observation, and reconciles on reconnect", async () => {
  const catalog = [{ id: "notes", clientBundle: "bundle", requirements: { paseo: ">=0.8.0" } }];
  let installed = catalog;
  let snapshot = [{ serverId: "host", id: "notes", queryClient: { invalidateQueries: vi.fn() } }];
  const installCatalog = vi.fn(() => {
    snapshot = [...snapshot];
    return false;
  });
  const removeHost = vi.fn(() => { installed = []; });
  const setCatalogStatus = vi.fn();
  const registry = {
    installCatalog,
    removeHost,
    setCatalogStatus,
    getSnapshot: () => snapshot,
  } as unknown as Pick<
    PluginRegistry,
    "installCatalog" | "removeHost" | "getSnapshot" | "setCatalogStatus"
  >;
  const observers = new Set<{ snapshot: () => void; update: (event: unknown) => void }>();
  let releases = 0;
  const fetch = vi.fn(async () => catalog);
  const client = {
    getPluginCatalog: fetch,
    observeEvents: () => {
      const subscribers = new Set<(typeof observers extends Set<infer T> ? T : never)>();
      return {
        subscribe(observer: (typeof observers extends Set<infer T> ? T : never)) {
          subscribers.add(observer);
          observers.add(observer);
          observer.snapshot();
          return () => subscribers.delete(observer);
        },
        release: async () => {
          releases++;
          for (const observer of subscribers) observers.delete(observer);
          subscribers.clear();
        },
      };
    },
  } as unknown as DaemonClient;

  const options = { serverId: "host", client, audio: { play: async () => 0 }, supported: true, registry };
  const stop = syncPluginCatalog({ ...options, connected: true });
  await expect.poll(() => fetch.mock.calls.length).toBe(1);
  await expect.poll(() => installCatalog.mock.calls.length).toBe(1);
  const retained = snapshot;
  stop();
  await expect.poll(() => releases).toBe(1);

  const disconnectedStop = syncPluginCatalog({ ...options, connected: false });
  expect(removeHost).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(snapshot).toBe(retained);
  disconnectedStop();

  const reconnectedStop = syncPluginCatalog({ ...options, connected: true });
  await expect.poll(() => fetch.mock.calls.length).toBe(2);
  await expect.poll(() => installCatalog.mock.calls.length).toBe(2);
  expect(removeHost).not.toHaveBeenCalled();
  expect(setCatalogStatus).toHaveBeenCalledWith("host", "ready");

  reconnectedStop();
  await expect.poll(() => releases).toBe(2);
  for (const observer of observers) observer.update({ type: "status", payload: { status: "plugin_catalog_changed", pluginId: "notes" } });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(installed).toHaveLength(1);
});

test("unavailable plugin support removes stale installations", () => {
  const removeHost = vi.fn();
  const setCatalogStatus = vi.fn();
  const noopRegistry = { removeHost, setCatalogStatus } as unknown as Pick<
    PluginRegistry, "installCatalog" | "removeHost" | "getSnapshot" | "setCatalogStatus"
  >;
  const cleanup = syncPluginCatalog({
    serverId: "host",
    client: {} as DaemonClient,
    audio: { play: async () => 0 },
    connected: false,
    supported: false,
    registry: noopRegistry,
  });
  expect(removeHost).toHaveBeenCalledOnce();
  expect(setCatalogStatus).toHaveBeenCalledWith("host", "ready");
  cleanup();
});

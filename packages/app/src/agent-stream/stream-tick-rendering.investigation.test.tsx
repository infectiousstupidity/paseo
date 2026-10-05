/**
 * @vitest-environment jsdom
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTENT_MAX_WIDTH } from "@/styles/theme";
import type { StreamItem } from "@/types/stream";
import { buildAgentStreamRenderModel } from "./model";
import type { StreamSegmentRenderers, StreamViewportHandle } from "./strategy";
import { createWebStreamStrategy } from "./strategy-web";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: false,
      media: "",
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    }),
  });
});

vi.mock("react-native-unistyles", () => ({
  StyleSheet: { create: () => ({}) },
  withUnistyles: (Component: React.ComponentType) => Component,
}));

function userMessage(index: number): StreamItem {
  return {
    kind: "user_message",
    id: `u-${index}`,
    text: `Prompt ${index}`,
    timestamp: new Date(1_700_000_000_000 + index * 1000),
  };
}

function liveAssistant(text: string): StreamItem {
  return {
    kind: "assistant_message",
    id: "live",
    text,
    timestamp: new Date(1_700_001_000_000),
  };
}

describe("#4816 bounded-history rendering regression", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
      configurable: true,
    });
    HTMLElement.prototype.scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 24;
      },
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it("does not render committed rows again when only the live head grows", () => {
    const tail = Array.from({ length: 40 }, (_, index) => userMessage(index));
    const firstModel = buildAgentStreamRenderModel({
      isTurnActive: true,
      activeTurnStartedAt: tail.at(-1)?.timestamp ?? null,
      tail,
      head: [liveAssistant("a")],
      platform: "web",
      isMobileBreakpoint: false,
      historyStart: 20,
    });
    const secondModel = buildAgentStreamRenderModel({
      isTurnActive: true,
      activeTurnStartedAt: tail.at(-1)?.timestamp ?? null,
      tail,
      head: [liveAssistant("ab")],
      platform: "web",
      isMobileBreakpoint: false,
      historyStart: 20,
    });

    const historyRowRender = vi.fn((item: StreamItem) => <div>{item.id}</div>);
    const renderers: StreamSegmentRenderers = {
      renderHistoryVirtualizedRow: historyRowRender,
      renderHistoryMountedRow: historyRowRender,
      renderLiveHeadRow: (item) => <div>{item.id}</div>,
      renderLiveAuxiliary: () => null,
    };
    const strategy = createWebStreamStrategy({ isMobileBreakpoint: false });
    const viewportRef = React.createRef<StreamViewportHandle>();

    const renderModel = (model: typeof firstModel) =>
      strategy.render({
        agentId: "agent",
        segments: model.segments,
        boundary: model.boundary,
        renderers,
        listEmptyComponent: null,
        viewportRef,
        routeBottomAnchorRequest: null,
        isAuthoritativeHistoryReady: true,
        onNearBottomChange: vi.fn(),
        onNearHistoryStart: vi.fn().mockReturnValue(true),
        isLoadingOlderHistory: false,
        hasOlderHistory: false,
        olderHistoryProgressKey: null,
        scrollEnabled: true,
        listStyle: null,
        baseListContentContainerStyle: null,
        forwardListContentContainerStyle: null,
        contentMaxWidth: DEFAULT_CONTENT_MAX_WIDTH,
      });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(renderModel(firstModel)));
    const firstRenderCount = historyRowRender.mock.calls.length;
    expect(firstRenderCount).toBeGreaterThan(0);

    act(() => root?.render(renderModel(secondModel)));

    expect(historyRowRender).toHaveBeenCalledTimes(firstRenderCount);
  });
});

import type { AgentAddress } from "@getpaseo/protocol/addresses";
import { useHosts } from "@/runtime/host-runtime";
import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
  type ReactElement,
} from "react";
import { Text, View } from "react-native";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Archive, ChevronDown, Unlink } from "lucide-react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { useStoreWithEqualityFn } from "zustand/traditional";
import equal from "fast-deep-equal";
import { useProviderIcon } from "@/components/provider-icons";
import { useSessionStore } from "@/stores/session-store";
import { ComposerTrackActions, ComposerTrackPill, ComposerTrackRow } from "@/composer/tracks";
import {
  smallIconButtonChromeFrameSize,
  mutedIconColorMapping,
} from "@/components/ui/icon-button-chrome";
import { ToolbarButton, paneContentToolbarIconSize } from "@/components/ui/pane-content-toolbar";
import { useIsCompactFormFactor } from "@/constants/layout";
import { isNative, isWeb } from "@/constants/platform";
import {
  WorkspaceTabIcon,
  type WorkspaceTabPresentation,
} from "@/screens/workspace/workspace-tab-presentation";
import type { Theme } from "@/styles/theme";
import { useAgentFactsLine } from "@/panels/agent-facts-line";
import { getPanelManifest } from "@/panels/panel-manifest";
import type { SubagentRow } from "./select";
import type { ArchiveFinishedStatus } from "./use-archive-finished";
import {
  deriveSubagentActivity,
  formatSubagentAge,
  type SubagentActivity,
} from "./subagent-activity";
import { providerSubagentKey, useProviderSubagentStore } from "./provider-store";
import { useMenuContext } from "@/components/ui/menu";
import { SubagentExpandedDetails } from "./expanded-details";
import {
  buildSubagentPillPresentation,
  buildSubagentRowPresentationData,
  countFinishedSubagents,
  groupSubagentRows,
  resolveSubagentState,
  subagentRuntimeLabel,
  type SubagentStateWord,
} from "./track-presentation";

const ThemedChevron = withUnistyles(ChevronDown);
const ThemedArchive = withUnistyles(Archive);
const ThemedUnlink = withUnistyles(Unlink);

const foregroundColorMapping = (theme: Theme) => ({ color: theme.colors.foreground });
const foregroundMutedColorMapping = (theme: Theme) => ({
  color: theme.colors.foregroundMuted,
});

export interface SubagentsTrackProps {
  serverId: string;
  rows: SubagentRow[];
  onOpenSubagent: (address: AgentAddress) => void;
  onOpenProviderSubagent: (parentAgentId: string, subagentId: string) => void;
  /**
   * Whether opening this row shows it in a sheet. A sheet stacks over the list and uncovers it on
   * close, so the list stays open; a tab replaces the list's pane, so choosing it ends the list.
   */
  opensInSheet: (row: SubagentRow) => boolean;
  onArchiveSubagent: (address: AgentAddress) => void;
  onArchiveFinished?: () => void;
  archiveFinishedStatus?: ArchiveFinishedStatus;
  onDetachSubagent?: (address: AgentAddress) => void;
}

const IDLE_ARCHIVE_FINISHED_STATUS: ArchiveFinishedStatus = { kind: "idle" };

const ROW_ICON_SIZE = 14;

const NONE_ACTIVITY: SubagentActivity = { kind: "none" };

/**
 * The row's newest meaningful event, from timeline the client already streamed. Only the owning
 * row subscribes, and only re-renders when the derived label actually changes — a token streaming
 * into an assistant message leaves a running child's label (its newest tool call) untouched.
 * Managed children have no timeline in this store, so they report none.
 */
function useSubagentActivity(serverId: string, row: SubagentRow): SubagentActivity {
  const descriptorActivity = row.kind === "provider" ? row.activity : null;
  return useStoreWithEqualityFn(
    useProviderSubagentStore,
    (state) => {
      if (row.kind !== "provider") return NONE_ACTIVITY;
      const tail = state.timelines.get(
        providerSubagentKey(serverId, row.parentAgentId, row.id),
      )?.tail;
      return deriveSubagentActivity(tail, row.status === "running", descriptorActivity);
    },
    equal,
  );
}

function useRowPresentation(row: SubagentRow, serverId: string): WorkspaceTabPresentation {
  const icon = useProviderIcon(row.provider, serverId);
  const data = buildSubagentRowPresentationData(row);
  return {
    ...data,
    tooltip: data.label,
    modified: false,
    showCloseButton: getPanelManifest(data.kind).showCloseButton,
    icon,
  };
}

export function SubagentsTrack({
  serverId,
  rows,
  onOpenSubagent,
  onOpenProviderSubagent,
  opensInSheet,
  onArchiveSubagent,
  onArchiveFinished,
  archiveFinishedStatus = IDLE_ARCHIVE_FINISHED_STATUS,
  onDetachSubagent,
}: SubagentsTrackProps): ReactElement | null {
  const { t } = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [stoppingKeys, setStoppingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const client = useSessionStore((state) => state.sessions[serverId]?.client ?? null);
  const supportsControls = useSessionStore(
    (state) => state.sessions[serverId]?.serverInfo?.features?.providerSubagentControls === true,
  );
  const groups = groupSubagentRows(rows);

  useEffect(() => {
    setExpandedKey(null);
    setStoppingKeys(new Set());
  }, [serverId]);

  useEffect(() => {
    // Stop remains pending after RPC acceptance until an observed terminal child update.
    const runningKeys = new Set(
      rows.filter((row) => resolveSubagentState(row) === "running").map(subagentTrackKey),
    );
    setStoppingKeys((previous) => {
      const next = new Set([...previous].filter((key) => runningKeys.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);
  const toggleDetails = useCallback((key: string) => {
    setExpandedKey((previous) => (previous === key ? null : key));
  }, []);
  const markStopping = useCallback((key: string) => {
    setStoppingKeys((previous) => new Set(previous).add(key));
  }, []);

  const isArchivingFinished = archiveFinishedStatus.kind === "archiving";
  const isArchiveFinishedFailed = archiveFinishedStatus.kind === "failed";
  if (rows.length === 0 && !isArchivingFinished && !isArchiveFinishedFailed) {
    return null;
  }

  const pill = buildSubagentPillPresentation(t, rows);
  const finishedCount = countFinishedSubagents(rows);
  const showArchiveFinished = finishedCount > 0 || isArchivingFinished || isArchiveFinishedFailed;

  return (
    <ComposerTrackPill
      testID="subagents-track-header"
      segments={pill.segments}
      accessibilityLabel={pill.accessibilityLabel}
      panelTitle={t("subagents.title")}
      widePanel
    >
      {(
        [
          ["attention", groups.attention, t("subagents.panel.needsAttention")],
          ["working", groups.working, t("subagents.panel.working")],
          ["recent", groups.recent, t("subagents.panel.recentResults")],
        ] as const
      ).map(([section, sectionRows, label]) =>
        sectionRows.length > 0 ? (
          <View key={section} style={styles.section} testID={`subagents-track-section-${section}`}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{label}</Text>
              <Text style={styles.sectionCount}>{sectionRows.length}</Text>
            </View>
            {sectionRows.map((row) => {
              const key = subagentTrackKey(row);
              return (
                <SubagentsTrackRow
                  key={key}
                  row={row}
                  serverId={serverId}
                  client={client}
                  supportsControls={supportsControls}
                  expanded={expandedKey === key}
                  stopping={stoppingKeys.has(key)}
                  onToggleDetails={toggleDetails}
                  onStopAccepted={markStopping}
                  onOpenSubagent={onOpenSubagent}
                  onOpenProviderSubagent={onOpenProviderSubagent}
                  opensInSheet={opensInSheet(row)}
                  onArchiveSubagent={onArchiveSubagent}
                  onDetachSubagent={onDetachSubagent}
                />
              );
            })}
          </View>
        ) : null,
      )}
      {showArchiveFinished && onArchiveFinished ? (
        <ComposerTrackActions divided={rows.length > 0}>
          <ArchiveFinishedRow
            status={archiveFinishedStatus}
            disabled={isArchivingFinished}
            onPress={onArchiveFinished}
          />
        </ComposerTrackActions>
      ) : null}
    </ComposerTrackPill>
  );
}

/** Bulk archive lives below results: secondary to understanding and controlling active work. */
function ArchiveFinishedRow({
  status,
  disabled,
  onPress,
}: {
  status: ArchiveFinishedStatus;
  disabled: boolean;
  onPress: () => void;
}): ReactElement {
  const { t } = useTranslation();

  const renderRow = useCallback(
    ({ active }: { active: boolean }) => (
      <>
        <ThemedArchive
          size={ROW_ICON_SIZE}
          uniProps={active ? foregroundColorMapping : foregroundMutedColorMapping}
        />
        <Text style={styles.rowLabel} numberOfLines={1}>
          {t("subagents.archiveFinishedAction")}
        </Text>
        {status.kind === "archiving" ? (
          <Text style={styles.rowTrailing} testID="subagents-track-archive-progress">
            {status.completedCount}/{status.totalCount}
          </Text>
        ) : null}
        {status.kind === "failed" ? (
          <Text style={styles.rowTrailing} testID="subagents-track-archive-failed">
            {t("subagents.archiveFinishedRetry", {
              failed: status.failedCount,
              total: status.totalCount,
            })}
          </Text>
        ) : null}
      </>
    ),
    [status, t],
  );

  return (
    <ComposerTrackRow
      accessibilityLabel={t("subagents.archiveFinishedAction")}
      testID="subagents-track-archive-finished"
      disabled={disabled}
      // Progress and the retry count land on this row, so the panel is where the result of
      // pressing it shows up. Dismissing would hide the thing the press produces.
      closeOnSelect={false}
      onPress={onPress}
    >
      {renderRow}
    </ComposerTrackRow>
  );
}

function subagentTrackKey(row: SubagentRow): string {
  return row.kind === "provider"
    ? `provider:${row.parentAgentId}:${row.id}`
    : `paseo:${row.address.serverId}:${row.id}`;
}

interface SubagentsTrackRowProps {
  serverId: string;
  row: SubagentRow;
  client: DaemonClient | null;
  supportsControls: boolean;
  expanded: boolean;
  stopping: boolean;
  onToggleDetails: (key: string) => void;
  onStopAccepted: (key: string) => void;
  onOpenSubagent: (address: AgentAddress) => void;
  onOpenProviderSubagent: (parentAgentId: string, subagentId: string) => void;
  opensInSheet: boolean;
  onArchiveSubagent: (address: AgentAddress) => void;
  onDetachSubagent?: (address: AgentAddress) => void;
}

const STATE_WORD_KEYS: Record<SubagentStateWord, string> = {
  running: "subagents.stateRunning",
  finished: "subagents.stateFinished",
  failed: "subagents.stateFailed",
  canceled: "subagents.stateCanceled",
};

function SubagentsTrackRow({
  serverId,
  row,
  client,
  supportsControls,
  expanded,
  stopping,
  onToggleDetails,
  onStopAccepted,
  onOpenSubagent,
  onOpenProviderSubagent,
  opensInSheet,
  onArchiveSubagent,
  onDetachSubagent,
}: SubagentsTrackRowProps): ReactElement {
  const { t } = useTranslation();
  const { selectItem } = useMenuContext("SubagentsTrackRow");
  const isCompact = useIsCompactFormFactor();
  const rowServerId = row.kind === "paseo" ? row.address.serverId : serverId;
  const hostLabel = useHosts().find((host) => host.serverId === rowServerId)?.label ?? rowServerId;
  const presentation = useRowPresentation(row, rowServerId);
  const displayLabel =
    presentation.titleState === "loading" ? t("common.states.loading") : presentation.label;
  const state = resolveSubagentState(row);
  const stateWord = state ? t(STATE_WORD_KEYS[state]) : null;
  const age = formatSubagentAge(row.createdAt, new Date());
  const activity = useSubagentActivity(serverId, row);
  // Managed children have no timeline in this store; a "no activity" line for them would just be
  // noise next to a session that is one press away.
  const shownActivity = row.kind === "provider" ? activity : null;
  // Dense rows use one meaningful outcome/activity line; exact metadata is available on expansion.
  const runtime = subagentRuntimeLabel(row);
  // A Paseo agent has no provider subtitle, so its row leads with the same facts line the agent's
  // sheet shows under its title: model, thinking, mode, context usage.
  const factsLine = useAgentFactsLine(rowServerId, row.id);
  const lead = row.kind === "paseo" ? (factsLine ?? presentation.subtitle) : presentation.subtitle;
  const context = [
    rowServerId !== serverId ? hostLabel : null,
    lead,
    runtime,
    age ? t("subagents.panel.startedAgo", { age }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const metadata = subagentActivityText(shownActivity, state, t);
  const key = subagentTrackKey(row);
  const handleToggleDetails = useCallback(() => onToggleDetails(key), [key, onToggleDetails]);
  const handleStopAccepted = useCallback(() => onStopAccepted(key), [key, onStopAccepted]);
  const [hovered, setHovered] = useState(false);
  const actionsAlwaysVisible = isNative || isCompact;
  const actionsVisible = actionsAlwaysVisible || hovered;
  const handleOpenSession = useCallback(() => {
    selectItem(() => {
      if (row.kind === "provider") {
        onOpenProviderSubagent(row.parentAgentId, row.id);
      } else {
        onOpenSubagent(row.address);
      }
    }, !opensInSheet);
  }, [onOpenProviderSubagent, onOpenSubagent, row, selectItem, opensInSheet]);
  const handleArchivePress = useCallback(() => {
    if (row.kind === "paseo") onArchiveSubagent(row.address);
  }, [onArchiveSubagent, row]);
  const handleDetachPress = useCallback(() => {
    if (row.kind === "paseo") onDetachSubagent?.(row.address);
  }, [onDetachSubagent, row]);
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const renderRow = useCallback(
    ({ active }: { active: boolean }) => (
      <>
        <WorkspaceTabIcon presentation={presentation} backdrop={active ? "surface2" : "surface1"} />
        <View
          style={
            row.kind === "paseo" ? [styles.rowBody, styles.rowBodyWithActions] : styles.rowBody
          }
        >
          <View style={styles.rowLabelRow}>
            <Text
              style={styles.rowLabel}
              numberOfLines={2}
              testID={`subagents-track-label-${row.id}`}
            >
              {displayLabel}
            </Text>
            {stateWord && (state !== "finished" || expanded) ? (
              <Text style={stateWordStyle(state)} numberOfLines={1}>
                {stopping && state === "running" ? t("subagents.panel.stopping") : stateWord}
              </Text>
            ) : null}
          </View>
          {context ? (
            <Text
              style={styles.rowMeta}
              numberOfLines={1}
              testID={`subagents-track-context-${row.id}`}
            >
              {context}
            </Text>
          ) : null}
          {metadata ? (
            <Text
              style={styles.rowMeta}
              numberOfLines={1}
              testID={`subagents-track-activity-${row.id}`}
            >
              {metadata}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.disclosureIcon,
            row.kind === "paseo" &&
              styles.disclosureActionSpace(
                smallIconButtonChromeFrameSize(isCompact) * (onDetachSubagent ? 2 : 1) +
                  (onDetachSubagent ? 4 : 0),
              ),
          ]}
        >
          <ThemedChevron
            size={18}
            uniProps={expanded ? foregroundColorMapping : foregroundMutedColorMapping}
            style={expanded ? styles.disclosureOpen : undefined}
          />
        </View>
      </>
    ),
    [
      context,
      displayLabel,
      expanded,
      metadata,
      presentation,
      row.id,
      row.kind,
      state,
      stateWord,
      stopping,
      t,
      isCompact,
      onDetachSubagent,
    ],
  );

  return (
    <View>
      <View
        style={styles.rowContainer}
        {...(isWeb ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } : {})}
      >
        <ComposerTrackRow
          accessibilityLabel={[displayLabel, stateWord, metadata].filter(Boolean).join(", ")}
          expanded={expanded}
          testID={`subagents-track-row-${row.id}`}
          closeOnSelect={false}
          onPress={handleToggleDetails}
        >
          {renderRow}
        </ComposerTrackRow>
        {row.kind === "paseo" ? (
          // Action controls sit beside the row's Pressable, never inside it: a press on a button
          // must not be able to fall through to opening the session.
          <View
            style={actionsVisible ? styles.actionClusterVisible : styles.actionClusterHidden}
            pointerEvents={actionsVisible ? "auto" : "none"}
          >
            <SubagentRowActions
              rowId={row.id}
              displayLabel={displayLabel}
              compact={isCompact}
              onDetachPress={onDetachSubagent ? handleDetachPress : undefined}
              onArchivePress={handleArchivePress}
            />
          </View>
        ) : null}
      </View>
      {expanded ? (
        <SubagentExpandedDetails
          row={row}
          serverId={serverId}
          client={client}
          supportsControls={supportsControls}
          activity={shownActivity}
          age={age}
          stopping={stopping}
          onStopAccepted={handleStopAccepted}
          onOpenSession={handleOpenSession}
        />
      ) : null}
    </View>
  );
}

function subagentActivityText(
  activity: SubagentActivity | null,
  state: SubagentStateWord | null,
  t: TFunction,
): string | null {
  if (activity?.kind === "response") return activity.text;
  if (activity?.kind === "tool") return activity.label;
  if (activity?.kind === "none") {
    return state === "running"
      ? t("subagents.activityAwaiting")
      : t("subagents.panel.resultUnavailable");
  }
  return null;
}

function stateWordStyle(state: SubagentStateWord | null) {
  if (state === "running") return styles.stateWordRunning;
  if (state === "failed") return styles.stateWordFailed;
  return styles.stateWord;
}

function SubagentRowActions({
  rowId,
  displayLabel,
  compact,
  onDetachPress,
  onArchivePress,
}: {
  rowId: string;
  displayLabel: string;
  compact: boolean;
  onDetachPress?: () => void;
  onArchivePress: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const iconSize = paneContentToolbarIconSize(compact);
  return (
    <>
      {onDetachPress ? (
        <SubagentActionButton
          label={t("subagents.detachAction", { label: displayLabel })}
          tooltipLabel={t("subagents.detachTooltip")}
          compact={compact}
          onPress={onDetachPress}
          testID={`subagents-track-detach-${rowId}`}
        >
          <ThemedUnlink size={iconSize} uniProps={mutedIconColorMapping} />
        </SubagentActionButton>
      ) : null}
      <SubagentActionButton
        label={t("subagents.archiveAction", { label: displayLabel })}
        tooltipLabel={t("subagents.archiveTooltip")}
        compact={compact}
        onPress={onArchivePress}
        testID={`subagents-track-archive-${rowId}`}
      >
        <ThemedArchive size={iconSize} uniProps={mutedIconColorMapping} />
      </SubagentActionButton>
    </>
  );
}

/** The standard icon action, with a tooltip that names the action without repeating the row. */
function SubagentActionButton({
  label,
  tooltipLabel,
  compact,
  onPress,
  testID,
  children,
}: {
  label: string;
  tooltipLabel: string;
  compact: boolean;
  onPress: () => void;
  testID: string;
  children: ReactNode;
}): ReactElement {
  const tooltip = useMemo(
    () => <Text style={styles.tooltipText}>{tooltipLabel}</Text>,
    [tooltipLabel],
  );
  return (
    <ToolbarButton
      label={label}
      tooltip={tooltip}
      tooltipSide="top"
      compact={compact}
      onPress={onPress}
      testID={testID}
    >
      {children}
    </ToolbarButton>
  );
}

const styles = StyleSheet.create((theme) => ({
  // The row's Pressable owns the navigation press; the action cluster overlays its trailing edge
  // as a sibling, so a button press can never fall through to opening the session.
  rowContainer: {
    position: "relative",
  },
  section: {
    paddingVertical: theme.spacing[1],
    gap: theme.spacing[1],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[3],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[1],
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.foreground,
  },
  sectionCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  disclosureIcon: { alignItems: "center", justifyContent: "center" },
  // Reserve the actual shared toolbar frames even while hidden; the disclosure remains beside
  // them, and expanding details cannot move the header-relative overlay.
  disclosureActionSpace: (width: number) => ({ marginRight: width }),
  disclosureOpen: { transform: [{ rotate: "180deg" }] },
  rowBody: {
    paddingRight: theme.spacing[1],
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    minWidth: 0,
    gap: 2,
  },
  // Managed buttons remain separate hit targets; the disclosure glyph clears their overlay.
  rowBodyWithActions: { paddingRight: theme.spacing[1] },
  rowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  // `flexBasis: "auto"` rather than `flex: 1`: a zero-basis label contributes nothing to the row's
  // intrinsic width, so the panel measures itself at its floor and truncates every label at once.
  rowLabel: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    minWidth: 0,
    fontSize: theme.fontSize.base,
    color: theme.colors.foreground,
  },
  rowMeta: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  stateWord: {
    flexShrink: 0,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  stateWordRunning: {
    flexShrink: 0,
    fontSize: theme.fontSize.sm,
    color: theme.colors.statusDotRunning,
  },
  stateWordFailed: {
    flexShrink: 0,
    fontSize: theme.fontSize.sm,
    color: theme.colors.statusDotDanger,
  },
  // Trailing metadata for the archive row. No width cap: the panel's own ceiling bounds it.
  rowTrailing: {
    flexShrink: 2,
    minWidth: 0,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  actionClusterVisible: {
    position: "absolute",
    right: theme.spacing[1],
    top: "50%",
    transform: [{ translateY: "-50%" }],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    opacity: 1,
  },
  actionClusterHidden: {
    position: "absolute",
    right: theme.spacing[1],
    top: "50%",
    transform: [{ translateY: "-50%" }],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
    opacity: 0,
  },
  tooltipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
}));

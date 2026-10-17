import React, { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { type Theme } from "@/styles/theme";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { EditingTextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { providerSubagentKey, useProviderSubagentStore } from "./provider-store";
import { canControlPiSubagent, subagentRuntimeLabel } from "./track-presentation";
import type { SubagentRow } from "./select";
import type { SubagentActivity } from "./subagent-activity";

type NativeAction = "status" | "stop" | "steer";
type ControlReceipt = Awaited<ReturnType<DaemonClient["controlProviderSubagent"]>>;

interface Feedback {
  error: boolean;
  text: string;
}

export interface SubagentExpandedDetailsProps {
  row: SubagentRow;
  serverId: string;
  client: DaemonClient | null;
  supportsControls: boolean;
  activity: SubagentActivity | null;
  age: string | null;
  stopping: boolean;
  onStopAccepted: () => void;
  onOpenSession: () => void;
}

// Theme-reactive props that are not `style` need their own themed wrapper, so the wrapper
// re-renders on a theme switch instead of the whole subagent subtree.
const ThemedChevron = withUnistyles(ChevronDown);
const ThemedSteerInput = withUnistyles(EditingTextInput);
const chevronMapping = (theme: Theme) => ({ color: theme.colors.foregroundMuted });
const steerInputMapping = (theme: Theme) => ({
  placeholderTextColor: theme.colors.foregroundMuted,
});

function observedText(activity: SubagentActivity | null): string | null {
  if (activity?.kind === "response") {
    return activity.text;
  }
  if (activity?.kind === "tool") {
    return activity.label;
  }
  return null;
}

/**
 * Advisory descriptor state is re-read at the click boundary and verified again by the
 * daemon against the live parent Pi session and its native async child snapshot.
 */
function hasLiveControllableDescriptor(serverId: string, row: SubagentRow): boolean {
  if (row.kind !== "provider") {
    return false;
  }
  const current = useProviderSubagentStore
    .getState()
    .descriptors.get(providerSubagentKey(serverId, row.parentAgentId, row.id));
  if (current === undefined) {
    return false;
  }
  return (
    current.provider === "pi" && current.status === "running" && current.controlEligible === true
  );
}

function SummaryBlock({
  row,
  activity,
  age,
}: {
  row: SubagentRow;
  activity: SubagentActivity | null;
  age: string | null;
}): ReactElement {
  const { t } = useTranslation();
  const observed = observedText(activity);
  const runtimeLabel = subagentRuntimeLabel(row);
  const meta = [row.provider, runtimeLabel, age ? t("subagents.panel.startedAgo", { age }) : null]
    .filter(Boolean)
    .join(" · ");
  const subtitle = row.kind === "provider" ? row.subtitle : null;
  return (
    <>
      <Text style={styles.label}>
        {activity?.kind === "response"
          ? t("subagents.panel.outcome")
          : t("subagents.panel.activity")}
      </Text>
      <Text style={styles.body}>{observed ?? t("subagents.panel.resultUnavailable")}</Text>
      <Text style={styles.meta}>{meta}</Text>
      {subtitle ? (
        <Text selectable style={styles.meta}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );
}

function ControlActions({
  rowId,
  eligible,
  canMutate,
  confirmStop,
  pending,
  stopping,
  onOpenSession,
  onStatus,
  onStop,
}: {
  rowId: string;
  eligible: boolean;
  canMutate: boolean;
  confirmStop: boolean;
  pending: boolean;
  stopping: boolean;
  onOpenSession: () => void;
  onStatus: () => void;
  onStop: () => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.actions}>
        <Button
          size="sm"
          variant="outline"
          onPress={onOpenSession}
          testID={`subagents-track-open-${rowId}`}
        >
          {t("subagents.panel.openSession")}
        </Button>
        {eligible ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onPress={onStatus}
            testID={`subagents-track-status-${rowId}`}
          >
            {t("subagents.panel.status")}
          </Button>
        ) : null}
        {canMutate && !confirmStop ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={onStop}
            testID={`subagents-track-stop-${rowId}`}
          >
            {t("subagents.panel.stop")}
          </Button>
        ) : null}
      </View>
      {stopping ? (
        <Text style={styles.meta} testID={`subagents-track-stopping-${rowId}`}>
          {t("subagents.panel.stopAccepted")}
        </Text>
      ) : null}
    </>
  );
}

function SteerBox({
  rowId,
  steerKey,
  instruction,
  pending,
  onInstructionChange,
  onSteer,
}: {
  rowId: string;
  steerKey: number;
  instruction: string;
  pending: boolean;
  onInstructionChange: (value: string) => void;
  onSteer: () => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.steerBox}>
      <ThemedSteerInput
        key={`steer-input-${rowId}-${steerKey}`}
        multiline
        uniProps={steerInputMapping}
        accessibilityLabel={t("subagents.panel.steer")}
        placeholder={t("subagents.panel.steerPlaceholder")}
        initialValue=""
        onChangeText={onInstructionChange}
        maxLength={360}
        style={styles.steerInput}
        testID={`subagents-track-steer-input-${rowId}`}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || instruction.trim() === ""}
        onPress={onSteer}
        testID={`subagents-track-steer-${rowId}`}
      >
        {t("subagents.panel.steer")}
      </Button>
    </View>
  );
}

function ConfirmStopBox({
  rowId,
  label,
  onCancel,
  onConfirm,
}: {
  rowId: string;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.confirm} testID={`subagents-track-stop-confirm-${rowId}`}>
      <Text style={styles.body}>{t("subagents.panel.confirmStop", { label })}</Text>
      <View style={styles.actions}>
        <Button
          size="sm"
          variant="ghost"
          onPress={onCancel}
          testID={`subagents-track-cancel-stop-${rowId}`}
        >
          {t("subagents.panel.cancelStop")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onPress={onConfirm}
          testID={`subagents-track-confirm-stop-${rowId}`}
        >
          {t("subagents.panel.confirmStopAction")}
        </Button>
      </View>
    </View>
  );
}

function FeedbackLine({
  rowId,
  pending,
  feedback,
}: {
  rowId: string;
  pending: boolean;
  feedback: Feedback | null;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      {pending ? <Text style={styles.meta}>{t("subagents.panel.pending")}</Text> : null}
      {feedback ? (
        <Text
          selectable
          style={feedback.error ? styles.error : styles.meta}
          testID={`subagents-track-feedback-${rowId}`}
        >
          {feedback.text}
        </Text>
      ) : null}
    </>
  );
}

function TaskDisclosure({ rowId, task }: { rowId: string; task: string | null }): ReactElement {
  const { t } = useTranslation();
  const [showTask, setShowTask] = useState(false);
  const toggleTask = useCallback(() => setShowTask((value) => !value), []);
  const expandedState = useMemo(() => ({ expanded: showTask }), [showTask]);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("subagents.panel.task")}
        accessibilityState={expandedState}
        aria-expanded={showTask}
        onPress={toggleTask}
        style={styles.taskDisclosure}
        testID={`subagents-track-original-task-toggle-${rowId}`}
      >
        <Text style={styles.label}>{t("subagents.panel.task")}</Text>
        <ThemedChevron
          size={16}
          uniProps={chevronMapping}
          style={showTask ? styles.taskChevronOpen : undefined}
        />
      </Pressable>
      {showTask ? (
        <Text selectable style={styles.body} testID={`subagents-track-original-task-${rowId}`}>
          {task?.trim() || t("subagents.panel.resultUnavailable")}
        </Text>
      ) : null}
    </>
  );
}

export function SubagentExpandedDetails({
  row,
  serverId,
  client,
  supportsControls,
  activity,
  age,
  stopping,
  onStopAccepted,
  onOpenSession,
}: SubagentExpandedDetailsProps): ReactElement {
  const { t } = useTranslation();
  const [pending, setPending] = useState<NativeAction | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [steerKey, setSteerKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inFlight = useRef(false);
  const eligible = supportsControls && client !== null && canControlPiSubagent(row);
  const task = row.kind === "provider" ? row.description || row.title : row.title;
  const isRunning = row.kind === "provider" && row.status === "running";
  const canMutate = eligible && isRunning && !stopping && pending === null;

  // Each receipt is read as acceptance only; a stop never claims a terminal state, and a
  // steer reports where the instruction landed (delivered now, or queued for the child).
  const describeReceipt = useCallback(
    (action: NativeAction, receipt: ControlReceipt): Feedback => {
      if (!receipt.success) {
        throw new Error(receipt.error || t("subagents.panel.actionFailed"));
      }
      if (action === "status") {
        const state = receipt.state ?? "unknown";
        const text = receipt.runState
          ? t("subagents.panel.stateWithRun", { state, runState: receipt.runState })
          : t("subagents.panel.observedState", { state });
        return { error: false, text };
      }
      if (action === "stop") {
        if (receipt.state !== "stopping") {
          throw new Error(t("subagents.panel.actionFailed"));
        }
        return { error: false, text: t("subagents.panel.stopAccepted") };
      }
      if (receipt.deliveryStatus !== "queued" && receipt.deliveryStatus !== "delivered") {
        throw new Error(t("subagents.panel.actionFailed"));
      }
      const text =
        receipt.deliveryStatus === "queued"
          ? t("subagents.panel.queued")
          : t("subagents.panel.delivered");
      return { error: false, text };
    },
    [t],
  );

  const sendControl = useCallback(
    async (action: NativeAction) => {
      const message = instruction.trim();
      if (inFlight.current) return;
      if (client === null || !eligible || row.kind !== "provider") return;
      if (stopping && action !== "status") return;
      if (action === "steer" && message === "") return;
      if (!hasLiveControllableDescriptor(serverId, row)) {
        setFeedback({ error: true, text: t("subagents.panel.unavailableControl") });
        return;
      }
      inFlight.current = true;
      setPending(action);
      setFeedback(null);
      try {
        const receipt = await client.controlProviderSubagent({
          parentAgentId: row.parentAgentId,
          subagentId: row.id,
          action,
          ...(action === "steer" ? { message } : {}),
        });
        setFeedback(describeReceipt(action, receipt));
        if (action === "stop") {
          onStopAccepted();
        }
        if (action === "steer") {
          // The editor is uncontrolled, so a fresh key is what clears it after delivery.
          setInstruction("");
          setSteerKey((value) => value + 1);
        }
      } catch (error) {
        setFeedback({
          error: true,
          text: error instanceof Error ? error.message : t("subagents.panel.actionFailed"),
        });
      } finally {
        inFlight.current = false;
        setPending(null);
        setConfirmStop(false);
      }
    },
    [client, describeReceipt, eligible, instruction, onStopAccepted, row, serverId, stopping, t],
  );

  const readStatus = useCallback(() => {
    void sendControl("status");
  }, [sendControl]);
  const sendSteer = useCallback(() => {
    void sendControl("steer");
  }, [sendControl]);
  const sendStop = useCallback(() => {
    void sendControl("stop");
  }, [sendControl]);
  const askStop = useCallback(() => setConfirmStop(true), []);
  const cancelStop = useCallback(() => setConfirmStop(false), []);

  return (
    <View style={styles.detail} testID={`subagents-track-expanded-${row.id}`}>
      <SummaryBlock row={row} activity={activity} age={age} />
      <ControlActions
        rowId={row.id}
        eligible={eligible}
        canMutate={canMutate}
        confirmStop={confirmStop}
        pending={pending !== null}
        stopping={stopping && isRunning}
        onOpenSession={onOpenSession}
        onStatus={readStatus}
        onStop={askStop}
      />
      {eligible && canMutate ? (
        <SteerBox
          rowId={row.id}
          steerKey={steerKey}
          instruction={instruction}
          pending={pending !== null}
          onInstructionChange={setInstruction}
          onSteer={sendSteer}
        />
      ) : null}
      {confirmStop && canMutate ? (
        <ConfirmStopBox
          rowId={row.id}
          label={task || row.id}
          onCancel={cancelStop}
          onConfirm={sendStop}
        />
      ) : null}
      <FeedbackLine rowId={row.id} pending={pending !== null} feedback={feedback} />
      <TaskDisclosure rowId={row.id} task={task} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  detail: {
    marginLeft: theme.spacing[6],
    marginRight: theme.spacing[2],
    marginBottom: theme.spacing[2],
    padding: theme.spacing[3],
    gap: theme.spacing[2],
    backgroundColor: theme.colors.surface1,
    borderRadius: theme.borderRadius.md,
    minWidth: 0,
  },
  taskDisclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36,
    paddingVertical: theme.spacing[2],
  },
  taskChevronOpen: { transform: [{ rotate: "180deg" }] },
  label: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  body: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    lineHeight: 19,
    flexShrink: 1,
  },
  meta: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  error: {
    color: theme.colors.statusDotDanger,
    fontSize: theme.fontSize.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    alignItems: "center",
  },
  steerBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    alignItems: "flex-end",
  },
  steerInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 160,
    minHeight: 62,
    padding: theme.spacing[2],
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    backgroundColor: theme.colors.surface2,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    textAlignVertical: "top",
  },
  confirm: {
    gap: theme.spacing[2],
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderAccent,
  },
}));

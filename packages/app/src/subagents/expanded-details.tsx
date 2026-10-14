import { useCallback, useRef, useState, type ReactElement } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Button } from "@/components/ui/button";
import { providerSubagentKey, useProviderSubagentStore } from "./provider-store";
import { canControlPiSubagent, subagentRuntimeLabel } from "./track-presentation";
import type { SubagentRow } from "./select";
import type { SubagentActivity } from "./subagent-activity";

type NativeAction = "status" | "stop" | "steer";

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
  const { theme } = useUnistyles();
  const [pending, setPending] = useState<NativeAction | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [showTask, setShowTask] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const inFlight = useRef(false);
  const eligible = supportsControls && client !== null && canControlPiSubagent(row);
  const task = row.kind === "provider" ? (row.description || row.title) : row.title;
  const runtimeLabel = subagentRuntimeLabel(row);
  const observed = activity?.kind === "response" ? activity.text
    : activity?.kind === "tool" ? activity.label : null;
  const isRunning = row.kind === "provider" && row.status === "running";
  const canMutate = eligible && isRunning && !stopping && pending === null;

  const sendControl = useCallback(async (action: NativeAction) => {
    // Advisory descriptor state is re-read at the click boundary and verified again by the
    // daemon against the live parent Pi session and its native async child snapshot.
    if (inFlight.current || !client || !eligible || row.kind !== "provider" ||
        (stopping && action !== "status") || (action === "steer" && !instruction.trim())) return;
    const current = useProviderSubagentStore.getState().descriptors.get(
      providerSubagentKey(serverId, row.parentAgentId, row.id),
    );
    if (!current || current.provider !== "pi" || current.status !== "running" ||
        current.controlEligible !== true) {
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
        ...(action === "steer" ? { message: instruction.trim() } : {}),
      });
      if (!receipt.success) throw new Error(receipt.error || t("subagents.panel.actionFailed"));
      if (action === "status") {
        setFeedback({
          error: false,
          text: receipt.runState
            ? t("subagents.panel.stateWithRun", {
                state: receipt.state ?? "unknown", runState: receipt.runState,
              })
            : t("subagents.panel.observedState", { state: receipt.state ?? "unknown" }),
        });
      } else if (action === "stop") {
        // "stopping" is only acceptance; never optimistically mark a child canceled.
        if (receipt.state !== "stopping") throw new Error(t("subagents.panel.actionFailed"));
        onStopAccepted();
        setFeedback({ error: false, text: t("subagents.panel.stopAccepted") });
      } else {
        if (receipt.deliveryStatus !== "queued" && receipt.deliveryStatus !== "delivered") {
          throw new Error(t("subagents.panel.actionFailed"));
        }
        setFeedback({
          error: false,
          text: t(receipt.deliveryStatus === "queued" ? "subagents.panel.queued" : "subagents.panel.delivered"),
        });
        setInstruction("");
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
  }, [client, eligible, instruction, onStopAccepted, row, serverId, stopping, t]);

  const readStatus = useCallback(() => { void sendControl("status"); }, [sendControl]);
  const sendSteer = useCallback(() => { void sendControl("steer"); }, [sendControl]);
  const sendStop = useCallback(() => { void sendControl("stop"); }, [sendControl]);
  const askStop = useCallback(() => setConfirmStop(true), []);
  const cancelStop = useCallback(() => setConfirmStop(false), []);

  return (
    <View style={styles.detail} testID={"subagents-track-expanded-" + row.id}>
      <Text style={styles.label}>
        {activity?.kind === "response" ? t("subagents.panel.outcome") : t("subagents.panel.activity")}
      </Text>
      <Text style={styles.body}>{observed || t("subagents.panel.resultUnavailable")}</Text>
      <Text style={styles.meta}>
        {[row.provider, runtimeLabel, age ? t("subagents.panel.startedAgo", { age }) : null]
          .filter(Boolean).join(" · ")}
      </Text>
      {row.kind === "provider" && row.subtitle ? (
        <Text selectable style={styles.meta}>{row.subtitle}</Text>
      ) : null}
      <View style={styles.actions}>
        <Button size="sm" variant="outline" onPress={onOpenSession} testID={"subagents-track-open-" + row.id}>
          {t("subagents.panel.openSession")}
        </Button>
        {eligible ? (
          <Button size="sm" variant="ghost" disabled={pending !== null}
            onPress={readStatus} testID={"subagents-track-status-" + row.id}>
            {t("subagents.panel.status")}
          </Button>
        ) : null}
        {canMutate && !confirmStop ? (
          <Button size="sm" variant="ghost" onPress={askStop}
            testID={"subagents-track-stop-" + row.id}>
            {t("subagents.panel.stop")}
          </Button>
        ) : null}
      </View>
      {stopping && isRunning ? (
        <Text style={styles.meta} testID={"subagents-track-stopping-" + row.id}>
          {t("subagents.panel.stopAccepted")}
        </Text>
      ) : null}
      {eligible && canMutate ? (
        <View style={styles.steerBox}>
          <TextInput
            multiline
            accessibilityLabel={t("subagents.panel.steer")}
            placeholder={t("subagents.panel.steerPlaceholder")}
            placeholderTextColor={theme.colors.foregroundMuted}
            value={instruction}
            onChangeText={setInstruction}
            maxLength={360}
            style={styles.steerInput}
            testID={"subagents-track-steer-input-" + row.id}
          />
          <Button size="sm" variant="secondary" disabled={!instruction.trim() || pending !== null}
            onPress={sendSteer} testID={"subagents-track-steer-" + row.id}>
            {t("subagents.panel.steer")}
          </Button>
        </View>
      ) : null}
      {confirmStop && canMutate ? (
        <View style={styles.confirm} testID={"subagents-track-stop-confirm-" + row.id}>
          <Text style={styles.body}>{t("subagents.panel.confirmStop", { label: task || row.id })}</Text>
          <View style={styles.actions}>
            <Button size="sm" variant="ghost" onPress={cancelStop} testID={"subagents-track-cancel-stop-" + row.id}>
              {t("subagents.panel.cancelStop")}
            </Button>
            <Button size="sm" variant="destructive" onPress={sendStop} testID={"subagents-track-confirm-stop-" + row.id}>
              {t("subagents.panel.confirmStopAction")}
            </Button>
          </View>
        </View>
      ) : null}
      {pending ? <Text style={styles.meta}>{t("subagents.panel.pending")}</Text> : null}
      {feedback ? (
        <Text selectable style={feedback.error ? styles.error : styles.meta}
          testID={"subagents-track-feedback-" + row.id}>
          {feedback.text}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("subagents.panel.task")}
        accessibilityState={{ expanded: showTask }}
        aria-expanded={showTask}
        onPress={() => setShowTask((value) => !value)}
        style={styles.taskDisclosure}
        testID={"subagents-track-original-task-toggle-" + row.id}
      >
        <Text style={styles.label}>{t("subagents.panel.task")}</Text>
        <ChevronDown
          size={16}
          color={theme.colors.foregroundMuted}
          style={showTask ? styles.taskChevronOpen : undefined}
        />
      </Pressable>
      {showTask ? (
        <Text selectable style={styles.body} testID={"subagents-track-original-task-" + row.id}>
          {task?.trim() || t("subagents.panel.resultUnavailable")}
        </Text>
      ) : null}
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

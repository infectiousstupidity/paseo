import type { ZodType, input as ZodInput, output as ZodOutput } from "zod";

export interface PluginRpcContract<
  InputSchema extends ZodType = ZodType,
  OutputSchema extends ZodType = ZodType,
> {
  name: string;
  input: InputSchema;
  output: OutputSchema;
}

/**
 * `z.instanceof(Uint8Array)` infers `Uint8Array<ArrayBuffer>`; values crossing the wire accept any
 * `Uint8Array`, including a `Buffer` or a view of a shared buffer.
 */
export type PluginWireInput<Value> = Value extends Uint8Array ? Uint8Array : Value;

export type RpcInput<Contract extends PluginRpcContract> = ZodOutput<Contract["input"]>;
export type RpcOutput<Contract extends PluginRpcContract> = ZodInput<Contract["output"]>;

interface RpcDefinition<InputSchema extends ZodType, OutputSchema extends ZodType> {
  name: string;
  input: InputSchema;
  output: OutputSchema;
}

const RPC_NAME = /^[a-z][a-z0-9._-]*$/;

export function defineRpc<InputSchema extends ZodType, OutputSchema extends ZodType>(
  definition: RpcDefinition<InputSchema, OutputSchema>,
): PluginRpcContract<InputSchema, OutputSchema> {
  const name = definition.name.trim();
  if (!RPC_NAME.test(name)) throw new Error(`Invalid plugin RPC method: ${definition.name}`);
  return { ...definition, name };
}

export async function callPluginRpc<InputSchema extends ZodType, OutputSchema extends ZodType>(
  contract: PluginRpcContract<InputSchema, OutputSchema>,
  invoke: (method: string, input: unknown) => Promise<unknown>,
  input: PluginWireInput<ZodInput<InputSchema>>,
): Promise<ZodOutput<OutputSchema>> {
  const parsedInput = await contract.input.parseAsync(input);
  const output = await invoke(contract.name, parsedInput);
  return contract.output.parseAsync(output);
}

export interface PluginSubscriptionContract<
  InputSchema extends ZodType = ZodType,
  EventSchema extends ZodType = ZodType,
> {
  name: string;
  input: InputSchema;
  event: EventSchema;
}

export type SubscriptionInput<Contract extends PluginSubscriptionContract> = ZodOutput<
  Contract["input"]
>;
export type SubscriptionEvent<Contract extends PluginSubscriptionContract> = ZodOutput<
  Contract["event"]
>;

interface SubscriptionDefinition<InputSchema extends ZodType, EventSchema extends ZodType> {
  name: string;
  input: InputSchema;
  event: EventSchema;
}

export function defineSubscription<InputSchema extends ZodType, EventSchema extends ZodType>(
  definition: SubscriptionDefinition<InputSchema, EventSchema>,
): PluginSubscriptionContract<InputSchema, EventSchema> {
  const name = definition.name.trim();
  if (!RPC_NAME.test(name)) throw new Error(`Invalid plugin subscription: ${definition.name}`);
  return { ...definition, name };
}

/** One subscription from a client surface. Calling it or `release()` ends it. */
export type PluginSubscriptionHandle = (() => void) & {
  /** Resolves once the plugin acknowledged the subscription; rejects if it refused. */
  readonly ready: Promise<void>;
  release(): Promise<void>;
};

export interface PluginSubscriptionObserver {
  event(event: unknown): void;
  closed(error?: Error): void;
}

export interface PluginSubscriptionClosed {
  /** Set when the plugin's handler failed, the plugin stopped, or an event failed validation. */
  error?: Error;
}

export interface PluginSubscribeOptions {
  /** Aborting releases the subscription. */
  signal?: AbortSignal;
  /** Runs once when the daemon closes the subscription. Not called after a release. */
  onClosed?: (closed: PluginSubscriptionClosed) => void;
}

export function subscribePluginRpc<InputSchema extends ZodType, EventSchema extends ZodType>(
  contract: PluginSubscriptionContract<InputSchema, EventSchema>,
  subscribe: (
    method: string,
    input: unknown,
    observer: PluginSubscriptionObserver,
  ) => PluginSubscriptionHandle,
  input: PluginWireInput<ZodInput<InputSchema>>,
  onEvent: (event: ZodOutput<EventSchema>) => void,
  options: PluginSubscribeOptions = {},
): PluginSubscriptionHandle {
  // The plugin parses the input into the schema's output, so it receives the input as given.
  contract.input.parse(input);
  let closed = false;
  let handle: PluginSubscriptionHandle | null = null;
  let releasePending = false;
  let releasePromise: Promise<void> | null = null;
  let abortListener: (() => void) | null = null;

  function detachAbort(): void {
    if (abortListener && options.signal) {
      options.signal.removeEventListener("abort", abortListener);
      abortListener = null;
    }
  }

  function release(): Promise<void> {
    closed = true;
    detachAbort();
    if (!handle) {
      releasePending = true;
      return Promise.resolve();
    }
    return (releasePromise ??= handle.release());
  }

  function close(error?: Error): void {
    if (closed) return;
    closed = true;
    detachAbort();
    options.onClosed?.(error ? { error } : {});
  }

  const started = subscribe(contract.name, input, {
    event(event) {
      if (closed) return;
      const parsed = contract.event.safeParse(event);
      if (parsed.success) return onEvent(parsed.data);
      close(new Error(`Plugin subscription ${contract.name} sent an invalid event`));
      // A buffered event can arrive synchronously before subscribe() returns its handle.
      void release().catch(() => undefined);
    },
    closed: close,
  });
  handle = started;
  if (releasePending) void release().catch(() => undefined);
  if (options.signal && !closed) {
    const abort = () => void release().catch(() => undefined);
    if (options.signal.aborted) abort();
    else {
      abortListener = abort;
      options.signal.addEventListener("abort", abort, { once: true });
    }
  }
  return Object.assign(() => void release().catch(() => undefined), {
    ready: started.ready,
    release,
  });
}

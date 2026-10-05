export function resolveNpmInvocation(env = process.env, nodeExecPath = process.execPath) {
  const npmExecPath = env.npm_execpath?.trim();
  if (!npmExecPath) {
    throw new Error(
      "npm_execpath is missing. Run this package build through npm rather than invoking build-package.mjs directly.",
    );
  }

  const npmNodeExecPath = env.npm_node_execpath?.trim() || nodeExecPath;
  return {
    command: npmNodeExecPath,
    argsPrefix: [npmExecPath],
  };
}

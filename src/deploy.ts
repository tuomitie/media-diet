import { config } from "./config";

export async function triggerDeploy(): Promise<void> {
  if (!config.cfPagesDeployHookUrl) {
    console.warn("CF_PAGES_DEPLOY_HOOK_URL not set; skipping deploy trigger.");
    return;
  }

  const response = await fetch(config.cfPagesDeployHookUrl, { method: "POST" });
  if (!response.ok) {
    const body = await response.text();
    console.warn(
      `Deploy hook failed: ${response.status} ${response.statusText} ${body}`
    );
  }
}

export async function triggerDeployIfNeeded(changed: boolean): Promise<void> {
  if (!changed) {
    return;
  }
  await triggerDeploy();
}

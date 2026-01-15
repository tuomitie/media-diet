function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  letterboxdUsername: process.env.LETTERBOXD_USERNAME ?? "",
  goodreadsRssUrl: process.env.GOODREADS_RSS_URL ?? "",
  dataDir: process.env.DATA_DIR ?? "./data",
  cfPagesDeployHookUrl: process.env.CF_PAGES_DEPLOY_HOOK_URL ?? "",
  port: parseNumber(process.env.PORT, 8787)
};

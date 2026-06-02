import config from '../config';
import * as logger from './logger';

/**
 * Starts a heartbeat interval to push status updates to Uptime Kuma.
 * @param componentName The name of the service (e.g., 'Bot' or 'Worker') for logging.
 * @param getPing Optional function to get the current latency/ping.
 */
export function startUptimeHeartbeat(componentName: string, getPing?: () => number): void {
  const { url, interval } = config.uptimeKuma;

  if (!url) {
    logger.warn(`[${componentName}] Uptime Kuma: No push URL configured.`);
    return;
  }

  const push = async () => {
    try {
      const targetUrl = new URL(url);
      const currentPing = getPing ? Math.round(getPing()) : -1;

      // Only set the ping parameter if we have a valid non-negative value.
      // This prevents sending "...&ping=-1" or "...&ping=" which causes 404s on some services.
      if (currentPing >= 0) {
        targetUrl.searchParams.set('ping', currentPing.toString());
      } else {
        // If ping isn't ready yet, remove the parameter entirely for a clean heartbeat
        targetUrl.searchParams.delete('ping');
      }

      const response = await fetch(targetUrl.toString());
      
      if (response.ok) {
        // Successful heartbeat logs are disabled to avoid console spam.
        // logger.info(`[${componentName}] Uptime Kuma: Pushed! (${response.status})`);
      } else {
        logger.error(`[${componentName}] Uptime Kuma: Push rejected with status ${response.status}`);
      }
    } catch (error) {
      logger.error(`[${componentName}] Uptime Kuma push failed: ${error}`);
    }
  };

  // Execute immediately then start interval
  push();
  setInterval(push, interval * 1000);
}
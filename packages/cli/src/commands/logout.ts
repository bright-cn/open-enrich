import { deleteStoredCredentials, CONFIG_PATH } from "../auth/config-store";
import pc from "picocolors";

export async function runLogout(): Promise<void> {
  const removed = await deleteStoredCredentials();
  if (removed) {
    console.log(pc.green(`✓ Removed ${CONFIG_PATH}`));
  } else {
    console.log(pc.dim(`Nothing to remove (no config at ${CONFIG_PATH})`));
  }
}

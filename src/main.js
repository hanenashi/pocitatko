import { DATA_SCHEMA_VERSION, IDS, VERSION } from "./constants.js";
import { createFirestoreAdapter } from "./adapters/firestore.js";
import { clubPlugins } from "./plugins/vymysli-vtipny-textik.js";
import { installLauncherControls } from "./ui/launcher.js";
import { createOverlay } from "./ui/overlay.js";
import { addStyles } from "./ui/styles.js";

const activePlugin = clubPlugins.find((plugin) => {
  try {
    return plugin.matchesBoardUrl(new URL(location.href));
  } catch {
    return false;
  }
});

if (activePlugin) {
  const database = createFirestoreAdapter();
  const { openOverlay } = createOverlay({
    plugin: activePlugin,
    ids: IDS,
    version: VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    addStyles,
    database,
  });
  installLauncherControls({ ids: IDS, version: VERSION, addStyles, openOverlay });
}

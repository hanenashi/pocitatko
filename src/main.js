import { IDS, VERSION } from "./constants.js";
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
  const { openOverlay } = createOverlay({
    plugin: activePlugin,
    ids: IDS,
    version: VERSION,
    addStyles,
  });
  installLauncherControls({ ids: IDS, version: VERSION, addStyles, openOverlay });
}

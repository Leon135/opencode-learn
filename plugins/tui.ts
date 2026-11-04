import { Plugin } from "@opencode/plugin/tui"
import { setupMdLinkTui } from "./md-link/tui.ts"
import { setupVizTui } from "./viz/tui.ts"

export default Plugin.define({
  id: "oc-learn.tui",
  async setup(ctx) {
    const cleanups: (Plugin.Cleanup | void)[] = []
    cleanups.push(await setupVizTui(ctx))
    cleanups.push(await setupMdLinkTui(ctx))
    return () => {
      for (const cleanup of cleanups.reverse()) {
        if (typeof cleanup === "function") cleanup()
      }
    }
  },
})

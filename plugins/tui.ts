import { Plugin } from "@opencode/plugin/tui"
import { setupMdLinkTui } from "./md-link/tui.ts"
import { setupVizTui } from "./viz/tui.ts"

export default Plugin.define({
  id: "oc-learn.tui",
  async setup(ctx) {
    await setupVizTui(ctx)
    await setupMdLinkTui(ctx)
  },
})

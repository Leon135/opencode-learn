import { Plugin } from "@opencode/plugin"
import { setupMdLink } from "./md-link/index.ts"
import { setupQuiz } from "./quiz.ts"
import { setupViz } from "./viz/index.ts"

export default Plugin.define({
  id: "oc-learn",
  async setup(ctx) {
    const cleanups: (Plugin.Cleanup | void)[] = []
    cleanups.push(await setupViz(ctx))
    cleanups.push(await setupQuiz(ctx))
    cleanups.push(await setupMdLink(ctx))
    return () => {
      for (const cleanup of cleanups.reverse()) {
        if (typeof cleanup === "function") cleanup()
      }
    }
  },
})

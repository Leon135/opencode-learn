import { Plugin } from "@opencode/plugin"
import { setupAgents } from "./agents.ts"
import { setupMdLink } from "./md-link/index.ts"
import { setupQuiz } from "./quiz.ts"
import { setupSkills } from "./skills.ts"
import { setupViz } from "./viz/index.ts"

export default Plugin.define({
  id: "opencode-learn",
  async setup(ctx) {
    const cleanups: (Plugin.Cleanup | void)[] = []
    cleanups.push(await setupAgents(ctx))
    cleanups.push(await setupSkills(ctx))
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

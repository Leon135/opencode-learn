import { Plugin } from "@opencode/plugin"
import { setupMdLink } from "./md-link/index.ts"
import { setupQuiz } from "./quiz.ts"
import { setupViz } from "./viz/index.ts"

export default Plugin.define({
  id: "oc-learn",
  async setup(ctx) {
    await setupViz(ctx)
    await setupQuiz(ctx)
    await setupMdLink(ctx)
  },
})

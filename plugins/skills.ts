import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Plugin, Skill } from "@opencode/plugin"

const BUNDLED = [
  { id: "teach", file: "../skills/teach/SKILL.md" },
  { id: "visualize", file: "../skills/visualize/SKILL.md" },
]

function frontmatterField(frontmatter: string, key: string): string | undefined {
  const line = frontmatter.split(/\r?\n/).find((candidate) => candidate.startsWith(`${key}:`))
  if (line === undefined) return undefined
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2")
}

function readSkill(id: string, file: string) {
  const path = fileURLToPath(new URL(file, import.meta.url))
  const raw = readFileSync(path, "utf8")
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  const frontmatter = match?.[1] ?? ""
  return {
    id,
    name: frontmatterField(frontmatter, "name") ?? id,
    description: frontmatterField(frontmatter, "description"),
    path,
    content: (match ? raw.slice(match[0].length) : raw).trim(),
  }
}

export async function setupSkills(ctx: Plugin.Context): Promise<void> {
  const skills = BUNDLED.map(({ id, file }) => readSkill(id, file))
  await ctx.skill.transform((editor) => {
    for (const skill of skills) {
      editor.add({
        id: Skill.ID.make(skill.id),
        name: Skill.Name.make(skill.name),
        description: skill.description,
        path: Skill.Info.fields.path.make(skill.path),
        content: skill.content,
      })
    }
  })
}

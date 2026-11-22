// demo: node demo.js [soubor.json] [kroku] – pripise do pribehu dalsi kroky (~500 slov) a po kazdem ho ulozi

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { continueStory, newStory } from "./llm/story.js"

const [file = "stories/demo.json", steps = 4] = process.argv.slice(2)
const story = newStory(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {
  genre: "Mystery",
  premise: "Mara works the night shift at a coastal radio station in northern Norway. During a storm she picks up a distress call from the fishing boat Solveig, which sank with all hands thirty years ago. Her new colleague Tobias, a quiet engineer, says it must be a prank – but he knows more about the wreck than he admits.",
})

mkdirSync(dirname(file), { recursive: true })
for (let i = 0; i < steps; i++) {
  await continueStory(story, plan => console.error(`[Plan: ${plan}]\n`), piece => process.stdout.write(piece))
  process.stdout.write("\n\n")
  writeFileSync(file, JSON.stringify(story, null, 2))
}
console.error(`[Story memory – covers ${story.memoryUpTo} of ${story.text.length} characters]\n${story.memory}`)

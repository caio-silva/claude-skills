export default [
  {
    name: "claude-code",
    outputDir: "dist/claude-code/skills",
    skillFile: "SKILL.md",
    transform: (content, _metadata) => content,
    companionFiles: true,
  },
];

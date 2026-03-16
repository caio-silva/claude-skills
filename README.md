# claude-skills

Custom [Claude Code](https://claude.com/claude-code) skills.

## Skills

| Skill | Description |
|-------|-------------|
| [deep-code-review](skills/deep-code-review/SKILL.md) | Three-pass code review combining quality, security, and performance analysis |

## Usage

Add to your Claude Code configuration:

```bash
# In your project's .claude/settings.json or ~/.claude/settings.json
{
  "skills": ["~/Code/claude-skills/skills"]
}
```

Then invoke with `/deep-code-review` or let Claude auto-detect when a review is appropriate.

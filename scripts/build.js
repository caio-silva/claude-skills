import { readdir, readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import providers from "../providers.js";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = join(ROOT, "source", "skills");
const validateOnly = process.argv.includes("--validate-only");
const providerFilter = process.argv
  .find((a) => a.startsWith("--provider="))
  ?.split("=")[1];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return meta;
}

async function discoverSkills() {
  const entries = await readdir(SOURCE, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(SOURCE, entry.name);
    const skillFile = join(skillDir, "SKILL.md");

    if (!existsSync(skillFile)) {
      continue;
    }

    const content = await readFile(skillFile, "utf-8");
    const meta = parseFrontmatter(content);

    if (!meta) {
      console.error(`FAIL: ${entry.name}/SKILL.md has no frontmatter`);
      process.exit(1);
    }
    if (!meta.name) {
      console.error(`FAIL: ${entry.name}/SKILL.md missing 'name' in frontmatter`);
      process.exit(1);
    }
    if (!meta.description) {
      console.error(`FAIL: ${entry.name}/SKILL.md missing 'description' in frontmatter`);
      process.exit(1);
    }

    const allFiles = await readdir(skillDir);
    const companions = allFiles.filter(
      (f) => f.endsWith(".md") && f !== "SKILL.md"
    );

    skills.push({
      name: entry.name,
      dir: skillDir,
      meta,
      content,
      companions,
    });
  }

  return skills;
}

async function buildProvider(provider, skills) {
  const outDir = join(ROOT, provider.outputDir);

  for (const skill of skills) {
    const skillOutDir = join(outDir, skill.name);
    await mkdir(skillOutDir, { recursive: true });

    const transformed = provider.transform(skill.content, skill.meta);
    await writeFile(join(skillOutDir, provider.skillFile), transformed);

    if (provider.companionFiles) {
      for (const companion of skill.companions) {
        await cp(join(skill.dir, companion), join(skillOutDir, companion));
      }
    }
  }

  const manifest = {
    version: "2.0.0",
    provider: provider.name,
    built: new Date().toISOString(),
    skills: skills.map((s) => ({
      name: s.meta.name,
      description: s.meta.description,
      files: [provider.skillFile, ...s.companions],
    })),
  };

  await writeFile(
    join(outDir, "..", "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

async function main() {
  console.log("Discovering skills...");
  const skills = await discoverSkills();
  console.log(`Found ${skills.length} skills: ${skills.map((s) => s.name).join(", ")}`);

  if (validateOnly) {
    console.log("Validation passed.");
    return;
  }

  const targets = providerFilter
    ? providers.filter((p) => p.name === providerFilter)
    : providers;

  if (targets.length === 0) {
    console.error(`No provider found matching '${providerFilter}'`);
    process.exit(1);
  }

  for (const provider of targets) {
    console.log(`Building for ${provider.name}...`);
    await buildProvider(provider, skills);
    console.log(`  → ${provider.outputDir}/`);
  }

  console.log("Build complete.");
}

main();

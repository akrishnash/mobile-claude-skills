#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const availableSkills = [
  "flutter-arch",
  "flutter-auth-deploy",
  "flutter-backend",
  "flutter-database",
  "flutter-mobile",
  "flutter-polish",
  "flutter-ui",
];

function printHelp() {
  console.log(`Usage:
  npx mobile-claude-skills [options] [skill-name...]

Options:
  --local, -l           Install into the current project (.claude/skills)
  --global, -g          Install into the user home (~/.claude/skills)
  --target <path>       Install into a custom destination
  --skills <a,b,c>      Comma-separated list of skills to install
  --list                Print available skills
  --help, -h            Show this help

Examples:
  npx mobile-claude-skills --local
  npx mobile-claude-skills --global flutter-ui flutter-arch
  npx mobile-claude-skills --target ./tmp/skills --skills flutter-mobile,flutter-backend`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    scope: "local",
    scopeChosen: false,
    target: null,
    selectedSkills: [],
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--list") {
      options.list = true;
      continue;
    }

    if (arg === "--local" || arg === "-l") {
      if (options.scopeChosen && options.scope !== "local") {
        fail("Choose either --local or --global, not both.");
      }
      options.scope = "local";
      options.scopeChosen = true;
      continue;
    }

    if (arg === "--global" || arg === "-g") {
      if (options.scopeChosen && options.scope !== "global") {
        fail("Choose either --local or --global, not both.");
      }
      options.scope = "global";
      options.scopeChosen = true;
      continue;
    }

    if (arg === "--target") {
      const value = argv[i + 1];
      if (!value) {
        fail("--target requires a path.");
      }
      options.target = value;
      i += 1;
      continue;
    }

    if (arg === "--skills") {
      const value = argv[i + 1];
      if (!value) {
        fail("--skills requires a comma-separated value.");
      }
      options.selectedSkills.push(
        ...value.split(",").map((skill) => skill.trim()).filter(Boolean),
      );
      i += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    }

    options.selectedSkills.push(arg);
  }

  delete options.scopeChosen;
  return options;
}

function resolveDestination(options) {
  if (options.target) {
    return path.resolve(process.cwd(), options.target);
  }

  if (options.scope === "global") {
    return path.join(os.homedir(), ".claude", "skills");
  }

  return path.join(process.cwd(), ".claude", "skills");
}

function ensureValidSkills(skills) {
  const uniqueSkills = [...new Set(skills.length > 0 ? skills : availableSkills)];
  const invalidSkills = uniqueSkills.filter((skill) => !availableSkills.includes(skill));

  if (invalidSkills.length > 0) {
    fail(
      `Unknown skill(s): ${invalidSkills.join(", ")}. Available: ${availableSkills.join(", ")}`,
    );
  }

  return uniqueSkills;
}

function copySkill(skillName, destinationRoot) {
  const sourcePath = path.join(__dirname, "..", skillName);
  const destinationPath = path.join(destinationRoot, skillName);

  if (!fs.existsSync(sourcePath)) {
    fail(`Missing packaged skill directory: ${skillName}`);
  }

  fs.mkdirSync(destinationRoot, { recursive: true });
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true,
    force: true,
  });

  return destinationPath;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    console.log(availableSkills.join("\n"));
    return;
  }

  const skillsToInstall = ensureValidSkills(options.selectedSkills);
  const destinationRoot = resolveDestination(options);

  const installedPaths = skillsToInstall.map((skillName) =>
    copySkill(skillName, destinationRoot),
  );

  console.log(`Installed ${skillsToInstall.length} skill(s) to ${destinationRoot}`);
  installedPaths.forEach((installedPath) => console.log(`- ${installedPath}`));
}

main();

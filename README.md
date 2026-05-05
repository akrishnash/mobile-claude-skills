# Flutter Claude Code Skills

A collection of production-grade Claude Code skills for Flutter app development. Each skill is a focused reference Claude can use while helping you build Flutter apps, covering the full stack from UI to deployment.

## Skills

| Skill | Slash Command | What it covers |
|---|---|---|
| **flutter-ui** | `/flutter-ui` | Widgets, Material 3 theming, animations, responsive layouts, custom painting, performance, accessibility |
| **flutter-backend** | `/flutter-backend` | Dio HTTP client, REST/GraphQL APIs, auth interceptors, token refresh, push notifications (FCM), WebSockets, offline queuing |
| **flutter-database** | `/flutter-database` | Drift (SQLite), Isar (NoSQL), Hive, SharedPreferences, Firestore, offline-first patterns, encryption, migrations |
| **flutter-auth-deploy** | `/flutter-auth-deploy` | Firebase Auth (email/Google/Apple), biometric auth, Play Console, app signing, GitHub Actions CI/CD, Fastlane, release tracks |
| **flutter-arch** | `/flutter-arch` | Clean architecture, Riverpod 2.0 + codegen, BLoC, get_it DI, Freezed models, use cases, testing strategy |
| **flutter-mobile** | `/flutter-mobile` | Platform channels, camera, location, Dart isolates, background tasks, deep links, local notifications, performance profiling |
| **flutter-polish** | `/flutter-polish` | UI polish, color palettes, spacing, typography, app-like interaction patterns, tactile motion, and design critique guidance inspired by top mobile apps |

## Stack

Skills default to:

- **State management**: Riverpod 2.0 with code generation
- **Local DB**: Drift (SQLite) for relational, Isar for NoSQL
- **HTTP**: Dio with interceptors
- **DI**: get_it + injectable
- **Models**: Freezed + json_serializable

## Install On Your Machine

### Direct install with `npx`

This is the easiest way to install the skills without keeping the package on your machine.

Install all skills into the current project's `.claude/skills` directory:

```bash
npx mobile-claude-skills --local
```

Install all skills into your machine-level Claude skills folder:

```bash
npx mobile-claude-skills --global
```

Install only specific skills into the current project:

```bash
npx mobile-claude-skills --local flutter-ui flutter-arch

npx mobile-claude-skills --local flutter-polish
```

Install into a custom target folder:

```bash
npx mobile-claude-skills --target ./.claude/skills --skills flutter-mobile,flutter-backend
```

List available skills:

```bash
npx mobile-claude-skills --list
```

### Install the CLI globally on your machine

If you want the command available all the time, install it once:

```bash
npm install -g mobile-claude-skills
```

Then run it directly:

```bash
mobile-claude-skills --global
mobile-claude-skills --local flutter-ui flutter-arch
mobile-claude-skills --local flutter-polish
```

### Where the skills are installed

- `--local` installs to `./.claude/skills`
- `--global` installs to `~/.claude/skills`
- `--target <path>` installs to any folder you choose

### Manual install

If you do not want to use npm or npx, copy the skill folders manually into Claude's skills directory.

Project-only install:

```bash
cp -r flutter-ui /your-project/.claude/skills/
```

Machine-wide install:

```bash
cp -r flutter-ui ~/.claude/skills/
```

## Usage

Skills trigger automatically when you describe a task in Claude Code. You can also invoke them explicitly:

```text
/flutter-arch         Set up clean architecture for a new feature
/flutter-database     Add Drift database with migrations
/flutter-ui           Build a custom animated card component
/flutter-backend      Set up Dio with auth interceptors
/flutter-auth-deploy  Configure Play Store release pipeline
/flutter-mobile       Add GPS location tracking with background updates
/flutter-polish       Make this screen feel like a polished real app
```

After installation, restart Claude Code if it was already open so it can pick up the new skill folders.

## Structure

```text
flutter-ui/
└── SKILL.md

flutter-arch/
└── SKILL.md

flutter-polish/
└── SKILL.md

... (same pattern for all 7 skills)
```

## Compatibility

- Flutter 3.10+
- Dart 3.0+
- Riverpod 2.x
- Claude Code (any version)

## Publish To npm

To make direct `npx mobile-claude-skills ...` installs work for everyone, publish this package to npm using the package name in [package.json](/e:/Projects%20Internet%20room/mobile-claude-skills/package.json).

```bash
npm login
npm publish --access public
```

After publishing, users can install straight from npm with:

```bash
npx mobile-claude-skills --local
```

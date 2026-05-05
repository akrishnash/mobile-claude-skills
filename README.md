# Flutter Claude Code Skills

A collection of deep, production-grade Claude Code skills for Flutter app development. Each skill is a focused reference that Claude can consult while helping you build Flutter apps — covering the full stack from UI to deployment.

## Skills

| Skill | Slash Command | What it covers |
|---|---|---|
| **flutter-ui** | `/flutter-ui` | Widgets, Material 3 theming, animations, responsive layouts, custom painting, performance, accessibility |
| **flutter-backend** | `/flutter-backend` | Dio HTTP client, REST/GraphQL APIs, auth interceptors, token refresh, push notifications (FCM), WebSockets, offline queuing |
| **flutter-database** | `/flutter-database` | Drift (SQLite), Isar (NoSQL), Hive, SharedPreferences, Firestore, offline-first patterns, encryption, migrations |
| **flutter-auth-deploy** | `/flutter-auth-deploy` | Firebase Auth (email/Google/Apple), biometric auth, Play Console, app signing, GitHub Actions CI/CD, Fastlane, release tracks |
| **flutter-arch** | `/flutter-arch` | Clean architecture, Riverpod 2.0 + codegen, BLoC, get_it DI, Freezed models, use cases, testing strategy |
| **flutter-mobile** | `/flutter-mobile` | Platform channels, camera, location, Dart isolates, background tasks, deep links, local notifications, performance profiling |

## Stack

Skills default to:
- **State management**: Riverpod 2.0 with code generation
- **Local DB**: Drift (SQLite) for relational, Isar for NoSQL
- **HTTP**: Dio with interceptors
- **DI**: get_it + injectable
- **Models**: Freezed + json_serializable

## Installation

### Option 1: Copy skills folder

Copy the skills you want into your project's `.claude/skills/` directory:

```bash
cp -r flutter-ui /your-project/.claude/skills/
```

### Option 2: Global install (available across all projects)

```bash
cp -r flutter-ui ~/.claude/skills/
```

### Option 3: Clone the whole pack

```bash
git clone https://github.com/youruser/flutter-claude-skills ~/.claude/skills/flutter-claude-skills
```

Then symlink individual skills:
```bash
ln -s ~/.claude/skills/flutter-claude-skills/flutter-arch ~/.claude/skills/flutter-arch
```

## Usage

Skills trigger automatically when you describe a task in Claude Code. You can also invoke them explicitly:

```
/flutter-arch     Set up clean architecture for a new feature
/flutter-database Add Drift database with migrations
/flutter-ui       Build a custom animated card component
/flutter-backend  Set up Dio with auth interceptors
/flutter-auth-deploy  Configure Play Store release pipeline
/flutter-mobile   Add GPS location tracking with background updates
```

## Structure

```
flutter-ui/
└── SKILL.md           — complete reference, loaded on trigger

flutter-arch/
└── SKILL.md           — complete reference, loaded on trigger

... (same pattern for all 6 skills)
```

## Compatibility

- Flutter 3.10+
- Dart 3.0+
- Riverpod 2.x
- Claude Code (any version)

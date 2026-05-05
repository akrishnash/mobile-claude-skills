---
name: flutter-arch
description: Deep Flutter architecture skill covering clean architecture layers (presentation/domain/data), feature-first folder structure, Riverpod 2.0 with code generation, BLoC pattern, dependency injection with get_it and injectable, Freezed for immutable models, use cases, repository pattern, testing strategy (unit/widget/integration), and code generation setup. Trigger this skill whenever the user is designing app structure, setting up state management, organizing features, implementing domain logic, wiring up dependency injection, writing tests, setting up code generation (build_runner, Freezed, Riverpod generator), or making architectural decisions about how the app should be structured.
---

# Flutter Architecture — Deep Reference

## Clean Architecture in Flutter

### The three layers

```
┌─────────────────────────────────┐
│  Presentation Layer             │  Widgets, Screens, ViewModels (Providers/BLoC)
│  — knows about UI only         │  No business logic here
├─────────────────────────────────┤
│  Domain Layer                   │  Entities, Use Cases, Repository interfaces
│  — no Flutter, no external dep  │  Pure Dart — most stable layer
├─────────────────────────────────┤
│  Data Layer                     │  Repository impls, Data Sources, DTOs, mappers
│  — talks to external world      │  API clients, databases, shared prefs
└─────────────────────────────────┘
```

**Dependency rule**: each layer depends only on layers inward. Domain knows nothing about data or presentation. Presentation knows about domain via interfaces.

---

## Feature-First Folder Structure

```
lib/
├── core/
│   ├── config/         # AppConfig, constants
│   ├── error/          # AppError, Either, failures
│   ├── network/        # Dio setup, interceptors
│   ├── router/         # GoRouter, route constants
│   ├── theme/          # ThemeData, AppColors
│   └── utils/          # extensions, helpers
│
├── data/
│   ├── models/         # DTOs (API response shapes)
│   ├── sources/        # remote and local data sources
│   └── repositories/   # repository implementations
│
├── domain/
│   ├── entities/       # pure Dart business objects
│   ├── repositories/   # abstract repository interfaces
│   └── usecases/       # one file per use case
│
├── features/
│   ├── auth/
│   │   ├── providers/  # Riverpod notifiers for this feature
│   │   ├── screens/    # AuthScreen, LoginScreen
│   │   └── widgets/    # feature-specific widgets
│   ├── trek_list/
│   │   ├── providers/
│   │   ├── screens/
│   │   └── widgets/
│   └── trek_detail/
│       ├── providers/
│       ├── screens/
│       └── widgets/
│
└── shared/
    └── widgets/        # reusable across features
```

---

## Riverpod 2.0 — Code Generation Approach

### Setup

```yaml
# pubspec.yaml
dependencies:
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

dev_dependencies:
  riverpod_generator: ^2.4.3
  build_runner: ^2.4.0
```

```bash
# Generate code
flutter pub run build_runner watch --delete-conflicting-outputs
# or: dart run build_runner watch
```

### Provider types and when to use each

```dart
// @riverpod (lowercase) — always auto-disposed when no one is watching
// @Riverpod(keepAlive: true) — lives forever (use for repositories, singletons)

// 1. Simple computed value — no async, no mutation
@riverpod
int trekCount(TrekCountRef ref) => ref.watch(trekListProvider).valueOrNull?.length ?? 0;

// 2. Async value — HTTP/DB fetch, auto-handles loading/error states
@riverpod
Future<List<Trek>> trekList(TrekListRef ref) =>
    ref.watch(trekRepositoryProvider).getTreks();

// 3. Stream — real-time DB or WebSocket
@riverpod
Stream<List<Trek>> trekStream(TrekStreamRef ref) =>
    ref.watch(trekRepositoryProvider).watchTreks();

// 4. StateNotifier — mutable state with methods
@riverpod
class TrekForm extends _$TrekForm {
  @override
  TrekFormState build() => const TrekFormState();

  void setName(String name) => state = state.copyWith(name: name);
  void setDistance(double d) => state = state.copyWith(distance: d);

  Future<void> submit() async {
    state = state.copyWith(isSubmitting: true, error: null);
    final result = await ref.read(trekRepositoryProvider).createTrek(
      CreateTrekParams(name: state.name, distance: state.distance),
    );
    result.fold(
      (error) => state = state.copyWith(isSubmitting: false, error: error.message),
      (trek) {
        ref.invalidate(trekListProvider); // refresh list after creating
        state = const TrekFormState();
      },
    );
  }
}

// 5. Family — parameterized providers
@riverpod
Future<Trek> trekDetail(TrekDetailRef ref, String trekId) =>
    ref.watch(trekRepositoryProvider).getTrek(trekId);
```

### Consuming providers

```dart
class TrekListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final treksAsync = ref.watch(trekListProvider);

    return treksAsync.when(
      data: (treks) => TrekListView(treks: treks),
      loading: () => const LoadingView(),
      error: (error, _) => ErrorView(error: error),
    );
  }
}

// One-time action in a callback (not in build)
ElevatedButton(
  onPressed: () => ref.read(trekFormProvider.notifier).submit(),
)

// Listen to state changes (side effects, navigation)
ref.listen(trekFormProvider.select((s) => s.isSuccess), (_, isSuccess) {
  if (isSuccess) context.go('/treks');
});
```

### Provider communication — ref patterns

```dart
// Watch — rebuild when dependency changes
final treks = ref.watch(trekListProvider);

// Read — one-time access, no rebuild subscription
await ref.read(trekRepositoryProvider).deleteTrek(id);

// Invalidate — force provider to re-fetch
ref.invalidate(trekListProvider);

// Refresh — invalidate + return new future
final refreshed = await ref.refresh(trekListProvider.future);

// Select — rebuild only when specific field changes (optimization)
final name = ref.watch(currentUserProvider.select((u) => u?.displayName));

// onDispose — cleanup resources
@override
TrekListState build() {
  ref.onDispose(() => _subscription?.cancel());
  return const TrekListState();
}
```

---

## Freezed — Immutable Models

### Setup

```yaml
dependencies:
  freezed_annotation: ^2.4.1

dev_dependencies:
  freezed: ^2.5.2
  build_runner: ^2.4.0
```

### Data class (value equality, copyWith, pattern matching)

```dart
// lib/domain/entities/trek.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'trek.freezed.dart';
part 'trek.g.dart'; // for json_serializable

@freezed
class Trek with _$Trek {
  const factory Trek({
    required String id,
    required String name,
    required double distance,
    @Default('easy') String difficulty,
    @Default([]) List<String> tags,
    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _Trek;

  // Custom methods on frozen class
  const Trek._();
  bool get isLongDistance => distance > 20;
  String get formattedDistance => '${distance.toStringAsFixed(1)} km';

  factory Trek.fromJson(Map<String, dynamic> json) => _$TrekFromJson(json);
}
```

### Sealed union (discriminated types)

```dart
@freezed
class AuthState with _$AuthState {
  const factory AuthState.initial() = AuthInitial;
  const factory AuthState.loading() = AuthLoading;
  const factory AuthState.authenticated(User user) = AuthAuthenticated;
  const factory AuthState.unauthenticated() = AuthUnauthenticated;
  const factory AuthState.error(String message) = AuthError;
}

// Pattern match in UI
state.when(
  initial: () => const SplashScreen(),
  loading: () => const LoadingScreen(),
  authenticated: (user) => HomeScreen(user: user),
  unauthenticated: () => const LoginScreen(),
  error: (msg) => ErrorScreen(message: msg),
);

// Or maybeWhen for partial handling
state.maybeWhen(
  authenticated: (user) => Text('Hello, ${user.displayName}'),
  orElse: () => const SizedBox.shrink(),
);
```

---

## Use Cases

Use cases enforce single-responsibility for business logic. Each use case does exactly one thing.

```dart
// lib/domain/usecases/create_trek_usecase.dart
@injectable
class CreateTrekUseCase {
  CreateTrekUseCase(this._repository, this._idGenerator);
  final TrekRepository _repository;
  final IdGenerator _idGenerator;

  Future<Either<AppError, Trek>> call(CreateTrekParams params) async {
    // Validate
    if (params.name.trim().isEmpty) {
      return Left(AppError.validation({'name': ['Name cannot be empty']}));
    }
    if (params.distance <= 0) {
      return Left(AppError.validation({'distance': ['Distance must be positive']}));
    }

    // Build entity
    final trek = Trek(
      id: _idGenerator.generate(),
      name: params.name.trim(),
      distance: params.distance,
      difficulty: params.difficulty,
      createdAt: DateTime.now(),
    );

    return _repository.createTrek(trek);
  }
}

@freezed
class CreateTrekParams with _$CreateTrekParams {
  const factory CreateTrekParams({
    required String name,
    required double distance,
    @Default('easy') String difficulty,
    @Default([]) List<String> tags,
  }) = _CreateTrekParams;
}
```

---

## Dependency Injection — get_it + injectable

### Setup

```yaml
dependencies:
  get_it: ^7.7.0
  injectable: ^2.4.2
dev_dependencies:
  injectable_generator: ^2.6.2
  build_runner: ^2.4.0
```

### Registration

```dart
// lib/core/di/injection.dart
import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';
import 'injection.config.dart';

final getIt = GetIt.instance;

@InjectableInit()
Future<void> configureDependencies(AppEnvironment env) async =>
    getIt.init(environment: env.name);

// In main.dart
await configureDependencies(AppEnvironment.prod);
```

### Annotating classes

```dart
// Singleton — one instance for the entire app lifetime
@singleton
class TokenStorage { ... }

// LazySingleton — created on first access
@lazySingleton
class AppDatabase { ... }

// Injectable — new instance each time
@injectable
class CreateTrekUseCase { ... }

// Environment-specific registrations
@dev
@LazySingleton(as: ApiClient)
class MockApiClient implements ApiClient { ... }

@prod
@LazySingleton(as: ApiClient)
class RealApiClient implements ApiClient { ... }

// Factory with parameters
@injectable
class TrekListNotifier extends StateNotifier<TrekListState> {
  TrekListNotifier(@factoryParam String filter, TrekRepository repo)
      : super(const TrekListState());
}
```

### Riverpod + get_it bridge

```dart
// Use get_it in Riverpod providers when needed
@Riverpod(keepAlive: true)
TrekRepository trekRepository(TrekRepositoryRef ref) => getIt<TrekRepository>();
```

---

## BLoC Pattern (Enterprise / Team Alternative)

Use BLoC when you need strict event-driven flow, team conventions, or tooling.

```yaml
dependencies:
  flutter_bloc: ^8.1.6
  bloc: ^8.1.4
```

```dart
// Events — sealed, immutable, one per user action
@freezed
class TrekEvent with _$TrekEvent {
  const factory TrekEvent.loadTreks() = LoadTreks;
  const factory TrekEvent.createTrek(CreateTrekParams params) = CreateTrek;
  const factory TrekEvent.deleteTrek(String id) = DeleteTrek;
  const factory TrekEvent.refreshTreks() = RefreshTreks;
}

// State
@freezed
class TrekState with _$TrekState {
  const factory TrekState.initial() = TrekInitial;
  const factory TrekState.loading() = TrekLoading;
  const factory TrekState.loaded(List<Trek> treks) = TrekLoaded;
  const factory TrekState.error(String message) = TrekError;
}

// BLoC
class TrekBloc extends Bloc<TrekEvent, TrekState> {
  TrekBloc(this._repository) : super(const TrekState.initial()) {
    on<LoadTreks>(_onLoad);
    on<CreateTrek>(_onCreate);
    on<DeleteTrek>(_onDelete);
    on<RefreshTreks>((_, emit) => add(const TrekEvent.loadTreks()));
  }
  final TrekRepository _repository;

  Future<void> _onLoad(LoadTreks event, Emitter<TrekState> emit) async {
    emit(const TrekState.loading());
    final result = await _repository.getTreks();
    result.fold(
      (error) => emit(TrekState.error(error.message)),
      (treks) => emit(TrekState.loaded(treks)),
    );
  }

  Future<void> _onCreate(CreateTrek event, Emitter<TrekState> emit) async {
    final result = await _repository.createTrek(event.params);
    result.fold(
      (error) => emit(TrekState.error(error.message)),
      (_) => add(const TrekEvent.refreshTreks()),
    );
  }
}

// UI
BlocProvider(
  create: (ctx) => getIt<TrekBloc>()..add(const TrekEvent.loadTreks()),
  child: BlocBuilder<TrekBloc, TrekState>(
    builder: (ctx, state) => state.when(
      initial: () => const SizedBox.shrink(),
      loading: () => const CircularProgressIndicator(),
      loaded: (treks) => TrekListView(treks: treks),
      error: (msg) => ErrorView(message: msg),
    ),
  ),
)
```

---

## Testing Strategy

### Three test levels

```
Unit Tests         — domain logic, use cases, repository impls (fast, no Flutter)
Widget Tests       — individual widgets in isolation with fakes
Integration Tests  — full app flow on device/emulator (slow, run in CI)
```

### Unit test — use case with mocks

```dart
// pubspec.yaml dev: mocktail: ^1.0.4
// test/domain/usecases/create_trek_usecase_test.dart

class MockTrekRepository extends Mock implements TrekRepository {}
class MockIdGenerator extends Mock implements IdGenerator {}

void main() {
  late CreateTrekUseCase useCase;
  late MockTrekRepository repository;
  late MockIdGenerator idGenerator;

  setUp(() {
    repository = MockTrekRepository();
    idGenerator = MockIdGenerator();
    useCase = CreateTrekUseCase(repository, idGenerator);
    when(() => idGenerator.generate()).thenReturn('test-id-1');
  });

  group('CreateTrekUseCase', () {
    test('returns error when name is empty', () async {
      final result = await useCase(const CreateTrekParams(name: '', distance: 10));
      expect(result.isLeft(), isTrue);
      final error = result.fold((l) => l, (r) => throw Exception());
      expect(error, isA<ValidationError>());
    });

    test('creates trek successfully', () async {
      final trek = Trek(id: 'test-id-1', name: 'Everest', distance: 120, createdAt: DateTime.now());
      when(() => repository.createTrek(any())).thenAnswer((_) async => Right(trek));

      final result = await useCase(const CreateTrekParams(name: 'Everest', distance: 120));
      expect(result.isRight(), isTrue);
      verify(() => repository.createTrek(any())).called(1);
    });
  });
}
```

### Widget test — with Riverpod overrides

```dart
// test/features/trek_list/trek_list_screen_test.dart
void main() {
  testWidgets('shows loading indicator while fetching', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          trekListProvider.overrideWith((ref) => Future.delayed(
            const Duration(seconds: 10), () => <Trek>[],
          )),
        ],
        child: const MaterialApp(home: TrekListScreen()),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('shows trek names when loaded', (tester) async {
    final treks = [Trek(id: '1', name: 'K2 Base Camp', distance: 80, createdAt: DateTime.now())];

    await tester.pumpWidget(
      ProviderScope(
        overrides: [trekListProvider.overrideWith((ref) => Future.value(treks))],
        child: const MaterialApp(home: TrekListScreen()),
      ),
    );

    await tester.pump(); // let Future resolve
    expect(find.text('K2 Base Camp'), findsOneWidget);
  });
}
```

### Integration test

```dart
// integration_test/app_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:trek_diary/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full trek creation flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    // Tap add button
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();

    // Fill form
    await tester.enterText(find.byKey(const Key('trek_name_field')), 'Annapurna Circuit');
    await tester.enterText(find.byKey(const Key('trek_distance_field')), '160');

    // Submit
    await tester.tap(find.text('Create Trek'));
    await tester.pumpAndSettle();

    // Verify
    expect(find.text('Annapurna Circuit'), findsOneWidget);
  });
}
```

```bash
# Run integration tests
flutter test integration_test/ -d emulator-5554
```

---

## Code Generation — Full Setup

### analysis_options.yaml

```yaml
analyzer:
  strong-mode:
    implicit-casts: false
    implicit-dynamic: false
  errors:
    invalid_annotation_target: ignore # suppress Freezed noise
  exclude:
    - '**/*.g.dart'
    - '**/*.freezed.dart'

linter:
  rules:
    - prefer_const_constructors
    - prefer_const_declarations
    - always_use_package_imports
    - avoid_print
    - prefer_final_locals
    - require_trailing_commas
```

### Build runner commands

```bash
# One-time generation
dart run build_runner build --delete-conflicting-outputs

# Watch mode (during development)
dart run build_runner watch --delete-conflicting-outputs

# Specific file only
dart run build_runner build --build-filter="lib/domain/entities/trek.dart"
```

### Common generated file patterns

| Annotation | Generated file | What it creates |
|---|---|---|
| `@freezed` | `*.freezed.dart` | copyWith, equality, pattern matching |
| `@JsonSerializable` | `*.g.dart` | fromJson, toJson |
| `@riverpod` | `*.g.dart` | Provider, Ref, Notifier base classes |
| `@injectable` | `injection.config.dart` | GetIt registration code |
| `@DriftDatabase` | `*.g.dart` | Database, DAO, companion classes |

---

## Either — Explicit Error Handling

```yaml
dependencies:
  fpdart: ^1.1.0  # Either, Option, TaskEither
```

```dart
// Repository returns Either — caller decides how to handle error
Future<Either<AppError, Trek>> getTrek(String id);

// In use case — transform or chain
Future<Either<AppError, TrekViewModel>> getTrekViewModel(String id) =>
    getTrek(id).then((result) => result.map(TrekViewModel.fromTrek));

// In provider — surface to UI
@riverpod
Future<Trek> trekDetail(TrekDetailRef ref, String id) async {
  final result = await ref.watch(trekRepositoryProvider).getTrek(id);
  return result.getOrElse((error) => throw error); // convert to AsyncError
}
```

---

## Architectural Anti-Patterns to Avoid

| Anti-pattern | Problem | Fix |
|---|---|---|
| Business logic in widgets | Hard to test, duplicated | Move to use case or provider |
| Providers watching other providers in loops | Circular dependency, infinite rebuild | Redesign dependency graph |
| Giant god providers | Hard to test, poor separation | Split by responsibility |
| Calling `ref.read` in `build` | Misses updates | Use `ref.watch` in build |
| Calling `ref.watch` in async methods | Invalid access after disposal | Use `ref.read` in async callbacks |
| No dispose for controllers | Memory leaks | Always dispose AnimationControllers, TextEditingControllers |
| Deeply nested widget trees without extraction | Unreadable, hard to test | Extract into named widgets |

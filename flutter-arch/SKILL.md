---
name: flutter-arch
description: Deep Flutter architecture skill covering clean architecture layers (presentation/domain/data), feature-first folder structure, Riverpod 2.0 with code generation, BLoC pattern, dependency injection with get_it and injectable, Freezed for immutable models, use cases, repository pattern, testing strategy (unit/widget/integration), and code generation setup. Trigger this skill whenever the user is designing app structure, setting up state management, organizing features, implementing domain logic, wiring up dependency injection, writing tests, setting up code generation (build_runner, Freezed, Riverpod generator), or making architectural decisions about how the app should be structured.
---

# Flutter Architecture — Deep Reference

## Clean Architecture in Flutter

- **Presentation**: Widgets, Screens, ViewModels (Providers/BLoC) — no business logic
- **Domain**: Entities, Use Cases, Repository interfaces — pure Dart, no Flutter deps
- **Data**: Repository impls, Data Sources, DTOs, mappers — talks to external world

**Dependency rule**: each layer depends only on layers inward. Domain knows nothing about data or presentation.

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

## Riverpod 2.0 — Code Generation Approach

// flutter_riverpod: ^2.5.1, riverpod_annotation: ^2.3.5, riverpod_generator: ^2.4.3

```bash
dart run build_runner watch --delete-conflicting-outputs
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
        ref.invalidate(trekListProvider);
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
final treks = ref.watch(trekListProvider);           // rebuild when dependency changes
await ref.read(trekRepositoryProvider).deleteTrek(id); // one-time access, no rebuild
ref.invalidate(trekListProvider);                    // force provider to re-fetch
final refreshed = await ref.refresh(trekListProvider.future); // invalidate + return new future
final name = ref.watch(currentUserProvider.select((u) => u?.displayName)); // rebuild only when field changes

@override
TrekListState build() {
  ref.onDispose(() => _subscription?.cancel()); // cleanup resources
  return const TrekListState();
}
```

## Freezed — Immutable Models

// freezed_annotation: ^2.4.1, freezed: ^2.5.2

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

state.maybeWhen(
  authenticated: (user) => Text('Hello, ${user.displayName}'),
  orElse: () => const SizedBox.shrink(),
);
```

## Use Cases

```dart
// lib/domain/usecases/create_trek_usecase.dart
@injectable
class CreateTrekUseCase {
  CreateTrekUseCase(this._repository, this._idGenerator);
  final TrekRepository _repository;
  final IdGenerator _idGenerator;

  Future<Either<AppError, Trek>> call(CreateTrekParams params) async {
    if (params.name.trim().isEmpty) {
      return Left(AppError.validation({'name': ['Name cannot be empty']}));
    }
    if (params.distance <= 0) {
      return Left(AppError.validation({'distance': ['Distance must be positive']}));
    }

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

## Dependency Injection — get_it + injectable

// get_it: ^7.7.0, injectable: ^2.4.2, injectable_generator: ^2.6.2

```dart
// lib/core/di/injection.dart
final getIt = GetIt.instance;

@InjectableInit()
Future<void> configureDependencies(AppEnvironment env) async =>
    getIt.init(environment: env.name);

// In main.dart
await configureDependencies(AppEnvironment.prod);
```

### Annotating classes

```dart
@singleton
class TokenStorage { ... }          // one instance for app lifetime

@lazySingleton
class AppDatabase { ... }           // created on first access

@injectable
class CreateTrekUseCase { ... }     // new instance each time

@dev
@LazySingleton(as: ApiClient)
class MockApiClient implements ApiClient { ... }

@prod
@LazySingleton(as: ApiClient)
class RealApiClient implements ApiClient { ... }

@injectable
class TrekListNotifier extends StateNotifier<TrekListState> {
  TrekListNotifier(@factoryParam String filter, TrekRepository repo)
      : super(const TrekListState());
}
```

### Riverpod + get_it bridge

```dart
@Riverpod(keepAlive: true)
TrekRepository trekRepository(TrekRepositoryRef ref) => getIt<TrekRepository>();
```

## BLoC Pattern (Enterprise / Team Alternative)

// flutter_bloc: ^8.1.6, bloc: ^8.1.4

```dart
// Events — sealed, immutable, one per user action
@freezed
class TrekEvent with _$TrekEvent {
  const factory TrekEvent.loadTreks() = LoadTreks;
  const factory TrekEvent.createTrek(CreateTrekParams params) = CreateTrek;
  const factory TrekEvent.deleteTrek(String id) = DeleteTrek;
  const factory TrekEvent.refreshTreks() = RefreshTreks;
}

@freezed
class TrekState with _$TrekState {
  const factory TrekState.initial() = TrekInitial;
  const factory TrekState.loading() = TrekLoading;
  const factory TrekState.loaded(List<Trek> treks) = TrekLoaded;
  const factory TrekState.error(String message) = TrekError;
}

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

## Testing Strategy

- **Unit Tests** — domain logic, use cases, repository impls (fast, no Flutter)
- **Widget Tests** — individual widgets in isolation with fakes
- **Integration Tests** — full app flow on device/emulator (slow, run in CI)

### Unit test — use case with mocks

```dart
// pubspec.yaml dev: mocktail: ^1.0.4
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

    await tester.pump();
    expect(find.text('K2 Base Camp'), findsOneWidget);
  });
}
```

### Integration test

```dart
// integration_test/app_test.dart
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('full trek creation flow', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('trek_name_field')), 'Annapurna Circuit');
    await tester.enterText(find.byKey(const Key('trek_distance_field')), '160');

    await tester.tap(find.text('Create Trek'));
    await tester.pumpAndSettle();

    expect(find.text('Annapurna Circuit'), findsOneWidget);
  });
}
```

```bash
flutter test integration_test/ -d emulator-5554
```

## Code Generation — Generated File Patterns

| Annotation | Generated file | What it creates |
|---|---|---|
| `@freezed` | `*.freezed.dart` | copyWith, equality, pattern matching |
| `@JsonSerializable` | `*.g.dart` | fromJson, toJson |
| `@riverpod` | `*.g.dart` | Provider, Ref, Notifier base classes |
| `@injectable` | `injection.config.dart` | GetIt registration code |
| `@DriftDatabase` | `*.g.dart` | Database, DAO, companion classes |

## Either — Explicit Error Handling

// fpdart: ^1.1.0

```dart
Future<Either<AppError, Trek>> getTrek(String id);

Future<Either<AppError, TrekViewModel>> getTrekViewModel(String id) =>
    getTrek(id).then((result) => result.map(TrekViewModel.fromTrek));

@riverpod
Future<Trek> trekDetail(TrekDetailRef ref, String id) async {
  final result = await ref.watch(trekRepositoryProvider).getTrek(id);
  return result.getOrElse((error) => throw error);
}
```

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

---
name: flutter-database
description: Deep Flutter database skill covering Drift (type-safe SQLite with DAOs and migrations), Isar (fast embedded NoSQL), Hive (key-value store), SharedPreferences, Firestore (real-time cloud), offline-first architecture, encryption, and caching strategies. Trigger this skill whenever the user needs to store, query, migrate, or sync data in a Flutter app — whether local persistence, cloud sync, offline-first patterns, data modeling, encryption, or choosing between database options.
---

# Flutter Database — Deep Reference

## Choosing the Right Database

| Database | Best for | Avoid when |
|---|---|---|
| **Drift (SQLite)** | Relational data, complex queries, migrations, large datasets | Rapid prototyping, simple key-value |
| **Isar** | High-performance NoSQL, full-text search, reactive queries | Need SQL JOINs, strict relational integrity |
| **SharedPreferences** | App settings, flags, small primitives only | Anything complex or large |
| **Firestore** | Real-time sync, multi-device, social features | Offline-only apps, budget-sensitive reads |
| **SQLite via sqflite** | Raw SQL needed, full control | Most cases — prefer Drift instead |

## Drift (Type-Safe SQLite)

// drift: ^2.18.0, sqlite3_flutter_libs: ^0.5.0, path_provider: ^2.1.0, path: ^1.9.0
// dev: drift_dev: ^2.18.0, build_runner: ^2.4.0

### Defining tables

```dart
// lib/data/local/tables/treks_table.dart
class Treks extends Table {
  TextColumn get id => text()();
  TextColumn get name => text().withLength(min: 1, max: 200)();
  RealColumn get distance => real().withDefault(const Constant(0.0))();
  TextColumn get difficulty => text().withDefault(const Constant('easy'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  BoolColumn get isSynced => boolean().withDefault(const Constant(false))();
  TextColumn get tags => text().nullable()(); // JSON array stored as text

  @override
  Set<Column> get primaryKey => {id};
}

class TrekStops extends Table {
  TextColumn get id => text()();
  TextColumn get trekId => text().references(Treks, #id, onDelete: KeyAction.cascade)();
  TextColumn get name => text()();
  RealColumn get latitude => real()();
  RealColumn get longitude => real()();
  IntColumn get order => integer()();

  @override
  Set<Column> get primaryKey => {id};
}
```

### Database class with DAO

```dart
// lib/data/local/app_database.dart
part 'app_database.g.dart';

@DriftDatabase(tables: [Treks, TrekStops], daos: [TrekDao])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      if (from < 2) await m.addColumn(treks, treks.isSynced);
      if (from < 3) await m.createTable(trekStops);
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA journal_mode=WAL');
      await customStatement('PRAGMA foreign_keys=ON');
    },
  );
}

LazyDatabase _openConnection() => LazyDatabase(() async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File(p.join(dir.path, 'trek_diary.db'));
  return NativeDatabase.createInBackground(file);
});
```

### DAO (Data Access Object)

```dart
@DriftAccessor(tables: [Treks, TrekStops])
class TrekDao extends DatabaseAccessor<AppDatabase> with _$TrekDaoMixin {
  TrekDao(super.db);

  Stream<List<Trek>> watchAllTreks() =>
      (select(treks)..orderBy([(t) => OrderingTerm.desc(t.createdAt)])).watch();

  Future<List<Trek>> getAllTreks() =>
      (select(treks)..orderBy([(t) => OrderingTerm.desc(t.createdAt)])).get();

  Future<Map<Trek, List<TrekStop>>> getTreksWithStops() async {
    final query = select(treks).join([
      leftOuterJoin(trekStops, trekStops.trekId.equalsExp(treks.id)),
    ]);
    final rows = await query.get();
    return rows.fold({}, (map, row) {
      final trek = row.readTable(treks);
      final stop = row.readTableOrNull(trekStops);
      (map[trek] ??= []).addIfNotNull(stop);
      return map;
    });
  }

  Future<void> upsertTrek(TreksCompanion trek) =>
      into(treks).insertOnConflictUpdate(trek);

  Future<int> deleteTrek(String id) =>
      (delete(treks)..where((t) => t.id.equals(id))).go();

  Future<List<Trek>> getUnsynced() =>
      (select(treks)..where((t) => t.isSynced.equals(false))).get();

  Future<List<Trek>> searchTreks(String query) =>
      (select(treks)..where((t) => t.name.like('%$query%'))).get();

  Future<void> insertAll(List<TreksCompanion> newTreks) =>
      batch((b) => b.insertAllOnConflictUpdate(treks, newTreks));

  Future<void> createTrekWithStops(TreksCompanion trek, List<TrekStopsCompanion> stops) =>
      transaction(() async {
        await into(treks).insert(trek);
        await batch((b) => b.insertAll(trekStops, stops));
      });
}
```

### Riverpod provider

```dart
@riverpod
AppDatabase appDatabase(AppDatabaseRef ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
}

@riverpod
TrekDao trekDao(TrekDaoRef ref) => ref.watch(appDatabaseProvider).trekDao;

@riverpod
Stream<List<Trek>> trekList(TrekListRef ref) =>
    ref.watch(trekDaoProvider).watchAllTreks();
```

## Isar (Fast Embedded NoSQL)

// isar: ^3.1.0, isar_flutter_libs: ^3.1.0, path_provider: ^2.1.0
// dev: isar_generator: ^3.1.0, build_runner: ^2.4.0

```dart
// lib/data/local/collections/trek_collection.dart
@collection
class TrekCollection {
  Id id = Isar.autoIncrement;

  @Index(type: IndexType.value)
  late String remoteId;

  @Index(type: IndexType.hash)
  late String name;

  late double distance;
  late String difficulty;
  late DateTime createdAt;
  late bool isSynced;

  @Index(type: IndexType.value, composite: [CompositeIndex('difficulty')])
  late String region;

  @ignore
  String get displayName => '$name ($region)';
}
```

```dart
class IsarDatabase {
  static Isar? _instance;

  static Future<Isar> get instance async {
    _instance ??= await Isar.open(
      [TrekCollectionSchema, StopCollectionSchema],
      directory: (await getApplicationDocumentsDirectory()).path,
      name: 'trek_diary',
    );
    return _instance!;
  }
}

class TrekIsarRepository {
  Future<List<TrekCollection>> getAll() async {
    final isar = await IsarDatabase.instance;
    return isar.trekCollections.where().findAll();
  }

  Stream<List<TrekCollection>> watchAll() async* {
    final isar = await IsarDatabase.instance;
    yield* isar.trekCollections.where().watch(fireImmediately: true);
  }

  Future<List<TrekCollection>> getByRegion(String region) async {
    final isar = await IsarDatabase.instance;
    return isar.trekCollections.filter().regionEqualTo(region).sortByDistanceDesc().findAll();
  }

  Future<List<TrekCollection>> search(String query) async {
    final isar = await IsarDatabase.instance;
    return isar.trekCollections.filter().nameContains(query, caseSensitive: false).findAll();
  }

  Future<void> save(TrekCollection trek) async {
    final isar = await IsarDatabase.instance;
    await isar.writeTxn(() => isar.trekCollections.put(trek));
  }

  Future<void> delete(int id) async {
    final isar = await IsarDatabase.instance;
    await isar.writeTxn(() => isar.trekCollections.delete(id));
  }

  Future<void> saveAll(List<TrekCollection> treks) async {
    final isar = await IsarDatabase.instance;
    await isar.writeTxn(() => isar.trekCollections.putAll(treks));
  }
}
```

## SharedPreferences

// Use only for simple primitives: auth tokens, onboarding flags, last sync time

```dart
@riverpod
Future<SharedPreferences> sharedPreferences(SharedPreferencesRef ref) =>
    SharedPreferences.getInstance();

class AppPreferences {
  AppPreferences(this._prefs);
  final SharedPreferences _prefs;

  static const _keyTheme = 'theme';
  static const _keyOnboarded = 'onboarded';
  static const _keyLastSync = 'last_sync';

  String get theme => _prefs.getString(_keyTheme) ?? 'system';
  Future<void> setTheme(String v) => _prefs.setString(_keyTheme, v);

  bool get isOnboarded => _prefs.getBool(_keyOnboarded) ?? false;
  Future<void> setOnboarded() => _prefs.setBool(_keyOnboarded, true);

  DateTime? get lastSync {
    final ms = _prefs.getInt(_keyLastSync);
    return ms != null ? DateTime.fromMillisecondsSinceEpoch(ms) : null;
  }
  Future<void> setLastSync(DateTime dt) => _prefs.setInt(_keyLastSync, dt.millisecondsSinceEpoch);
}
```

## Firestore (Cloud Real-time Database)

// cloud_firestore: ^4.17.0, firebase_core: ^2.32.0

```dart
// main.dart — enable offline persistence
await Firebase.initializeApp();
FirebaseFirestore.instance.settings = const Settings(persistenceEnabled: true, cacheSizeBytes: Settings.CACHE_SIZE_UNLIMITED);

class FirestoreTrekRepository {
  final _db = FirebaseFirestore.instance;
  final _userId = FirebaseAuth.instance.currentUser!.uid;

  CollectionReference<Map<String, dynamic>> get _treks =>
      _db.collection('users').doc(_userId).collection('treks');

  Stream<List<Trek>> watchTreks() => _treks
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map((d) => Trek.fromFirestore(d)).toList());

  Future<List<Trek>> getTreks({DocumentSnapshot? startAfter, int limit = 20}) async {
    Query<Map<String, dynamic>> query = _treks.orderBy('createdAt', descending: true).limit(limit);
    if (startAfter != null) query = query.startAfterDocument(startAfter);
    final snapshot = await query.get(const GetOptions(source: Source.serverAndCache));
    return snapshot.docs.map(Trek.fromFirestore).toList();
  }

  Future<void> createTrek(Trek trek) => _treks.doc(trek.id).set(trek.toFirestore());

  Future<void> updateTrek(String id, Map<String, dynamic> data) =>
      _treks.doc(id).update({...data, 'updatedAt': FieldValue.serverTimestamp()});

  Future<void> deleteTrek(String id) => _treks.doc(id).delete();

  Future<void> syncTreks(List<Trek> treks) async {
    final batch = _db.batch();
    for (final trek in treks) {
      batch.set(_treks.doc(trek.id), trek.toFirestore(), SetOptions(merge: true));
    }
    await batch.commit();
  }

  Future<void> incrementViews(String trekId) => _db.runTransaction((tx) async {
    final ref = _treks.doc(trekId);
    final snap = await tx.get(ref);
    tx.update(ref, {'views': (snap.data()?['views'] ?? 0) + 1});
  });
}
```

### Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/treks/{trekId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow create: if request.resource.data.name is string
                   && request.resource.data.name.size() > 0;
    }
  }
}
```

## Offline-First Architecture

```dart
// lib/data/sync/sync_manager.dart
@riverpod
class SyncManager extends _$SyncManager {
  @override
  SyncState build() => const SyncState.idle();

  Future<void> sync() async {
    if (state is SyncStateSyncing) return;
    state = const SyncState.syncing();

    try {
      // 1. Push local changes
      final unsynced = await ref.read(trekDaoProvider).getUnsynced();
      for (final trek in unsynced) {
        await ref.read(trekRemoteSourceProvider).createTrek(trek.toCreateRequest());
        await ref.read(trekDaoProvider).upsertTrek(trek.copyWith(isSynced: true));
      }

      // 2. Pull remote changes since last sync
      final lastSync = ref.read(appPreferencesProvider).lastSync;
      final remote = await ref.read(trekRemoteSourceProvider).fetchSince(lastSync);
      await ref.read(trekDaoProvider).insertAll(remote.map((t) => t.toCompanion()).toList());

      // 3. Update last sync timestamp
      await ref.read(appPreferencesProvider).setLastSync(DateTime.now());
      state = const SyncState.success();
    } catch (e) {
      state = SyncState.error(e.toString());
    }
  }
}

// Trigger sync on app foreground
class AppLifecycleObserver extends WidgetsBindingObserver {
  AppLifecycleObserver(this.ref);
  final WidgetRef ref;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref.read(syncManagerProvider.notifier).sync();
    }
  }
}
```

### Conflict resolution strategies
// last-write-wins: compare updatedAt timestamps
// server-wins: always overwrite local on pull (catalog/master data)
// client-wins: push local, ignore server conflicts (user-owned data)
// merge: field-level merge with SetOptions(merge: true) (collaborative data)

## Data Encryption

// flutter_secure_storage: ^9.0.0

```dart
// Encryption key stored in Keychain/Keystore (hardware-backed on Android 6+)
final secureStorage = const FlutterSecureStorage();

Future<Uint8List> getEncryptionKey() async {
  final existing = await secureStorage.read(key: 'db_encryption_key');
  if (existing != null) return base64.decode(existing);

  final key = Hive.generateSecureKey();
  await secureStorage.write(key: 'db_encryption_key', value: base64.encode(key));
  return Uint8List.fromList(key);
}

// Encrypted Hive box
final key = await getEncryptionKey();
await Hive.openBox<UserPreferences>('secure_preferences', encryptionCipher: HiveAesCipher(key));

// Encrypted Drift database — use sqlcipher_flutter_libs instead of sqlite3_flutter_libs
LazyDatabase _openEncryptedConnection(String password) => LazyDatabase(() async {
  final dir = await getApplicationDocumentsDirectory();
  final file = File(p.join(dir.path, 'encrypted.db'));
  return NativeDatabase.createInBackground(file, setup: (db) {
    db.execute("PRAGMA key = '$password'");
  });
});
```

## Migration Patterns

```dart
// Always use step-by-step migrator — never skip versions
@override
MigrationStrategy get migration => MigrationStrategy(
  onUpgrade: (m, from, to) async {
    await m.runMigrationSteps(from: from, to: to, steps: migrationSteps);
  },
);

final migrationSteps = MigrationSteps(
  stepBy1: (m, schema) async {
    await m.addColumn(schema.treks, schema.treks.isSynced);
  },
  stepBy2: (m, schema) async {
    await m.createTable(schema.trekStops);
  },
  stepBy3: (m, schema) async {
    await m.alterTable(TableMigration(schema.treks, columnTransformer: {
      schema.treks.name: schema.treks.name,
    }));
  },
);
```

## Caching Strategy

Three layers: in-memory (Riverpod state, instant) → Local DB (Drift/Isar, persists across restarts) → Remote (API/Firestore, authoritative)

```dart
@riverpod
class TrekListNotifier extends _$TrekListNotifier {
  @override
  Future<List<Trek>> build() async {
    final cached = await ref.read(trekDaoProvider).getAllTreks();
    if (cached.isNotEmpty) {
      _refreshInBackground(); // update in background, serve cache immediately
      return cached;
    }
    return _fetchFromNetwork();
  }

  Future<void> _refreshInBackground() async {
    try {
      final fresh = await _fetchFromNetwork();
      state = AsyncData(fresh);
    } catch (_) {} // silently fail — user already has cached data
  }

  Future<List<Trek>> _fetchFromNetwork() async {
    final dtos = await ref.read(trekRemoteSourceProvider).fetchTreks();
    final treks = dtos.map(Trek.fromDto).toList();
    await ref.read(trekDaoProvider).insertAll(treks.map((t) => t.toCompanion()).toList());
    return treks;
  }
}
```

## Quick Reference

| Task | Drift | Isar | Firestore |
|---|---|---|---|
| Watch stream | `.watch()` on select | `.watch(fireImmediately: true)` | `.snapshots()` |
| Upsert | `insertOnConflictUpdate` | `isar.writeTxn(() => box.put(obj))` | `set(..., SetOptions(merge: true))` |
| Transaction | `transaction(() async {...})` | `isar.writeTxn(() async {...})` | `runTransaction((tx) async {...})` |
| Batch write | `batch((b) => b.insertAll(...))` | `isar.writeTxn(() => box.putAll([...]))` | `WriteBatch` → `batch.commit()` |
| Filter | `.where((t) => t.name.equals('x'))` | `.filter().nameEqualTo('x')` | `.where('name', isEqualTo: 'x')` |
| Order | `..orderBy([...])` | `.sortByName()` | `.orderBy('name')` |

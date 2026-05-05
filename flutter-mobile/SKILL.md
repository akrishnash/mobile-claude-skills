---
name: flutter-mobile
description: Deep Flutter mobile skill covering platform channels (MethodChannel, EventChannel), native Android/iOS API integration, camera and image picking, location services, biometric auth, background processing, Dart isolates, app lifecycle management, deep links, local notifications, performance profiling with DevTools, memory optimization, and production debugging. Trigger this skill whenever the user needs native device features, platform-specific behavior, background tasks, Dart isolates for heavy computation, deep links, local notifications, performance profiling, memory leak investigation, or any integration that goes beyond Flutter's widget layer into the underlying Android/iOS platform.
---

# Flutter Mobile — Deep Reference

## Platform Channels

Platform channels are how Flutter talks to native Android (Kotlin/Java) and iOS (Swift/ObjC) code. Use them when a Dart package doesn't exist or doesn't meet your needs.

### MethodChannel — request/response calls

```dart
// Dart side
class NativeBridge {
  static const _channel = MethodChannel('com.yourapp/native');

  static Future<String> getDeviceModel() async {
    try {
      return await _channel.invokeMethod<String>('getDeviceModel') ?? 'Unknown';
    } on PlatformException catch (e) {
      throw Exception('Native call failed: ${e.message}');
    }
  }

  static Future<bool> requestBatteryOptimizationExemption() =>
      _channel.invokeMethod<bool>('requestBatteryExemption').then((r) => r ?? false);
}
```

```kotlin
// Android — MainActivity.kt
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.yourapp/native")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getDeviceModel" -> result.success(Build.MODEL)
                    "requestBatteryExemption" -> {
                        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        intent.data = Uri.parse("package:$packageName")
                        startActivity(intent)
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
```

```swift
// iOS — AppDelegate.swift
@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
    override func application(_ application: UIApplication, didFinishLaunchingWithOptions ...) -> Bool {
        let controller = window?.rootViewController as! FlutterViewController
        let channel = FlutterMethodChannel(name: "com.yourapp/native", binaryMessenger: controller.binaryMessenger)

        channel.setMethodCallHandler { call, result in
            switch call.method {
            case "getDeviceModel":
                result(UIDevice.current.model)
            default:
                result(FlutterMethodNotImplemented)
            }
        }
        return super.application(application, ...)
    }
}
```

### EventChannel — continuous data stream

```dart
// Dart — subscribe to native events
class BatteryLevelStream {
  static const _channel = EventChannel('com.yourapp/battery');

  static Stream<int> get batteryLevel =>
      _channel.receiveBroadcastStream().map((level) => level as int);
}

// Usage
StreamBuilder<int>(
  stream: BatteryLevelStream.batteryLevel,
  builder: (_, snapshot) => Text('Battery: ${snapshot.data ?? '--'}%'),
)
```

```kotlin
// Android — continuous battery updates
EventChannel(flutterEngine.dartExecutor.binaryMessenger, "com.yourapp/battery")
    .setStreamHandler(object : EventChannel.StreamHandler {
        private var receiver: BroadcastReceiver? = null

        override fun onListen(args: Any?, sink: EventChannel.EventSink) {
            receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context, intent: Intent) {
                    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                    sink.success(level)
                }
            }
            registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        }

        override fun onCancel(args: Any?) {
            unregisterReceiver(receiver)
            receiver = null
        }
    })
```

---

## Camera & Image Picking

```yaml
# pubspec.yaml
# image_picker: ^1.1.2       — gallery + camera (recommended, no platform channel needed)
# camera: ^0.10.5            — live camera preview, video, advanced controls
```

### image_picker — simplest approach

```dart
class ImagePickerService {
  final _picker = ImagePicker();

  Future<File?> pickFromGallery({int quality = 85, double? maxWidth}) async {
    final xFile = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: quality,
      maxWidth: maxWidth,
    );
    return xFile != null ? File(xFile.path) : null;
  }

  Future<File?> capturePhoto({int quality = 85}) async {
    final xFile = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: quality,
      preferFrontCamera: false,
    );
    return xFile != null ? File(xFile.path) : null;
  }

  Future<List<File>> pickMultiple({int limit = 10}) async {
    final xFiles = await _picker.pickMultiImage(imageQuality: 85, limit: limit);
    return xFiles.map((f) => File(f.path)).toList();
  }
}

// Required AndroidManifest.xml permissions:
// <uses-permission android:name="android.permission.CAMERA"/>
// <uses-feature android:name="android.hardware.camera" android:required="false"/>

// Required iOS Info.plist keys:
// NSCameraUsageDescription
// NSPhotoLibraryUsageDescription
```

### camera package — live preview

```dart
class CameraScreen extends StatefulWidget { ... }

class _CameraScreenState extends State<CameraScreen> with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
  }

  Future<void> _initCamera() async {
    _cameras = await availableCameras();
    _controller = CameraController(
      _cameras.first,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    await _controller!.initialize();
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      _controller!.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initCamera();
    }
  }

  Future<void> _takePhoto() async {
    if (!_controller!.value.isInitialized) return;
    final xFile = await _controller!.takePicture();
    // process xFile.path
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null || !_controller!.value.isInitialized) {
      return const Center(child: CircularProgressIndicator());
    }
    return Stack(children: [
      CameraPreview(_controller!),
      Positioned(bottom: 32, left: 0, right: 0,
        child: Center(child: FloatingActionButton(onPressed: _takePhoto, child: const Icon(Icons.camera_alt)))),
    ]);
  }
}
```

---

## Location Services

```yaml
# geolocator: ^12.0.0
# geocoding: ^3.0.0
```

```dart
class LocationService {
  Future<bool> get hasPermission async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<Position?> getCurrentLocation() async {
    if (!await hasPermission) return null;
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
  }

  Stream<Position> trackLocation() => Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10, // only emit if moved 10+ meters
    ),
  );

  Future<double> distanceBetween(Position a, Position b) async =>
      Geolocator.distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude);
}

// AndroidManifest.xml:
// <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
// <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>

// iOS Info.plist:
// NSLocationWhenInUseUsageDescription
// NSLocationAlwaysAndWhenInUseUsageDescription
```

---

## Dart Isolates — Heavy Computation Off the Main Thread

### compute() — simple one-shot

```dart
// Heavy image processing, JSON parsing, encryption — anything that takes > 16ms
Future<List<Trek>> parseJsonInBackground(String jsonString) =>
    compute(_parseJson, jsonString);

// Must be a top-level or static function (not a closure)
List<Trek> _parseJson(String json) {
  final list = jsonDecode(json) as List;
  return list.map((e) => Trek.fromJson(e as Map<String, dynamic>)).toList();
}
```

### Isolate.spawn — long-running background isolates

```dart
// For tasks that need to send multiple results back (e.g., GPS track processing)
Future<void> processGpsTrack(List<LatLng> points) async {
  final receivePort = ReceivePort();
  await Isolate.spawn(_processTrack, (receivePort.sendPort, points));

  await for (final message in receivePort) {
    if (message is ProcessingProgress) {
      ref.read(progressProvider.notifier).state = message.percentage;
    } else if (message is ProcessingComplete) {
      receivePort.close();
      // handle result
    }
  }
}

void _processTrack((SendPort, List<LatLng>) args) {
  final (sendPort, points) = args;
  // Heavy computation
  for (var i = 0; i < points.length; i++) {
    // process each point
    sendPort.send(ProcessingProgress(i / points.length));
  }
  sendPort.send(ProcessingComplete(result: /* ... */));
}
```

---

## Background Processing

```yaml
# workmanager: ^0.5.2      — scheduled background tasks (Android WorkManager / iOS BGTaskScheduler)
# background_fetch: ^1.2.0 — periodic fetch (iOS-friendly)
```

```dart
// lib/core/background/background_tasks.dart
const _syncTaskKey = 'com.yourapp.sync';

Future<void> registerBackgroundSync() async {
  await Workmanager().initialize(_callbackDispatcher, isInDebugMode: false);
  await Workmanager().registerPeriodicTask(
    _syncTaskKey,
    _syncTaskKey,
    frequency: const Duration(hours: 1),
    constraints: Constraints(
      networkType: NetworkType.connected,
      requiresBatteryNotLow: true,
    ),
    existingWorkPolicy: ExistingWorkPolicy.keep,
  );
}

// Top-level function — runs in a separate isolate, no Flutter context
@pragma('vm:entry-point')
void _callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    switch (taskName) {
      case _syncTaskKey:
        // Reinitialize dependencies (new isolate has no state)
        await Firebase.initializeApp();
        await SyncService().sync();
        return Future.value(true);
    }
    return Future.value(false);
  });
}
```

---

## Local Notifications

```yaml
# flutter_local_notifications: ^17.2.4
```

```dart
class LocalNotificationService {
  static final _plugin = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(requestAlertPermission: true),
      ),
      onDidReceiveNotificationResponse: _onTap,
    );
    await _createChannels();
  }

  static Future<void> _createChannels() async {
    await _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(const AndroidNotificationChannel(
          'sync', 'Sync Notifications',
          importance: Importance.low,
        ));
  }

  static Future<void> showProgress({required String title, required int progress}) =>
      _plugin.show(
        0, title, '$progress% complete',
        NotificationDetails(android: AndroidNotificationDetails(
          'sync', 'Sync Notifications',
          showProgress: true,
          maxProgress: 100,
          progress: progress,
          ongoing: progress < 100,
          onlyAlertOnce: true,
        )),
      );

  static Future<void> schedule({
    required String title,
    required String body,
    required DateTime scheduledAt,
  }) => _plugin.zonedSchedule(
    scheduledAt.millisecondsSinceEpoch.hashCode,
    title, body,
    tz.TZDateTime.from(scheduledAt, tz.local),
    const NotificationDetails(
      android: AndroidNotificationDetails('reminders', 'Reminders', importance: Importance.high),
      iOS: DarwinNotificationDetails(),
    ),
    androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
  );

  static void _onTap(NotificationResponse response) {
    if (response.payload != null) {
      AppRouter.router.push('/treks/${response.payload}');
    }
  }
}
```

---

## Deep Links

```yaml
# app_links: ^6.1.4  — handles both Universal Links (iOS) and App Links (Android)
```

```dart
// lib/core/router/deep_link_handler.dart
class DeepLinkHandler {
  static StreamSubscription? _sub;

  static Future<void> initialize(GoRouter router) async {
    final appLinks = AppLinks();

    // Handle cold start deep link
    final initial = await appLinks.getInitialLink();
    if (initial != null) _handleLink(router, initial);

    // Handle deep links while app is running
    _sub = appLinks.uriLinkStream.listen((uri) => _handleLink(router, uri));
  }

  static void _handleLink(GoRouter router, Uri uri) {
    // trek-diary://treks/abc123 or https://trekdiary.com/treks/abc123
    if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 'treks') {
      router.push('/treks/${uri.pathSegments[1]}');
    }
  }

  static void dispose() => _sub?.cancel();
}

// android/app/src/main/AndroidManifest.xml — inside <activity>:
// <intent-filter android:autoVerify="true">
//   <action android:name="android.intent.action.VIEW"/>
//   <category android:name="android.intent.category.DEFAULT"/>
//   <category android:name="android.intent.category.BROWSABLE"/>
//   <data android:scheme="https" android:host="trekdiary.com"/>
//   <data android:scheme="trek-diary"/>
// </intent-filter>
```

---

## App Lifecycle

```dart
// lib/core/app_lifecycle_observer.dart
class AppLifecycleObserver extends WidgetsBindingObserver {
  AppLifecycleObserver(this.ref);
  final WidgetRef ref;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        // App came to foreground — sync, refresh auth token
        ref.read(syncManagerProvider.notifier).sync();
        ref.invalidate(authStateProvider);
      case AppLifecycleState.paused:
        // App going to background — save any pending state
        ref.read(draftEntryProvider.notifier).saveDraft();
      case AppLifecycleState.detached:
        // App being terminated — close DB, cancel timers
        ref.read(appDatabaseProvider).close();
      case AppLifecycleState.inactive:
        break; // transitioning, usually brief
      case AppLifecycleState.hidden:
        break; // iOS only — app hidden but not yet paused
    }
  }
}

// Register in main widget:
class App extends ConsumerStatefulWidget {
  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> {
  late final _observer = AppLifecycleObserver(ref);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(_observer);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(_observer);
    super.dispose();
  }
}
```

---

## Performance Profiling

### DevTools checklist

```bash
# Launch with profiling enabled
flutter run --profile

# Open DevTools
flutter pub global activate devtools
flutter pub global run devtools
```

### What to look for in DevTools

| Tab | What to check |
|---|---|
| **Performance** | Frame times — should be < 16ms (60fps) or < 8ms (120fps). Look for "jank" (red frames) |
| **CPU Profiler** | Which functions are taking time during slow frames |
| **Memory** | Growing heap = leak. Look for objects that don't get collected |
| **Widget Rebuilds** | "Rebuild" count in Flutter Inspector — excessive rebuilds in lists |
| **Network** | Timeline of HTTP requests — slow endpoints |

### Common performance fixes

```dart
// Problem: List items rebuild on every parent state change
// Fix: extract items to ConsumerWidget with .select() 
class TrekListItem extends ConsumerWidget {
  const TrekListItem({super.key, required this.trekId});
  final String trekId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Only rebuilds when this specific trek changes
    final trek = ref.watch(trekDetailProvider(trekId));
    return TrekCard(trek: trek);
  }
}

// Problem: expensive computation in build()
// Fix: move to provider or cache with useMemoized/remember
@riverpod
List<Trek> sortedTreks(SortedTreksRef ref) {
  final treks = ref.watch(trekListProvider).valueOrNull ?? [];
  return [...treks]..sort((a, b) => a.name.compareTo(b.name)); // computed once, cached
}

// Problem: image loading causes frame drops
// Fix: precache images before navigating
Future<void> _navigateToDetail(BuildContext context, Trek trek) async {
  await precacheImage(NetworkImage(trek.imageUrl), context);
  if (context.mounted) context.push('/treks/${trek.id}');
}

// Problem: slow startup — loading too much synchronously
// Fix: lazy initialization, splash screen while async setup runs
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Only do the minimum synchronous work here
  final prefs = SharedPreferences.getInstance(); // start async, don't await yet
  runApp(ProviderScope(
    overrides: [sharedPreferencesProvider.overrideWith((_) => prefs)],
    child: const App(),
  ));
}
```

### Memory leak patterns to avoid

```dart
// LEAK: StreamSubscription not cancelled
class _MyState extends State<MyWidget> {
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = someStream.listen((_) {});
  }

  @override
  void dispose() {
    _sub?.cancel(); // REQUIRED
    super.dispose();
  }
}

// LEAK: Timer not cancelled
Timer? _timer;
// In dispose: _timer?.cancel();

// LEAK: AnimationController not disposed
// In dispose: _controller.dispose();

// LEAK: Large images held in memory
// Fix: use memCacheWidth/memCacheHeight in CachedNetworkImage
// Fix: call imageCache.clear() when navigating away from image-heavy screens
```

---

## Runtime Permissions

```yaml
# permission_handler: ^11.3.1
```

```dart
class PermissionService {
  static Future<bool> request(Permission permission) async {
    final status = await permission.status;
    if (status.isGranted) return true;
    if (status.isPermanentlyDenied) {
      await openAppSettings(); // send user to app settings
      return false;
    }
    return (await permission.request()).isGranted;
  }

  static Future<bool> requestCamera() => request(Permission.camera);
  static Future<bool> requestLocation() => request(Permission.locationWhenInUse);
  static Future<bool> requestNotifications() => request(Permission.notification);
  static Future<bool> requestPhotos() => request(Permission.photos); // iOS
  static Future<bool> requestStorage() => request(Permission.storage); // Android < 13
  static Future<bool> requestMediaLibrary() => request(Permission.mediaLibrary);
}

// Pattern: check before using, explain before asking
Future<void> _openCamera() async {
  final hasPermission = await PermissionService.requestCamera();
  if (!hasPermission) {
    if (mounted) _showPermissionDeniedDialog('Camera');
    return;
  }
  // proceed with camera
}
```

---

## Android-Specific

### Adaptive icons (Android 8+)

```xml
<!-- android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

### Splash screen (Flutter 3.7+)

```xml
<!-- android/app/src/main/res/values/styles.xml -->
<style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">
    <item name="android:windowBackground">@drawable/launch_background</item>
</style>
```

```dart
// lib/main.dart — remove splash after init
FlutterNativeSplash.preserve(widgetsBinding: WidgetsFlutterBinding.ensureInitialized());
// ... init code ...
FlutterNativeSplash.remove();
```

---

## iOS-Specific

### Info.plist — common keys

```xml
<!-- Always include usage descriptions for any permission you request -->
<key>NSCameraUsageDescription</key>
<string>Used to photograph trek stops and moments.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to track your position on the trail.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to attach photos to your trek diary.</string>
<key>NSFaceIDUsageDescription</key>
<string>Used to securely unlock your diary.</string>
```

### Background modes (Xcode Signing & Capabilities)

- **Background fetch** — periodic content refresh
- **Location updates** — continuous GPS tracking
- **Remote notifications** — FCM background delivery
- **Background processing** — long-running background tasks

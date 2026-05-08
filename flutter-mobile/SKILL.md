---
name: flutter-mobile
description: Deep Flutter mobile skill covering platform channels (MethodChannel, EventChannel), native Android/iOS API integration, camera and image picking, location services, biometric auth, background processing, Dart isolates, app lifecycle management, deep links, local notifications, performance profiling with DevTools, memory optimization, and production debugging. Trigger this skill whenever the user needs native device features, platform-specific behavior, background tasks, Dart isolates for heavy computation, deep links, local notifications, performance profiling, memory leak investigation, or any integration that goes beyond Flutter's widget layer into the underlying Android/iOS platform.
---

# Flutter Mobile — Deep Reference

## Platform Channels

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
class BatteryLevelStream {
  static const _channel = EventChannel('com.yourapp/battery');

  static Stream<int> get batteryLevel =>
      _channel.receiveBroadcastStream().map((level) => level as int);
}

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
                    sink.success(intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1))
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

## Camera & Image Picking

// image_picker: ^1.1.2 — gallery + camera (recommended)
// camera: ^0.10.5 — live preview, video, advanced controls

### image_picker — simplest approach

```dart
class ImagePickerService {
  final _picker = ImagePicker();

  Future<File?> pickFromGallery({int quality = 85, double? maxWidth}) async {
    final xFile = await _picker.pickImage(source: ImageSource.gallery, imageQuality: quality, maxWidth: maxWidth);
    return xFile != null ? File(xFile.path) : null;
  }

  Future<File?> capturePhoto({int quality = 85}) async {
    final xFile = await _picker.pickImage(source: ImageSource.camera, imageQuality: quality, preferFrontCamera: false);
    return xFile != null ? File(xFile.path) : null;
  }

  Future<List<File>> pickMultiple({int limit = 10}) async {
    final xFiles = await _picker.pickMultiImage(imageQuality: 85, limit: limit);
    return xFiles.map((f) => File(f.path)).toList();
  }
}
// AndroidManifest.xml: CAMERA permission + hardware.camera feature (required="false")
// iOS Info.plist: NSCameraUsageDescription, NSPhotoLibraryUsageDescription
```

### camera package — live preview (key methods + lifecycle)

```dart
// Lifecycle: WidgetsBindingObserver handles pause/resume
class _CameraScreenState extends State<CameraScreen> with WidgetsBindingObserver {
  CameraController? _controller;

  Future<void> _initCamera() async {
    final cameras = await availableCameras();
    _controller = CameraController(cameras.first, ResolutionPreset.high,
        enableAudio: false, imageFormatGroup: ImageFormatGroup.jpeg);
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
}
```

## Location Services

// geolocator: ^12.0.0, geocoding: ^3.0.0

```dart
class LocationService {
  Future<bool> get hasPermission async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  Future<Position?> getCurrentLocation() async {
    if (!await hasPermission || !await Geolocator.isLocationServiceEnabled()) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
    );
  }

  Stream<Position> trackLocation() => Geolocator.getPositionStream(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
  );

  Future<double> distanceBetween(Position a, Position b) async =>
      Geolocator.distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude);
}
// AndroidManifest.xml: ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION
// iOS Info.plist: NSLocationWhenInUseUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription
```

## Dart Isolates — Heavy Computation Off the Main Thread

```dart
// compute() — simple one-shot (must be top-level or static function)
Future<List<Trek>> parseJsonInBackground(String jsonString) =>
    compute(_parseJson, jsonString);

List<Trek> _parseJson(String json) {
  final list = jsonDecode(json) as List;
  return list.map((e) => Trek.fromJson(e as Map<String, dynamic>)).toList();
}
```

```dart
// Isolate.spawn — long-running, sends multiple results back
Future<void> processGpsTrack(List<LatLng> points) async {
  final receivePort = ReceivePort();
  await Isolate.spawn(_processTrack, (receivePort.sendPort, points));

  await for (final message in receivePort) {
    if (message is ProcessingProgress) {
      ref.read(progressProvider.notifier).state = message.percentage;
    } else if (message is ProcessingComplete) {
      receivePort.close();
    }
  }
}

void _processTrack((SendPort, List<LatLng>) args) {
  final (sendPort, points) = args;
  for (var i = 0; i < points.length; i++) {
    sendPort.send(ProcessingProgress(i / points.length));
  }
  sendPort.send(ProcessingComplete(result: /* ... */));
}
```

## Background Processing

// workmanager: ^0.5.2 — Android WorkManager / iOS BGTaskScheduler

```dart
const _syncTaskKey = 'com.yourapp.sync';

Future<void> registerBackgroundSync() async {
  await Workmanager().initialize(_callbackDispatcher, isInDebugMode: false);
  await Workmanager().registerPeriodicTask(
    _syncTaskKey, _syncTaskKey,
    frequency: const Duration(hours: 1),
    constraints: Constraints(networkType: NetworkType.connected, requiresBatteryNotLow: true),
    existingWorkPolicy: ExistingWorkPolicy.keep,
  );
}

@pragma('vm:entry-point')
void _callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    switch (taskName) {
      case _syncTaskKey:
        await Firebase.initializeApp(); // reinitialize — new isolate has no state
        await SyncService().sync();
        return Future.value(true);
    }
    return Future.value(false);
  });
}
```

## Local Notifications

// flutter_local_notifications: ^17.2.4

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
    await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(const AndroidNotificationChannel('sync', 'Sync Notifications', importance: Importance.low));
  }

  static Future<void> showProgress({required String title, required int progress}) =>
      _plugin.show(0, title, '$progress% complete',
        NotificationDetails(android: AndroidNotificationDetails('sync', 'Sync Notifications',
          showProgress: true, maxProgress: 100, progress: progress,
          ongoing: progress < 100, onlyAlertOnce: true)));

  static Future<void> schedule({required String title, required String body, required DateTime scheduledAt}) =>
      _plugin.zonedSchedule(
        scheduledAt.millisecondsSinceEpoch.hashCode, title, body,
        tz.TZDateTime.from(scheduledAt, tz.local),
        const NotificationDetails(
          android: AndroidNotificationDetails('reminders', 'Reminders', importance: Importance.high),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      );

  static void _onTap(NotificationResponse response) {
    if (response.payload != null) AppRouter.router.push('/treks/${response.payload}');
  }
}
```

## Deep Links

// app_links: ^6.1.4 — Universal Links (iOS) and App Links (Android)

```dart
class DeepLinkHandler {
  static StreamSubscription? _sub;

  static Future<void> initialize(GoRouter router) async {
    final appLinks = AppLinks();
    final initial = await appLinks.getInitialLink();
    if (initial != null) _handleLink(router, initial);
    _sub = appLinks.uriLinkStream.listen((uri) => _handleLink(router, uri));
  }

  static void _handleLink(GoRouter router, Uri uri) {
    if (uri.pathSegments.length >= 2 && uri.pathSegments[0] == 'treks') {
      router.push('/treks/${uri.pathSegments[1]}');
    }
  }

  static void dispose() => _sub?.cancel();
}

// AndroidManifest.xml inside <activity>:
// <intent-filter android:autoVerify="true">
//   <action android:name="android.intent.action.VIEW"/>
//   <category android:name="android.intent.category.DEFAULT"/>
//   <category android:name="android.intent.category.BROWSABLE"/>
//   <data android:scheme="https" android:host="trekdiary.com"/>
//   <data android:scheme="trek-diary"/>
// </intent-filter>
```

## App Lifecycle

```dart
class AppLifecycleObserver extends WidgetsBindingObserver {
  AppLifecycleObserver(this.ref);
  final WidgetRef ref;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        ref.read(syncManagerProvider.notifier).sync();
        ref.invalidate(authStateProvider);
      case AppLifecycleState.paused:
        ref.read(draftEntryProvider.notifier).saveDraft();
      case AppLifecycleState.detached:
        ref.read(appDatabaseProvider).close();
      case AppLifecycleState.inactive:
        break;
      case AppLifecycleState.hidden:
        break; // iOS only
    }
  }
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

## Performance Profiling

```bash
flutter run --profile  # launch with profiling enabled
```

### DevTools — what to check

| Tab | What to check |
|---|---|
| **Performance** | Frame times < 16ms (60fps) / < 8ms (120fps). Red frames = jank |
| **CPU Profiler** | Which functions take time during slow frames |
| **Memory** | Growing heap = leak. Objects not getting collected |
| **Widget Rebuilds** | Excessive rebuild count in lists (Flutter Inspector) |
| **Network** | Timeline of HTTP requests — slow endpoints |

### Common performance fixes

```dart
// Problem: list items rebuild on every parent state change
// Fix: extract to ConsumerWidget with .select()
class TrekListItem extends ConsumerWidget {
  const TrekListItem({super.key, required this.trekId});
  final String trekId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trek = ref.watch(trekDetailProvider(trekId)); // only rebuilds when this trek changes
    return TrekCard(trek: trek);
  }
}

// Problem: expensive computation in build()
@riverpod
List<Trek> sortedTreks(SortedTreksRef ref) {
  final treks = ref.watch(trekListProvider).valueOrNull ?? [];
  return [...treks]..sort((a, b) => a.name.compareTo(b.name)); // computed once, cached
}

// Problem: image loading causes frame drops
Future<void> _navigateToDetail(BuildContext context, Trek trek) async {
  await precacheImage(NetworkImage(trek.imageUrl), context);
  if (context.mounted) context.push('/treks/${trek.id}');
}

// Problem: slow startup
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
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

// Also in dispose(): _timer?.cancel(), _controller.dispose()
// CachedNetworkImage: use memCacheWidth/memCacheHeight to limit memory
// Call imageCache.clear() when navigating away from image-heavy screens
```

## Runtime Permissions

// permission_handler: ^11.3.1

```dart
class PermissionService {
  static Future<bool> request(Permission permission) async {
    final status = await permission.status;
    if (status.isGranted) return true;
    if (status.isPermanentlyDenied) {
      await openAppSettings();
      return false;
    }
    return (await permission.request()).isGranted;
  }

  static Future<bool> requestCamera() => request(Permission.camera);
  static Future<bool> requestLocation() => request(Permission.locationWhenInUse);
  static Future<bool> requestNotifications() => request(Permission.notification);
  static Future<bool> requestPhotos() => request(Permission.photos);          // iOS
  static Future<bool> requestStorage() => request(Permission.storage);        // Android < 13
  static Future<bool> requestMediaLibrary() => request(Permission.mediaLibrary);
}

Future<void> _openCamera() async {
  final hasPermission = await PermissionService.requestCamera();
  if (!hasPermission) {
    if (mounted) _showPermissionDeniedDialog('Camera');
    return;
  }
  // proceed with camera
}
```

## Android-Specific

### Background modes (Xcode Signing & Capabilities)
- **Background fetch** — periodic content refresh
- **Location updates** — continuous GPS tracking
- **Remote notifications** — FCM background delivery
- **Background processing** — long-running background tasks

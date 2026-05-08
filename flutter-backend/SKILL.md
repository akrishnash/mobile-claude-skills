---
name: flutter-backend
description: Deep Flutter backend integration skill covering REST/GraphQL APIs with Dio, repository pattern, error handling, background sync, FCM push notifications, WebSockets, refresh token flows, SSL pinning, and offline queuing. Trigger this skill whenever the user is integrating an API, setting up HTTP clients, handling network errors, implementing authentication token refresh, configuring interceptors, dealing with background data sync, push notifications, or any server-side data flow in a Flutter app.
---

# Flutter Backend Integration — Deep Reference

## Dio Setup — Production-Ready HTTP Client

```dart
// lib/core/network/dio_client.dart
Dio createDio({required String baseUrl, required TokenStorage tokenStorage}) {
  final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
    headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
  ));

  dio.interceptors.addAll([
    AuthInterceptor(dio: dio, tokenStorage: tokenStorage),
    LoggingInterceptor(),
    RetryInterceptor(dio: dio),
    ErrorInterceptor(),
  ]);

  return dio;
}
```

### Auth interceptor with token refresh

```dart
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this.dio, required this.tokenStorage});
  final Dio dio;
  final TokenStorage tokenStorage;
  bool _isRefreshing = false;
  final _pendingRequests = <({RequestOptions opts, ErrorInterceptorHandler handler})>[];

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await tokenStorage.getAccessToken();
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) return handler.next(err);

    if (_isRefreshing) {
      _pendingRequests.add((opts: err.requestOptions, handler: handler));
      return;
    }

    _isRefreshing = true;
    try {
      final refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken == null) throw Exception('No refresh token');

      final response = await dio.post('/auth/refresh', data: {'refresh_token': refreshToken});
      final newToken = response.data['access_token'] as String;
      await tokenStorage.saveAccessToken(newToken);

      handler.resolve(await _retry(err.requestOptions, newToken));
      for (final req in _pendingRequests) {
        req.handler.resolve(await _retry(req.opts, newToken));
      }
    } catch (_) {
      await tokenStorage.clearAll();
      handler.next(err);
    } finally {
      _isRefreshing = false;
      _pendingRequests.clear();
    }
  }

  Future<Response> _retry(RequestOptions opts, String token) => dio.request(
    opts.path,
    data: opts.data,
    queryParameters: opts.queryParameters,
    options: Options(method: opts.method, headers: {...opts.headers, 'Authorization': 'Bearer $token'}),
  );
}
```

### Retry interceptor (idempotent requests only)

```dart
class RetryInterceptor extends Interceptor {
  RetryInterceptor({required this.dio});
  final Dio dio;
  static const _maxRetries = 3;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final retryCount = err.requestOptions.extra['retryCount'] as int? ?? 0;
    final isRetryable = err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.response?.statusCode == 503;
    final isIdempotent = ['GET', 'HEAD', 'PUT', 'DELETE'].contains(err.requestOptions.method);

    if (isRetryable && isIdempotent && retryCount < _maxRetries) {
      err.requestOptions.extra['retryCount'] = retryCount + 1;
      await Future.delayed(Duration(seconds: math.pow(2, retryCount).toInt())); // exponential backoff
      try {
        handler.resolve(await dio.fetch(err.requestOptions));
      } catch (e) {
        handler.next(err);
      }
    } else {
      handler.next(err);
    }
  }
}
```

## Repository Pattern

Data layer: API/Remote Source → Data Source (raw HTTP) → Repository (domain models) → Use Case/Provider → UI

### Data source — raw API calls only

```dart
// lib/data/sources/trek_remote_source.dart
abstract class TrekRemoteSource {
  Future<List<TrekDto>> fetchTreks({int page = 1, int limit = 20});
  Future<TrekDto> fetchTrek(String id);
  Future<TrekDto> createTrek(CreateTrekRequest req);
  Future<void> deleteTrek(String id);
}

class TrekRemoteSourceImpl implements TrekRemoteSource {
  TrekRemoteSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<TrekDto>> fetchTreks({int page = 1, int limit = 20}) async {
    final res = await _dio.get('/treks', queryParameters: {'page': page, 'limit': limit});
    return (res.data['data'] as List).map(TrekDto.fromJson).toList();
  }

  @override
  Future<TrekDto> fetchTrek(String id) async {
    final res = await _dio.get('/treks/$id');
    return TrekDto.fromJson(res.data);
  }

  @override
  Future<TrekDto> createTrek(CreateTrekRequest req) async {
    final res = await _dio.post('/treks', data: req.toJson());
    return TrekDto.fromJson(res.data);
  }

  @override
  Future<void> deleteTrek(String id) => _dio.delete('/treks/$id');
}
```

### Repository — maps DTOs to domain models, handles errors

```dart
class TrekRepositoryImpl implements TrekRepository {
  TrekRepositoryImpl({required this.remoteSource, required this.localSource, required this.networkInfo});
  final TrekRemoteSource remoteSource;
  final TrekLocalSource localSource;
  final NetworkInfo networkInfo;

  @override
  Future<Either<AppError, List<Trek>>> getTreks({int page = 1}) async {
    if (!await networkInfo.isConnected) {
      final cached = await localSource.getCachedTreks();
      return cached.isNotEmpty ? Right(cached) : Left(AppError.noNetwork());
    }
    try {
      final dtos = await remoteSource.fetchTreks(page: page);
      final treks = dtos.map((d) => Trek.fromDto(d)).toList();
      if (page == 1) await localSource.cacheTreks(treks);
      return Right(treks);
    } on DioException catch (e) {
      return Left(AppError.fromDio(e));
    }
  }
}
```

## Error Handling

### Unified error model

```dart
@freezed
class AppError with _$AppError {
  const factory AppError.network({required String message, int? statusCode}) = NetworkError;
  const factory AppError.unauthorized() = UnauthorizedError;
  const factory AppError.notFound(String resource) = NotFoundError;
  const factory AppError.validation(Map<String, List<String>> errors) = ValidationError;
  const factory AppError.server({required String message}) = ServerError;
  const factory AppError.unknown(Object error) = UnknownError;
  const factory AppError.noNetwork() = NoNetworkError;

  factory AppError.fromDio(DioException e) {
    return switch (e.response?.statusCode) {
      401 => const AppError.unauthorized(),
      404 => AppError.notFound(e.requestOptions.path),
      422 => AppError.validation(_parseValidationErrors(e.response?.data)),
      500 => AppError.server(message: 'Server error. Please try again.'),
      null when e.type == DioExceptionType.connectionTimeout => const AppError.noNetwork(),
      _ => AppError.network(message: e.message ?? 'Unknown error', statusCode: e.response?.statusCode),
    };
  }
}

Map<String, List<String>> _parseValidationErrors(dynamic data) {
  if (data is! Map) return {};
  final errors = data['errors'] as Map<String, dynamic>? ?? {};
  return errors.map((k, v) => MapEntry(k, List<String>.from(v as List)));
}
```

### Displaying errors in UI

```dart
state.whenOrNull(
  error: (err, _) => err is AppError
      ? err.when(
          network: (msg, code) => ErrorBanner(message: msg),
          unauthorized: () => const LoginPrompt(),
          noNetwork: () => const OfflineBanner(),
          validation: (errors) => ValidationErrorList(errors: errors),
          notFound: (r) => EmptyState(message: '$r not found'),
          server: (msg) => ErrorBanner(message: msg),
          unknown: (e) => ErrorBanner(message: 'Something went wrong'),
        )
      : ErrorBanner(message: 'Unexpected error'),
);
```

## Multipart File Upload

```dart
Future<String> uploadImage(File file) async {
  final fileName = path.basename(file.path);
  final formData = FormData.fromMap({
    'image': await MultipartFile.fromFile(
      file.path,
      filename: fileName,
      contentType: MediaType('image', fileName.split('.').last),
    ),
    'type': 'trek_photo',
  });

  final response = await _dio.post(
    '/upload',
    data: formData,
    onSendProgress: (sent, total) {
      ref.read(uploadProgressProvider.notifier).state = sent / total;
    },
  );
  return response.data['url'] as String;
}
```

## Firebase Cloud Messaging (Push Notifications)

// firebase_messaging: ^14.0.0, flutter_local_notifications: ^16.0.0

```dart
class NotificationService {
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    await _setupLocalNotifications();
    await _setupFCM();
  }

  static Future<void> _setupLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(requestAlertPermission: true, requestBadgePermission: true, requestSoundPermission: true);
    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
  }

  static Future<void> _setupFCM() async {
    await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
    FirebaseMessaging.onMessage.listen(_showLocalNotification);        // foreground
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap); // background tap
    final initial = await FirebaseMessaging.instance.getInitialMessage(); // terminated tap
    if (initial != null) _handleNotificationTap(initial);
    FirebaseMessaging.instance.onTokenRefresh.listen(_sendTokenToServer);
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) await _sendTokenToServer(token);
  }

  static void _showLocalNotification(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;
    _localNotifications.show(
      notification.hashCode,
      notification.title,
      notification.body,
      NotificationDetails(
        android: AndroidNotificationDetails('default_channel', 'Default',
          importance: Importance.high, priority: Priority.high, icon: '@mipmap/ic_launcher'),
        iOS: const DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  static void _handleNotificationTap(RemoteMessage message) {
    final type = message.data['type'] as String?;
    if (type == 'trek_update') AppRouter.router.push('/treks/${message.data['trek_id']}');
  }

  static Future<void> _sendTokenToServer(String token) =>
      GetIt.I<UserRepository>().updatePushToken(token);
}
```

## WebSockets (Real-time)

// web_socket_channel: ^2.4.0

```dart
class WebSocketService {
  WebSocketChannel? _channel;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  Timer? _pingTimer;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  Future<void> connect(String url, String token) async {
    _channel = WebSocketChannel.connect(Uri.parse('$url?token=$token'));
    _channel!.stream.listen(
      (data) => _messageController.add(jsonDecode(data as String)),
      onError: (e) => _reconnect(url, token),
      onDone: () => _reconnect(url, token),
    );
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) => send({'type': 'ping'}));
  }

  void send(Map<String, dynamic> data) => _channel?.sink.add(jsonEncode(data));

  Future<void> _reconnect(String url, String token) async {
    _pingTimer?.cancel();
    await Future.delayed(const Duration(seconds: 3));
    await connect(url, token);
  }

  void disconnect() {
    _pingTimer?.cancel();
    _channel?.sink.close();
    _messageController.close();
  }
}
```

## Offline Request Queue

```dart
// lib/core/network/offline_queue.dart
@riverpod
class OfflineQueue extends _$OfflineQueue {
  static const _key = 'offline_queue';

  @override
  List<QueuedRequest> build() => _loadFromStorage();

  Future<void> enqueue(QueuedRequest request) async {
    state = [...state, request];
    await _persist();
  }

  Future<void> processAll(Dio dio) async {
    if (state.isEmpty) return;
    for (final req in List<QueuedRequest>.from(state)) {
      try {
        await dio.request(req.path, data: req.body, options: Options(method: req.method));
        state = state.where((r) => r.id != req.id).toList();
        await _persist();
      } catch (_) {
        break; // stop on first failure, preserve order
      }
    }
  }

  Future<void> _persist() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(state.map((r) => r.toJson()).toList()));
  }
}

// Process queue when connectivity returns
ref.listen(connectivityProvider, (_, next) {
  if (next == ConnectivityResult.wifi || next == ConnectivityResult.mobile) {
    ref.read(offlineQueueProvider.notifier).processAll(ref.read(dioProvider));
  }
});
```

## Connectivity Detection

// connectivity_plus: ^5.0.2

```dart
@riverpod
Stream<ConnectivityResult> connectivity(ConnectivityRef ref) =>
    Connectivity().onConnectivityChanged;

@riverpod
bool isOnline(IsOnlineRef ref) {
  final result = ref.watch(connectivityProvider).valueOrNull;
  return result != null && result != ConnectivityResult.none;
}

Consumer(builder: (_, ref, __) {
  final isOnline = ref.watch(isOnlineProvider);
  return AnimatedContainer(
    duration: const Duration(milliseconds: 300),
    height: isOnline ? 0 : 32,
    color: Colors.red,
    child: isOnline ? null : const Center(child: Text('No internet connection', style: TextStyle(color: Colors.white))),
  );
})
```

## Dio Providers (Riverpod)

```dart
@riverpod
Dio dio(DioRef ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return createDio(baseUrl: AppConfig.apiBaseUrl, tokenStorage: tokenStorage);
}

@riverpod
TrekRemoteSource trekRemoteSource(TrekRemoteSourceRef ref) =>
    TrekRemoteSourceImpl(ref.watch(dioProvider));

@riverpod
TrekRepository trekRepository(TrekRepositoryRef ref) => TrekRepositoryImpl(
  remoteSource: ref.watch(trekRemoteSourceProvider),
  localSource: ref.watch(trekLocalSourceProvider),
  networkInfo: ref.watch(networkInfoProvider),
);
```

---
name: flutter-auth-deploy
description: Deep Flutter auth and deployment skill covering Firebase Auth (email/password, Google Sign-In, Apple Sign-In), biometric authentication, secure token storage, role-based access, Google Play Console release tracks, Android app signing, keystore management, Fastlane automation, GitHub Actions CI/CD, ProGuard/R8 rules, app versioning, app bundle generation, and production release checklists. Trigger this skill whenever the user is implementing login/logout flows, auth state management, setting up Firebase Auth, configuring Google Sign-In, dealing with keystore or signing, publishing to Play Store, setting up CI/CD pipelines, managing release tracks (internal/alpha/beta/production), configuring build flavors, or handling any deployment-related task.
---

# Flutter Auth & Deployment — Deep Reference

## Firebase Auth Setup

// firebase_auth: ^4.19.0, firebase_core: ^2.32.0, google_sign_in: ^6.2.1, sign_in_with_apple: ^6.1.0

```dart
// main.dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const ProviderScope(child: App()));
}
```

### Auth state as a Riverpod stream

```dart
@riverpod
Stream<User?> authState(AuthStateRef ref) => FirebaseAuth.instance.authStateChanges();

@riverpod
bool isAuthenticated(IsAuthenticatedRef ref) =>
    ref.watch(authStateProvider).valueOrNull != null;

@riverpod
User? currentUser(CurrentUserRef ref) =>
    ref.watch(authStateProvider).valueOrNull;
```

## Email / Password Auth

```dart
class AuthRepository {
  final _auth = FirebaseAuth.instance;

  Future<Either<AuthError, User>> signUpWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async {
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await credential.user!.updateDisplayName(displayName);
      await credential.user!.sendEmailVerification();
      return Right(credential.user!);
    } on FirebaseAuthException catch (e) {
      return Left(AuthError.fromCode(e.code));
    }
  }

  Future<Either<AuthError, User>> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      return Right(credential.user!);
    } on FirebaseAuthException catch (e) {
      return Left(AuthError.fromCode(e.code));
    }
  }

  Future<void> sendPasswordReset(String email) =>
      _auth.sendPasswordResetEmail(email: email.trim());

  Future<void> signOut() => _auth.signOut();
}

@freezed
class AuthError with _$AuthError {
  const factory AuthError.invalidEmail() = _InvalidEmail;
  const factory AuthError.weakPassword() = _WeakPassword;
  const factory AuthError.emailInUse() = _EmailInUse;
  const factory AuthError.userNotFound() = _UserNotFound;
  const factory AuthError.wrongPassword() = _WrongPassword;
  const factory AuthError.tooManyRequests() = _TooManyRequests;
  const factory AuthError.networkError() = _NetworkError;
  const factory AuthError.unknown(String code) = _Unknown;

  factory AuthError.fromCode(String code) => switch (code) {
    'invalid-email' => const AuthError.invalidEmail(),
    'weak-password' => const AuthError.weakPassword(),
    'email-already-in-use' => const AuthError.emailInUse(),
    'user-not-found' => const AuthError.userNotFound(),
    'wrong-password' => const AuthError.wrongPassword(),
    'too-many-requests' => const AuthError.tooManyRequests(),
    'network-request-failed' => const AuthError.networkError(),
    _ => AuthError.unknown(code),
  };

  String get message => when(
    invalidEmail: () => 'Please enter a valid email address.',
    weakPassword: () => 'Password must be at least 6 characters.',
    emailInUse: () => 'An account already exists with this email.',
    userNotFound: () => 'No account found for this email.',
    wrongPassword: () => 'Incorrect password. Please try again.',
    tooManyRequests: () => 'Too many attempts. Please try again later.',
    networkError: () => 'No internet connection.',
    unknown: (code) => 'Authentication failed ($code).',
  );
}
```

## Google Sign-In

```dart
class GoogleAuthService {
  final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);
  final _auth = FirebaseAuth.instance;

  Future<Either<AuthError, User>> signIn() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) return Left(const AuthError.unknown('cancelled'));

      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      final result = await _auth.signInWithCredential(credential);
      return Right(result.user!);
    } on FirebaseAuthException catch (e) {
      return Left(AuthError.fromCode(e.code));
    } catch (_) {
      return Left(const AuthError.unknown('google_sign_in_failed'));
    }
  }

  Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }
}
```

## Apple Sign-In (required for iOS App Store)

// sign_in_with_apple: ^6.1.0 — add entitlement: com.apple.developer.applesignin in Xcode

```dart
class AppleAuthService {
  final _auth = FirebaseAuth.instance;

  Future<Either<AuthError, User>> signIn() async {
    try {
      final nonce = _generateNonce();
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
        nonce: sha256ofString(nonce),
      );

      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleCredential.identityToken,
        rawNonce: nonce,
        accessToken: appleCredential.authorizationCode,
      );

      final result = await _auth.signInWithCredential(oauthCredential);

      // Apple only sends name on first sign-in — save it
      if (appleCredential.givenName != null) {
        await result.user!.updateDisplayName(
          '${appleCredential.givenName} ${appleCredential.familyName ?? ''}'.trim(),
        );
      }

      return Right(result.user!);
    } catch (e) {
      return Left(AuthError.unknown(e.toString()));
    }
  }

  String _generateNonce([int length = 32]) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
    final random = Random.secure();
    return List.generate(length, (_) => chars[random.nextInt(chars.length)]).join();
  }

  String sha256ofString(String input) {
    final bytes = utf8.encode(input);
    return sha256.convert(bytes).toString();
  }
}
```

## Biometric Authentication

// local_auth: ^2.2.0

```dart
class BiometricAuthService {
  final _localAuth = LocalAuthentication();

  Future<bool> get isAvailable async {
    final canCheck = await _localAuth.canCheckBiometrics;
    final isDeviceSupported = await _localAuth.isDeviceSupported();
    return canCheck && isDeviceSupported;
  }

  Future<List<BiometricType>> get availableBiometrics =>
      _localAuth.getAvailableBiometrics();

  Future<bool> authenticate({String reason = 'Confirm your identity'}) async {
    try {
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false, // allow PIN fallback
          stickyAuth: true,     // don't cancel if user switches apps
        ),
      );
    } on PlatformException {
      return false;
    }
  }
}
// AndroidManifest.xml: USE_BIOMETRIC + USE_FINGERPRINT permissions
```

## Secure Token Storage

// flutter_secure_storage: ^9.0.0 — Android Keystore / iOS Keychain, hardware-backed on modern devices

```dart
class TokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);
  Future<void> saveAccessToken(String token) => _storage.write(key: _accessTokenKey, value: token);
  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<void> saveRefreshToken(String token) => _storage.write(key: _refreshTokenKey, value: token);
  Future<void> clearAll() => _storage.deleteAll();
}
```

## GoRouter Auth Guard

```dart
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/';
      return null;
    },
    refreshListenable: GoRouterRefreshStream(FirebaseAuth.instance.authStateChanges()),
    routes: [
      GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/auth/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/auth/register', builder: (_, __) => const RegisterScreen()),
    ],
  );
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _sub = stream.listen((_) => notifyListeners());
  }
  late final StreamSubscription _sub;

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
```

## Android Signing & Keystore

```bash
keytool -genkey -v \
  -keystore ~/keystores/trek-diary.jks \
  -alias trek-diary \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

```properties
# android/key.properties — NEVER commit this file
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=trek-diary
storeFile=/Users/you/keystores/trek-diary.jks
```

```groovy
// android/app/build.gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Build Flavors (dev / staging / prod)

```dart
enum AppEnvironment { dev, staging, prod }

class AppConfig {
  static late AppEnvironment environment;
  static late String apiBaseUrl;
  static late String appName;

  static void initialize(AppEnvironment env) {
    environment = env;
    switch (env) {
      case AppEnvironment.dev:
        apiBaseUrl = 'https://dev.api.trekdiary.com';
        appName = 'Trek Diary DEV';
      case AppEnvironment.staging:
        apiBaseUrl = 'https://staging.api.trekdiary.com';
        appName = 'Trek Diary STAGING';
      case AppEnvironment.prod:
        apiBaseUrl = 'https://api.trekdiary.com';
        appName = 'Trek Diary';
    }
  }
}
```

```dart
// lib/main_dev.dart
void main() {
  AppConfig.initialize(AppEnvironment.dev);
  runApp(const ProviderScope(child: App()));
}

// lib/main_prod.dart
void main() {
  AppConfig.initialize(AppEnvironment.prod);
  runApp(const ProviderScope(child: App()));
}
```

```bash
flutter run -t lib/main_dev.dart --flavor dev
flutter run -t lib/main_prod.dart --flavor prod
flutter build appbundle -t lib/main_prod.dart --flavor prod --release
```

## GitHub Actions CI/CD

```yaml
# .github/workflows/release.yml
name: Release to Play Store
on:
  push:
    tags: ['v*']

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17', distribution: 'temurin' }
      - uses: subosito/flutter-action@v2
        with: { flutter-version: '3.24.0' }

      - name: Decode keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/trek-diary.jks

      - name: Create key.properties
        run: |
          cat > android/key.properties << EOF
          storePassword=${{ secrets.STORE_PASSWORD }}
          keyPassword=${{ secrets.KEY_PASSWORD }}
          keyAlias=${{ secrets.KEY_ALIAS }}
          storeFile=trek-diary.jks
          EOF

      - run: flutter pub get
      - run: flutter test
      - run: flutter build appbundle -t lib/main_prod.dart --flavor prod --release

      - uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT }}
          packageName: com.yourcompany.trekdiary
          releaseFiles: build/app/outputs/bundle/prodRelease/app-prod-release.aab
          track: internal
          status: completed
```

Secrets: `KEYSTORE_BASE64` (base64 .jks), `STORE_PASSWORD`, `KEY_PASSWORD`, `KEY_ALIAS`, `PLAY_STORE_SERVICE_ACCOUNT`

## Google Play Console — Release Track Strategy

```
Internal Testing → Alpha → Beta → Production

Internal:   QA team, instant availability, up to 100 testers
Alpha:      Closed group, opt-in, early external feedback
Beta:       Open opt-in, pre-production validation
Production: Staged rollout (start 5-10%, watch crash rate, then increase)
```

```yaml
# Staged rollout via GitHub Actions
- uses: r0adkll/upload-google-play@v1
  with:
    track: production
    userFraction: 0.10  # 10% rollout
    status: inProgress  # or 'completed' for 100%
```

## App Versioning

```yaml
# pubspec.yaml
version: 1.2.3+45
#         ^   ^-- build number (versionCode on Android — increment every upload)
#         semantic version displayed to users
```

```bash
BUILD_NUMBER=$(git rev-list --count HEAD)
flutter build appbundle --build-number=$BUILD_NUMBER --build-name=1.2.3
```

## Pre-Release Checklist

- [ ] Remove all debug logging and print statements
- [ ] `flutter analyze` — zero warnings; all tests pass
- [ ] App bundle (not APK) submitted to Play Store
- [ ] SHA-1 fingerprint added to Firebase Console for release keystore
- [ ] `google-services.json` is production Firebase project
- [ ] Deep link domains verified in Play Console (App Links)
- [ ] FCM server key is production key
- [ ] `AndroidManifest.xml` — no debug flags, permissions minimal
- [ ] Target SDK set to latest Play Store requirement
- [ ] Crash rate < 1% on existing releases before increasing rollout
- [ ] Privacy policy URL, screenshots, and store listing updated

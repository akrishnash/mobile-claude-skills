---
name: flutter-ui
description: Deep Flutter UI skill covering widget architecture, Material 3 theming, responsive/adaptive layouts, animations, custom painting, performance, and accessibility. Trigger this skill whenever the user is building Flutter screens, designing widget trees, implementing animations or custom UI effects, working with themes or design systems, handling scroll behavior, building reusable component libraries, or optimizing widget rendering performance. Use this for any task involving how something looks, feels, or moves in a Flutter app.
---

# Flutter UI — Deep Reference

## Widget Architecture Fundamentals

### The three widget types and when to use each

```dart
// StatelessWidget — pure function of its inputs, no internal state
class TrekCard extends StatelessWidget {
  const TrekCard({super.key, required this.trek});
  final Trek trek;

  @override
  Widget build(BuildContext context) => Card(child: Text(trek.name));
}

// StatefulWidget — manages ephemeral UI state (animations, form fields, toggles)
// Only use when state is truly local and doesn't need sharing
class ExpandableSection extends StatefulWidget {
  const ExpandableSection({super.key, required this.child});
  final Widget child;

  @override
  State<ExpandableSection> createState() => _ExpandableSectionState();
}

class _ExpandableSectionState extends State<ExpandableSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      GestureDetector(onTap: () => setState(() => _expanded = !_expanded)),
      if (_expanded) widget.child,
    ]);
  }
}

// ConsumerWidget (Riverpod) — reads providers, rebuilds on change
class TrekListScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final treks = ref.watch(trekListProvider);
    return treks.when(data: (t) => ListView(...), loading: () => const CircularProgressIndicator(), error: (e, _) => ErrorWidget(e));
  }
}
```

### const — the single biggest free performance win

Every widget that doesn't change at runtime should be `const`. The Flutter framework skips rebuilding const widgets entirely.

```dart
// Bad — rebuilds on every parent rebuild
child: Padding(padding: EdgeInsets.all(16), child: Icon(Icons.star))

// Good — framework skips this subtree
child: const Padding(padding: EdgeInsets.all(16), child: Icon(Icons.star))
```

Enable the lint rule `prefer_const_constructors` in `analysis_options.yaml` to catch missing `const` automatically.

---

## Material 3 Theming

### Setting up a complete M3 theme

```dart
ThemeData buildTheme(ColorScheme colorScheme) => ThemeData(
  useMaterial3: true,
  colorScheme: colorScheme,
  textTheme: _buildTextTheme(),
  appBarTheme: AppBarTheme(
    backgroundColor: colorScheme.surface,
    foregroundColor: colorScheme.onSurface,
    elevation: 0,
    scrolledUnderElevation: 1,
  ),
  cardTheme: CardTheme(
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    color: colorScheme.surfaceContainerHighest,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: colorScheme.surfaceContainerHighest,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
  ),
);
```

### Dynamic color (system wallpaper colors on Android 12+)

```dart
// pubspec.yaml: dynamic_color: ^1.7.0
import 'package:dynamic_color/dynamic_color.dart';

class App extends StatelessWidget {
  @override
  Widget build(BuildContext context) => DynamicColorBuilder(
    builder: (lightDynamic, darkDynamic) {
      final lightScheme = lightDynamic?.harmonized() ?? ColorScheme.fromSeed(seedColor: Colors.teal);
      final darkScheme = darkDynamic?.harmonized() ?? ColorScheme.fromSeed(seedColor: Colors.teal, brightness: Brightness.dark);
      return MaterialApp(theme: buildTheme(lightScheme), darkTheme: buildTheme(darkScheme));
    },
  );
}
```

### Typography — M3 type scale

```dart
TextTheme _buildTextTheme() => const TextTheme(
  displayLarge: TextStyle(fontSize: 57, fontWeight: FontWeight.w400, letterSpacing: -0.25),
  displayMedium: TextStyle(fontSize: 45, fontWeight: FontWeight.w400),
  headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w600),
  headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w500),
  titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
  bodyLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w400, height: 1.5),
  bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.43),
  labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: 0.1),
);
// Access: Theme.of(context).textTheme.headlineMedium
```

### Theme extensions — custom tokens

```dart
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({required this.success, required this.warning});
  final Color success;
  final Color warning;

  @override
  AppColors copyWith({Color? success, Color? warning}) =>
      AppColors(success: success ?? this.success, warning: warning ?? this.warning);

  @override
  AppColors lerp(AppColors other, double t) =>
      AppColors(success: Color.lerp(success, other.success, t)!, warning: Color.lerp(warning, other.warning, t)!);
}

// Register: ThemeData(extensions: [AppColors(success: Colors.green, warning: Colors.orange)])
// Access: Theme.of(context).extension<AppColors>()!.success
```

---

## Responsive & Adaptive Layouts

### The layout decision tree

```
Is content fundamentally different between platforms?
  YES → use Platform.isAndroid / kIsWeb to serve different widget trees
  NO  → use LayoutBuilder / MediaQuery to scale the same tree

Is it a breakpoint change (phone vs tablet)?
  YES → LayoutBuilder with breakpoints
  NO  → use Flexible/Expanded for proportional sizing
```

### LayoutBuilder — the responsive workhorse

```dart
class AdaptiveLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      if (constraints.maxWidth >= 900) return _WideLayout();
      if (constraints.maxWidth >= 600) return _MediumLayout();
      return _NarrowLayout();
    },
  );
}
```

### MediaQuery — screen properties

```dart
// Avoid calling MediaQuery.of(context) deeply — it triggers rebuild on any dimension change
// Prefer: MediaQuery.sizeOf(context), MediaQuery.paddingOf(context) (Flutter 3.10+)
final size = MediaQuery.sizeOf(context);
final padding = MediaQuery.paddingOf(context); // safe area insets

// Bottom padding for floating buttons above nav bar
Padding(padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom))
```

### Safe area and notch handling

```dart
// Always wrap top-level screens
Scaffold(
  body: SafeArea(
    child: ...,
  ),
)

// For custom bottom sheets / overlays that need bottom inset
Container(
  padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom + 16),
)
```

---

## Animations

### Which animation API to use

| Situation | Use |
|---|---|
| Simple show/hide, size, color | `AnimatedContainer`, `AnimatedOpacity`, `AnimatedSwitcher` |
| Controlled sequence / physics | `AnimationController` + `Tween` |
| Page transitions | `Hero` + custom `PageRouteBuilder` |
| Complex choreography | `AnimationController` + `CurvedAnimation` + staggered intervals |
| Heavy effects | Lottie / Rive |

### AnimationController + Tween — the core pattern

```dart
class PulseButton extends StatefulWidget {
  @override
  State<PulseButton> createState() => _PulseButtonState();
}

class _PulseButtonState extends State<PulseButton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
    _scale = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose(); // ALWAYS dispose controllers
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTapDown: (_) => _controller.forward(),
    onTapUp: (_) => _controller.reverse(),
    onTapCancel: () => _controller.reverse(),
    child: ScaleTransition(scale: _scale, child: /* your button */),
  );
}
```

### AnimatedSwitcher — swap between widgets with animation

```dart
AnimatedSwitcher(
  duration: const Duration(milliseconds: 300),
  transitionBuilder: (child, animation) => FadeTransition(opacity: animation, child: child),
  child: _isLoading
      ? const CircularProgressIndicator(key: ValueKey('loading'))
      : Text(data, key: ValueKey(data)), // key change triggers animation
)
```

### Hero transitions — shared element between routes

```dart
// Source screen
Hero(
  tag: 'trek-image-${trek.id}', // tag must be unique on screen
  child: Image.network(trek.imageUrl),
)

// Destination screen — same tag
Hero(
  tag: 'trek-image-${trek.id}',
  child: Image.network(trek.imageUrl, fit: BoxFit.cover),
)
```

### Staggered animations

```dart
class StaggeredList extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(
    children: List.generate(items.length, (i) => AnimationConfiguration.staggeredList(
      position: i,
      duration: const Duration(milliseconds: 375),
      child: SlideAnimation(
        verticalOffset: 50,
        child: FadeInAnimation(child: ItemCard(item: items[i])),
      ),
    )),
  );
}
// Package: flutter_staggered_animations
```

---

## Custom Painting

### CustomPainter — for anything widgets can't do

```dart
class ArcProgressPainter extends CustomPainter {
  const ArcProgressPainter({required this.progress, required this.color});
  final double progress; // 0.0 to 1.0
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 8;

    // Background track
    canvas.drawCircle(center, radius, Paint()
      ..color = color.withOpacity(0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8);

    // Progress arc
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2, // start at top
      2 * math.pi * progress,
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 8
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(ArcProgressPainter old) => old.progress != progress || old.color != color;
}

// Usage
CustomPaint(
  size: const Size(120, 120),
  painter: ArcProgressPainter(progress: 0.7, color: Theme.of(context).colorScheme.primary),
)
```

---

## Scroll & Sliver Widgets

### SliverAppBar — collapsible header

```dart
CustomScrollView(slivers: [
  SliverAppBar(
    expandedHeight: 240,
    pinned: true, // stays visible when collapsed
    stretch: true,
    flexibleSpace: FlexibleSpaceBar(
      title: const Text('Trek Name'),
      background: Image.network(imageUrl, fit: BoxFit.cover),
      stretchModes: const [StretchMode.zoomBackground, StretchMode.blurBackground],
    ),
  ),
  SliverList(delegate: SliverChildBuilderDelegate((ctx, i) => ItemTile(items[i]), childCount: items.length)),
])
```

### Infinite scroll with Riverpod

```dart
final trekListProvider = StateNotifierProvider<TrekListNotifier, TrekListState>((ref) => TrekListNotifier(ref));

class TrekListNotifier extends StateNotifier<TrekListState> {
  TrekListNotifier(this.ref) : super(const TrekListState());

  Future<void> loadMore() async {
    if (state.isLoading || !state.hasMore) return;
    state = state.copyWith(isLoading: true);
    final next = await ref.read(trekRepositoryProvider).getPage(state.page + 1);
    state = state.copyWith(
      treks: [...state.treks, ...next],
      page: state.page + 1,
      hasMore: next.isNotEmpty,
      isLoading: false,
    );
  }
}

// In build:
NotificationListener<ScrollEndNotification>(
  onNotification: (n) {
    if (n.metrics.extentAfter < 200) ref.read(trekListProvider.notifier).loadMore();
    return false;
  },
  child: ListView.builder(...),
)
```

---

## Performance Optimization

### RepaintBoundary — isolate expensive repaints

```dart
// Wrap widgets that repaint independently to prevent propagation
RepaintBoundary(
  child: AnimatedContainer(...), // animation won't repaint siblings
)

// Use on list items that have animations
ListView.builder(
  itemBuilder: (_, i) => RepaintBoundary(child: TrekCard(trek: treks[i])),
)
```

### Keys — help Flutter identify widgets across rebuilds

```dart
// ValueKey — when widget identity matches a data value
ListView(children: items.map((item) => TrekCard(key: ValueKey(item.id), trek: item)).toList())

// GlobalKey — to access widget state from outside (use sparingly)
final _formKey = GlobalKey<FormState>();
Form(key: _formKey, ...)
if (_formKey.currentState!.validate()) { ... }

// UniqueKey — force rebuild on every render (e.g., reset state)
child: SomeWidget(key: UniqueKey()) // new key = new State object
```

### ListView.builder vs ListView — always prefer builder for long lists

```dart
// Bad for long lists — builds all items upfront
ListView(children: items.map((e) => ItemWidget(e)).toList())

// Good — builds only visible items + small buffer
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ItemWidget(items[index]),
  addRepaintBoundaries: true, // default true, but make it explicit
)
```

### Image performance

```dart
// cached_network_image package — handles caching, loading, error states
CachedNetworkImage(
  imageUrl: url,
  placeholder: (ctx, url) => const ShimmerPlaceholder(),
  errorWidget: (ctx, url, e) => const Icon(Icons.broken_image),
  memCacheWidth: 400, // downscale for memory efficiency
  fit: BoxFit.cover,
)

// For local images, pre-cache on route push
await precacheImage(FileImage(File(path)), context);
```

---

## Accessibility

### Semantics — what screen readers announce

```dart
Semantics(
  label: 'Trek distance: ${trek.distance} kilometers',
  hint: 'Double tap to view details',
  button: true,
  child: GestureDetector(onTap: ..., child: DistanceWidget(trek)),
)

// For images, always provide semantic label
Image.network(url, semanticLabel: 'Photo of ${trek.name}')

// Exclude decorative elements
ExcludeSemantics(child: DecorativeIcon())
```

### Minimum touch target — 48×48 dp

```dart
// Material 3 enforces this on buttons automatically
// For custom tappable widgets, ensure minimum size:
SizedBox(
  width: 48,
  height: 48,
  child: IconButton(onPressed: ..., icon: const Icon(Icons.star)),
)
// Or use: constraints: BoxConstraints(minWidth: 48, minHeight: 48)
```

### Contrast — WCAG AA minimum

- Normal text: 4.5:1 contrast ratio
- Large text (18sp+): 3:1
- Use `Theme.of(context).colorScheme.onSurface` over `colorScheme.surface` — never hardcode colors over dynamic backgrounds
- Test with `flutter test --dart-define=FLUTTER_ACCESSIBILITY_FEATURES=all`

---

## Common Patterns

### Pull to refresh

```dart
RefreshIndicator(
  onRefresh: () => ref.refresh(trekListProvider.future),
  child: ListView.builder(...),
)
```

### Bottom sheet — modal vs persistent

```dart
// Modal (dismissable)
showModalBottomSheet(
  context: context,
  isScrollControlled: true, // allows full height
  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
  builder: (_) => DraggableScrollableSheet(
    expand: false,
    initialChildSize: 0.5,
    minChildSize: 0.25,
    maxChildSize: 0.9,
    builder: (_, controller) => ListView(controller: controller, children: [...]),
  ),
);

// Persistent (part of Scaffold)
Scaffold(
  bottomSheet: Container(height: 80, child: PlayerControls()),
  body: ...,
)
```

### Shimmer loading placeholders

```dart
// shimmer package
Shimmer.fromColors(
  baseColor: colorScheme.surfaceContainerHighest,
  highlightColor: colorScheme.surface,
  child: Column(children: List.generate(5, (_) => const CardSkeleton())),
)
```

### Empty states and error states

Always handle these — never show a blank screen.

```dart
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message, this.icon, this.action});
  final String message;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      if (icon != null) Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
      const SizedBox(height: 16),
      Text(message, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.outline)),
      if (action != null) ...[const SizedBox(height: 24), action!],
    ]),
  );
}
```

---

## Reference: Widget Cheat Sheet

| Need | Widget |
|---|---|
| Vertical list of children | `Column` / `ListView` |
| Scrollable lazy list | `ListView.builder` |
| Grid | `GridView.builder` |
| Horizontal scroll | `SingleChildScrollView(scrollDirection: Axis.horizontal)` |
| Stack layers | `Stack` + `Positioned` |
| Flexible row/column | `Row`/`Column` + `Flexible`/`Expanded` |
| Card surface | `Card` / `Surface` (M3) |
| Overlay/dialog | `showDialog`, `showModalBottomSheet`, `Overlay` |
| Gradient | `DecoratedBox(decoration: BoxDecoration(gradient: ...))` |
| Clip shape | `ClipRRect`, `ClipOval`, `ClipPath` |
| Transform | `Transform.scale`, `Transform.rotate`, `Transform.translate` |
| Spacing | `SizedBox(height: N)`, `Gap` (package) |
| Conditional | `if (cond) Widget()` inside collection — never ternary with null |

---
name: flutter-polish
description: >
  Apply world-class UI design principles — the same ones used by Airbnb, Duolingo, Wise, Uber, and Tinder — when creating interfaces, critiquing designs, writing UI copy, choosing color palettes, or advising on visual style. Use this skill whenever the user asks about: making an app look better, why an AI-generated UI feels off, color palette choices, typography for apps, spacing/layout polish, animation principles, or any request to "make it feel like a real app." Also trigger when the user asks to build or improve a UI component, dashboard, landing page, or mobile screen and quality/aesthetics matter.
---

# UI Trends — World-Class App Design

Reference knowledge distilled from studying Airbnb, Duolingo, Wise, Uber, and Tinder.

## The single most important rule

**Each screen does one job.** One primary action. One focal point. One question asked of the user. Everything else recedes.

## Color

- **1–2 accent colors maximum.** The rest is black, white, and gray.
- The accent appears **once per screen** — on the single most important element (usually the CTA button).
- Color encodes **meaning**, not decoration. Green = success/money. Red = error/passion.

### App-specific palettes

| App | Primary accent | Secondary | Base | Philosophy |
|---|---|---|---|---|
| Airbnb | `#FF5A5F` Rausch coral | `#767676` Foggy gray | White | Coral appears only on CTAs; photos carry all visual weight |
| Duolingo | `#58CC02` Duo green | `#FFD900` Yellow, `#FF4B4B` Red | White | Each color has a job: green=correct, red=wrong, yellow=streak |
| Wise | `#9FE870` Neon green | `#163300` Deep forest | Off-white `#F5F4F0` | High-contrast brand pair; zero decorative use of color |
| Uber | `#000000` Black | `#276EF1` Blue (status only) | `#F6F6F6` Surface | Monochrome base; color only for live state (ETA, error) |
| Tinder | `#FF655B` Flame | `#FD267A` Hot pink | White | Gradient only on brand logo — never in the product UI |

### What to avoid
- More than 2 accent colors in a single view
- Gradients on UI surfaces (buttons, cards, backgrounds)
- Using color to create hierarchy — use size and weight instead
- Colored text for emphasis — use weight (semibold) instead

## Typography

1. **Two font sizes per component.** Big label + small helper. Never 4 sizes in one card.
2. **Weight over color for emphasis.** Semibold catches the eye faster than colored text.
3. **Line-height 1.4–1.6 for body copy.**
4. **Rounded typefaces signal warmth.** Sharp geometric cuts feel cold and corporate.

- **Airbnb** — Custom "Cereal". Rounded, warm. Communicates trust.
- **Duolingo** — Rounded sans with playful weight. Reinforces game-like feeling.
- **Wise** — DM Sans. Clean, geometric, precise — feels financial without being sterile.
- **Uber** — Uber Move. Tight, neutral, space-efficient. Information density priority.
- **Tinder** — System sans. Photos are the personality; type stays out of the way.

## Spacing & Layout

**8px grid** — all spacing is a multiple of 4px or 8px. Common values: `4, 8, 12, 16, 24, 32, 48, 64px`

- Generous padding makes ordinary content look premium.
- Great apps have 2–3 levels of visual nesting, not 5. Flatten card-in-card-in-modal patterns.
- Minimum **44 × 44px** touch targets. Make the entire row/card tappable.

## Motion & Animation

Every animation must communicate a **state change** — answering "did that work?" or "where did that go?"

### Duration guide

| Type | Duration | Easing |
|---|---|---|
| Micro-interaction (button press) | 80–120ms | ease-out |
| State transition (screen change) | 200–300ms | ease-in-out |
| Celebration / reward | 400–600ms | spring / bounce |
| Loading skeleton | 1000–1500ms loop | ease-in-out |

### What to avoid
- Animations over 400ms on routine interactions
- Animation on every element simultaneously (choose one focal point)
- Looping decorative animations with no informational purpose

## Interaction Patterns

- **Gesture as verb (Tinder)** — swipe left/right replaces buttons. Ask if a gesture can replace a button.
- **Map as interface (Uber)** — map fills entire screen; UI floats as minimal cards on top.
- **Feedback loops (Duolingo)** — every correct action gets visual confirmation + optional sound.
- **Photo-first cards (Airbnb, Tinder)** — full-width image, rounded corners, title + 1–2 metadata lines. Nothing else.

## The "Tactile" Effect (Duolingo's signature)

```css
/* Duolingo-style tactile button */
.btn {
  background: #58CC02;
  border-bottom: 4px solid #3d9900;
  border-radius: 16px;
  transform: translateY(0);
  transition: transform 80ms ease-out, border-bottom 80ms ease-out;
}
.btn:active {
  transform: translateY(4px);
  border-bottom: 0px solid #3d9900;
}
```

## Why AI-generated UIs feel off

| Problem | Root cause | Fix |
|---|---|---|
| Too many colors | No restraint heuristic | Pick 1 accent, use it once per screen |
| Everything same visual weight | No hierarchy decisions made | One element is the star; everything else recedes |
| Gradient overuse | Default "looks fancy" assumption | Use flat fills; gradients only for brand logo |
| Card-inside-card nesting | Additive design without subtraction | Flatten to max 2 levels |
| Mismatched spacing | No grid system | Enforce 8px grid throughout |
| Generic icons | No cohesion pass | Use one icon library, one weight, one style |
| No motion | Skipped as "extra" | Add at minimum: button press feedback + screen transition |
| Missing touch affordance | Desktop-first thinking | 44px minimum touch targets; entire row is tappable |

## Quick Reference

- **Palette**: 1 brand accent + near-black or near-white. Done.
- **Typography**: 24–32px headline / 16px body / 12–13px metadata. Two weights: regular + semibold.
- **Card spacing**: 16px padding all sides. 8px between elements inside. 12–16px gap between cards.
- **Button**: Solid fill with brand accent. 44px+ height. Full-width on mobile. One button per screen section.
- **Animation**: Does this communicate a state change? If not, cut it. If yes, keep under 300ms.
- **Image on card**: 16:9 or 4:3 ratio. `object-fit: cover`. 8–12px border-radius. No border.

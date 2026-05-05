---
name: ui-trends
description: >
  Apply world-class UI design principles — the same ones used by Airbnb, Duolingo, Wise, Uber, and Tinder — when creating interfaces, critiquing designs, writing UI copy, choosing color palettes, or advising on visual style. Use this skill whenever the user asks about: making an app look better, why an AI-generated UI feels off, color palette choices, typography for apps, spacing/layout polish, animation principles, or any request to "make it feel like a real app." Also trigger when the user asks to build or improve a UI component, dashboard, landing page, or mobile screen and quality/aesthetics matter.
---

# UI Trends — World-Class App Design

Reference knowledge distilled from studying Airbnb, Duolingo, Wise, Uber, and Tinder. Apply these principles whenever producing or critiquing any visual interface.

---

## The single most important rule

**Each screen does one job.** One primary action. One focal point. One question asked of the user. Everything else recedes. This alone separates great apps from cluttered ones.

---

## Color

### How top apps use color
- **1–2 accent colors maximum.** The rest is black, white, and gray.
- The accent appears **once per screen** — on the single most important element (usually the CTA button).
- Color encodes **meaning**, not decoration. Green = success/money. Red = error/passion. Never cycle colors randomly.

### App-specific palettes

| App | Primary accent | Secondary | Base | Philosophy |
|---|---|---|---|---|
| Airbnb | `#FF5A5F` Rausch coral | `#767676` Foggy gray | White | Coral appears only on CTAs; photos carry all visual weight |
| Duolingo | `#58CC02` Duo green | `#FFD900` Yellow, `#FF4B4B` Red | White | Each color has a job: green=correct, red=wrong, yellow=streak |
| Wise | `#9FE870` Neon green | `#163300` Deep forest | Off-white `#F5F4F0` | High-contrast brand pair; zero decorative use of color |
| Uber | `#000000` Black | `#276EF1` Blue (status only) | `#F6F6F6` Surface | Monochrome base; color only appears for live state (ETA, error) |
| Tinder | `#FF655B` Flame | `#FD267A` Hot pink | White | Gradient only on brand logo — never in the product UI |

### What to avoid
- More than 2 accent colors in a single view
- Gradients on UI surfaces (buttons, cards, backgrounds)
- Using color to create hierarchy — use size and weight instead
- Colored text for emphasis — use weight (semibold) instead

---

## Typography

### Rules all great apps follow
1. **Two font sizes per component.** Big label + small helper. Never 4 sizes in one card.
2. **Weight over color for emphasis.** Semibold catches the eye faster than colored text.
3. **Line-height 1.4–1.6 for body copy.** Tighter feels cramped on mobile; looser feels airy and readable.
4. **Rounded typefaces signal warmth and approachability.** Sharp geometric cuts feel cold and corporate.

### App-specific type choices
- **Airbnb** — Custom "Cereal" typeface. Rounded, warm, proprietary. Communicates trust.
- **Duolingo** — Rounded sans with playful weight. Reinforces the fun, game-like feeling.
- **Wise** — DM Sans. Clean, geometric, precise — feels financial without being sterile.
- **Uber** — Uber Move. Tight, neutral, space-efficient. Information density is the priority.
- **Tinder** — System sans. The photos are the personality; type just needs to stay out of the way.

---

## Spacing & Layout

### The 8px grid
All spacing is a multiple of **4px or 8px**. Padding, margins, gaps, component heights — everything. When this grid breaks, the eye reads "amateur" even if it can't name why.

Common values: `4, 8, 12, 16, 24, 32, 48, 64px`

### Breathing room is a feature
Generous padding makes ordinary content look premium. Do not compress elements to show more on screen — users trust interfaces that don't feel rushed.

### Shallow hierarchy
Great apps have 2–3 levels of visual nesting, not 5. Card inside card inside card inside modal = cognitive overload. Flatten it.

### Touch targets
Minimum **44 × 44px** for any tappable element. Great apps make the entire row/card tappable — not just a small button within it.

---

## Photography & Illustration as UI

Airbnb and Tinder don't decorate their interfaces. The **content is the decoration**. The UI chrome (buttons, headers, nav) is designed to disappear so the image fills the user's attention.

Principles:
- Full-bleed images with minimal overlaid chrome
- Text on images: use a subtle dark scrim (`rgba(0,0,0,0.3)`) — never a colored background
- The card is 80–90% image; metadata is minimal (name, price, rating only)
- Never use stock-looking illustration when real photography is possible

---

## Motion & Animation

### The rule: motion earns its place
Every animation must communicate a **state change**. It exists to answer: "did that work?" or "where did that go?"

### Duration guide
| Type | Duration | Easing |
|---|---|---|
| Micro-interaction (button press) | 80–120ms | ease-out |
| State transition (screen change) | 200–300ms | ease-in-out |
| Celebration / reward | 400–600ms | spring / bounce |
| Loading skeleton | 1000–1500ms loop | ease-in-out |

### Signature moments by app
- **Duolingo** — Correct answer: sound + confetti + XP counter animation. Engineered dopamine.
- **Tinder** — Match screen: full-screen burst animation. The emotional payoff of the whole app.
- **Uber** — Car pin moves in real-time on the map. The motion *is* the reassurance.
- **Airbnb** — Heart "favorite" animation. Small, satisfying, confirms the action.

### What to avoid
- Animations over 400ms on routine interactions
- Animation on every element simultaneously (choose one focal point)
- Looping decorative animations with no informational purpose

---

## Interaction Patterns

### Gesture as verb (Tinder)
The swipe left/right is so intuitive it requires no tutorial. The entire product is built on one gesture. When designing: ask if a gesture can replace a button.

### Map as interface (Uber)
The map fills the entire screen. UI floats as minimal cards on top. The map provides context; the card provides action. Never obscure the map with UI chrome.

### Feedback loops (Duolingo)
Every correct action should have feedback: visual confirmation + (optionally) sound. Users need to feel that the system heard them.

### Photo-first cards (Airbnb, Tinder)
The card pattern: full-width image, rounded corners, title + 1–2 metadata lines below. Nothing else. Resist adding more fields.

---

## The "Tactile" Effect (Duolingo's signature)

Duolingo's buttons have a **flat 3–4px bottom border** in a darker shade, giving them a pressed/3D feel. When clicked, the button drops by that amount. This creates a physical, game-controller sensation that reinforces the playful brand.

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

---

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

---

## Quick Reference: Design Decisions

**Choosing a palette?**
→ Pick 1 brand accent. Pair with near-black or near-white. Done.

**Typography hierarchy?**
→ 24–32px headline / 16px body / 12–13px metadata. Two weights: regular + semibold.

**Spacing on a card?**
→ 16px padding all sides. 8px between elements inside. 12–16px gap between cards.

**Button style?**
→ Solid fill with brand accent. 44px+ height. Full-width on mobile. One button per screen section.

**Adding animation?**
→ Ask: does this communicate a state change? If not, cut it. If yes, keep it under 300ms.

**Image on a card?**
→ 16:9 or 4:3 aspect ratio. `object-fit: cover`. Subtle border-radius (8–12px). No border.
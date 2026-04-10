# Design System Document: High-End Editorial Wellness

## 1. Overview & Creative North Star
**Creative North Star: The Digital Sanctuary**

This design system is not a utility; it is an atmosphere. To reflect the premium nature of the '足宝' (Zubao) foot spa platform, we move away from traditional "app" layouts toward a **High-End Editorial** experience. The goal is to evoke the feeling of flipping through a luxury wellness magazine—calm, moderate, and authoritative.

We break the "template" look by utilizing **Intentional Asymmetry**. Instead of centering every element, we use the normal spacing scale to create "breathing rooms." Overlapping elements (e.g., a high-resolution image partially covered by a glassmorphic text card) create a sense of physical depth and tactile luxury, moving the interface from a flat screen to a layered sanctuary.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
The palette is rooted in the contrast between clinical purity and organic growth.

### The Palette
- **Primary Sanctuary:** `primary` (#006c49) and the signature `primary_container` (#10b981). This "Zubao Green" is our lifeblood—use it sparingly to guide the eye.
- **The Grayscale Soul:** Use `surface` (#fcf8fb) for the canvas and `on_surface` (#1b1b1d) for sharp, readable content.
- **The "No-Line" Rule:** **1px solid borders are strictly prohibited for sectioning.** To separate content, use background shifts. A `surface_container_low` section sitting on a `surface` background creates a sophisticated boundary that feels architectural rather than "drawn."

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of fine paper.
- **Base Layer:** `surface` (#fcf8fb).
- **Secondary Content Blocks:** `surface_container_low`.
- **Interactive Cards:** `surface_container_lowest` (#ffffff) to create a subtle "lift" against the off-white background.

### The "Glass & Gradient" Rule
For floating headers and modal overlays, use **Glassmorphism**. Apply `surface` at 70% opacity with a `backdrop-blur` of 20px. For primary CTAs, apply a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle to provide "soul" and a jewel-like finish.

---

## 3. Typography: Editorial Authority
We use a dual-font strategy to balance modern tech with high-end lifestyle.

- **Display & Headlines (Manrope):** Our "Voice." Used for `display-lg` (3.5rem) down to `headline-sm`. Manrope’s geometric yet warm curves convey professionalism. Use `display-lg` for hero sections with tight letter-spacing (-0.02em) to create an authoritative, "editorial" impact.
- **Body & Labels (Inter):** Our "Information." Inter provides maximum readability for service descriptions and therapist bios.
- **Hierarchy Tip:** Use `headline-md` for section titles, but pair it with a `label-md` "kicker" above it in `primary` (#006c49) all-caps to reinforce the premium editorial feel.

---

## 4. Elevation & Depth: Atmospheric Layering
Depth in this system is organic, not artificial.

- **The Layering Principle:** Rather than shadows, use **Tonal Layering**. An image placed on `surface` might have a caption card placed on its corner using `surface_container_highest`. This "stacking" defines importance without visual clutter.
- **Ambient Shadows:** When an element must float (e.g., a floating booking button), use a shadow color tinted with the brand’s `on_surface` color at 4% opacity with a 40px blur. It should look like a soft glow of light, not a "drop shadow."
- **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline_variant` at **10% opacity**. It should be felt, not seen.
- **Glassmorphism:** Use `surface_container_low` with 60% alpha for headers. This allows the lush colors of spa imagery to bleed through as the user scrolls, maintaining a connection to the visual "mood."

---

## 5. Components
All components must adhere to the `lg` (1rem/16px) or `xl` (1.5rem/24px) roundedness tokens.

- **Buttons:**
- **Primary:** Gradient fill (`primary` to `primary_container`), `xl` roundedness. No border.
- **Secondary:** `surface_container_high` background with `on_surface` text.
- **Cards & Lists:** **Forbid divider lines.** Use `16` (5.5rem) or `12` (4rem) spacing units to separate list items. A therapist's list item should be a "tile" on `surface_container_low`, separated by white space.
- **Input Fields:** Use `surface_container_lowest` for the field background. The label should sit above in `label-md`. On focus, use a "Ghost Border" of `primary` at 40% opacity.
- **Chips:** For selecting treatments (e.g., "Deep Tissue"). Use `md` roundedness. Unselected: `surface_container_high`. Selected: `primary` with `on_primary` text.
- **Signature Component: The "Zen Loader":** Instead of a spinning circle, use a slow-pulsing `primary_container` (#10B981) gradient blur to indicate loading, maintaining the "relaxing" tone.

---

## 6. Do's and Don'ts

### Do
- **Do** use ample amounts of white space (Scale `16` and `20`) to create a sense of luxury.
- **Do** use high-quality, desaturated photography of textures (water, stones, linen).
- **Do** favor asymmetric layouts—e.g., a headline aligned left with a CTA button shifted to the far right.
- **Do** use the `primary_fixed` (#6ffbbe) color for "Success" states to maintain the green harmony.

### Don't
- **Don't** use 1px black or gray borders to separate cards.
- **Don't** use "pure black" (#000000) for text; always use `on_surface` (#1b1b1d) for a softer, premium feel.
- **Don't** crowd the screen. If you think there's enough space, add 20% more.
- **Don't** use harsh, fast animations. All transitions should use a custom "Soothe" easing (e.g., `cubic-bezier(0.4, 0, 0.2, 1)`) over 400ms.
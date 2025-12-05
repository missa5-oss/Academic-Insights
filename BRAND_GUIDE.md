# Johns Hopkins Carey Business School – Modern Design System
**Version 2.0**

> "Build for what's next."

This document serves as the technical source of truth for the JHU Carey Business School web application. It outlines the color palette (including the new Teal and Lime accents), typography, and component specifications.

---

## 1. Color System

Our palette balances the prestige of the Johns Hopkins heritage with the modern, forward-looking energy of the Carey Business School.

### Primary Palette
Used for main actions, navigation, and brand anchoring.

| Color Name | Hex Code | Tailwind Token | Usage |
| :--- | :--- | :--- | :--- |
| **Heritage Blue** | `#002D72` | `bg-jhu-heritage` | Primary buttons, headers, active states. |
| **Spirit Blue** | `#68ACE5` | `bg-jhu-spirit` | Accents, gradients, secondary highlights. |
| **Carey Teal** | `#007567` | `bg-jhu-green` | "Apply" / "Visit" buttons, success states, nature motifs. |

### Secondary & Accent Palette
Used for visual interest, data visualization, and calls to action.

| Color Name | Hex Code | Tailwind Token | Usage |
| :--- | :--- | :--- | :--- |
| **Electric Lime** | `#D0DA48` | `bg-jhu-lime` | High-visibility accents, data viz highlighting. |
| **JHU Gold** | `#A19261` | `bg-jhu-gold` | Awards, certificates, premium accents. |
| **Legacy Black** | `#31261D` | `bg-jhu-black` | High contrast text, footers. |
| **Accent Alert** | `#CF4520` | `bg-jhu-accent` | Errors, urgent notices, negative trends. |

### Neutrals
| Color Name | Hex Code | Tailwind Token | Usage |
| :--- | :--- | :--- | :--- |
| **Slate 900** | `#0f172a` | `text-slate-900` | Primary Body Text. |
| **Slate 500** | `#64748b` | `text-slate-500` | Secondary Text / Meta data. |
| **Surface Gray** | `#F5F5F7` | `bg-jhu-gray` | Page backgrounds, subtle sections. |

---

## 2. Configuration (Tailwind CSS)

Copy this configuration into your `tailwind.config.js` to ensure brand consistency across the platform.

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        jhu: {
          heritage: '#002D72', // Core Brand Blue
          spirit: '#68ACE5',   // Secondary Blue
          green: '#007567',    // Carey Teal (Apply Buttons)
          lime: '#D0DA48',     // Electric Lime (Accents)
          accent: '#CF4520',   // Alert / Red
          gold: '#A19261',     // Secondary Gold
          black: '#31261D',    // Legacy Dark Brown/Black
          gray: '#F5F5F7',     // Background Gray
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',     // Standard Card Radius
        '2xl': '1rem',       // Large Containers
      }
    }
  }
}
```

---

## 3. Typography

**Font Family:** Inter (`sans-serif`)
**Weights:** 300 (Light), 400 (Regular), 600 (SemiBold), 700 (Bold)

### Hierarchy

*   **Display (H1):** `text-5xl` or `text-6xl`, Bold (`font-700`). Color: Heritage Blue.
*   **Heading (H2):** `text-4xl`, Bold. Color: Slate 900.
*   **Subheading (H3):** `text-2xl`, SemiBold. Color: Heritage Blue or Slate 800.
*   **Body Large:** `text-xl`, Regular. Color: Slate 700.
*   **Body:** `text-base`, Regular. Color: Slate 600.
*   **Meta/Label:** `text-xs` or `text-sm`, Uppercase `tracking-wider`. Color: Slate 400.

---

## 4. Component Styles

### Buttons

*   **Primary:**
    *   Background: Heritage Blue (`#002D72`)
    *   Text: White
    *   Radius: `rounded-lg`
    *   Hover: Darken 10% or `#001f52`
*   **Action (Apply/Visit):**
    *   Background: Carey Teal (`#007567`)
    *   Text: White
    *   Radius: `rounded-lg`
*   **Secondary/Ghost:**
    *   Background: Transparent or White
    *   Border: `border-2 border-jhu-heritage` (for outlined)
    *   Text: Heritage Blue

### Cards
*   **Background:** White (`#FFFFFF`)
*   **Border:** `1px solid #F1F5F9` (Slate 100)
*   **Shadow:** `shadow-sm` (Default), `shadow-md` (Hover)
*   **Radius:** `rounded-xl`
*   **Padding:** `p-6` or `p-8`

---

## 5. Data Visualization

When building charts (Recharts, Chart.js, D3), utilize the specific order of operations for coloring series data to maintain contrast and brand recognition.

**Series Order:**
1.  Heritage Blue (`#002D72`)
2.  Spirit Blue (`#68ACE5`)
3.  Carey Teal (`#007567`)
4.  Electric Lime (`#D0DA48`)
5.  Accent Alert (`#CF4520`)

**Gradient Fills:**
For area charts, use **Heritage Blue** as the stroke and **Spirit Blue** as the fill opacity (gradient from 30% to 0%).

---

## 6. Assets & Icons

*   **Icons:** Lucide React (Rounded, Stroke Width 2).
*   **Logos:** Ensure adequate clear space around the JHU Carey logo. Do not place the blue logo on the Heritage Blue background; use the white knock-out version instead.

---

## 7. Accessibility (A11y)

*   **Contrast:** Heritage Blue and Carey Teal are safe for white text. Spirit Blue and Electric Lime must use Dark Text (Heritage Blue or Slate 900) for legibility.
*   **Focus States:** Ensure all interactive elements have a visible focus ring (standard Tailwind blue focus ring is acceptable).

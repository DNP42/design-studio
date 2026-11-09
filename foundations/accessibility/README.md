# Accessibility checklist

Target: WCAG 2.2 AA, plus extra rules for users over 65 (weak sight, unsteady hands, less trust in apps).
Copy this list into every product PR. Tick each line, or write why it does not apply.

## Read
- [ ] No text is smaller than 18px. Body text is 20px. ([type](../type/README.md))
- [ ] `check-contrast.py` passes on the product tokens. ([colour](../colour/README.md))
- [ ] At 200% zoom, all text and controls are there and work.
- [ ] At 320px width, the page has no horizontal scroll (WCAG 1.4.10).
- [ ] With the browser font set to "Very large", nothing clips or overlaps.
- [ ] `<html lang>` matches the page language (`en`, `sl`). A text in another language has its own `lang`.
- [ ] No sentence in the UI has more than 20 words. Each button label is a verb and an object ("Download QR code", not "OK").

## Touch and click
- [ ] Each button, link and control is 44 × 44 CSS px or larger, with 8px or more between targets.
- [ ] No action needs a drag, a double tap, a long press or a gesture with two fingers. A single tap or click does it.
- [ ] No content shows only on hover. A tooltip also opens on focus and on tap.

## Keyboard and focus
- [ ] Every action works with the keyboard alone. The order follows the visual order. Focus is never trapped.
- [ ] The focus ring is visible on every control: 2px or more, `--color-focus`, never removed. Use `:focus-visible`.
- [ ] A sticky header or banner never hides the focused control (WCAG 2.4.11).
- [ ] A dialog moves focus into it, closes with Escape, and returns focus to the control that opened it.

## Forms and errors
- [ ] Every input has a visible label. A placeholder is not a label.
- [ ] An error shows as text next to its field, says how to fix it, and has an icon or word, not only colour.
- [ ] The app keeps what the user typed after an error, and never asks for the same data twice in one flow (WCAG 3.3.7).
- [ ] Sign-in needs no puzzle or memory test. Paste and password managers work (WCAG 3.3.8).
- [ ] An action that deletes or cannot be undone asks first, or offers Undo.

## Screen readers
- [ ] The page has one `h1`. Headings do not skip levels.
- [ ] The page has `header`, `main` and `footer` landmarks.
- [ ] Each image has `alt`. A decorative image has `alt=""` or `aria-hidden="true"`.
- [ ] A status change ("QR code ready", "Copied") is announced with `role="status"` or `aria-live="polite"`.
- [ ] An icon-only button has an accessible name. Better: show the text too.

## Time, motion and sound
- [ ] There is no time limit. Nothing advances by itself (no auto carousel, no auto redirect).
- [ ] With reduced motion on, nothing travels or scales. Only fades remain. ([motion](../motion/README.md))
- [ ] Sound is off by default, and a labelled mute toggle is visible. ([sound](../sound/README.md))

## Consistency
- [ ] Navigation, the language switch and the sound toggle are in the same place on every page.
- [ ] The same control has the same name and icon on every page.
- [ ] Help or contact, when the product has it, is in the same place on every page (WCAG 3.2.6).

## Test before you open the PR
- [ ] Lighthouse accessibility score is 100. This is necessary but not enough: Lighthouse does not test most WCAG 2.2 criteria, so do every manual check above. ([performance](../performance/README.md))
- [ ] Use the main task once with VoiceOver (macOS: Cmd+F5) and once with the keyboard only.
- [ ] Use the main task once on a phone at 320px width with reduced motion on.

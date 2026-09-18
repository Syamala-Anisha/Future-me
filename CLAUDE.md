# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

"Future Me" is a single-page, dependency-free web app for writing time-capsule messages to your future self. It is plain static HTML/CSS/JS — no build step, no package manager, no framework, no tests, and not a git repository.

## Running

Open `index.html` directly in a browser, or serve the folder for a more realistic environment:

```
python -m http.server 8000
```

There is nothing to build, lint, or test. Changes to `script.js`, `style.css`, or `index.html` take effect on browser reload.

## Architecture

Three files, loaded in this order by `index.html`: `style.css`, then `script.js` (deferred to end of `<body>`).

- **`script.js`** — the entire app, wrapped in one IIFE. All state lives in `localStorage` under two keys: `futureMe.messages` (JSON array of message objects) and `futureMe.theme` (`"light"` | `"dark"`). There is no in-memory store — every action (`addMessage`, `deleteMessage`) reads the array from storage, mutates it, writes it back, and calls `render()` to rebuild the DOM from scratch.

- **Message object shape**: `{ id, name, message, createdAt, unlockAt }`. `createdAt` and `unlockAt` are epoch-millisecond timestamps. `unlockAt` is local midnight of the chosen date (see `startOfDay`). A message is "unlocked" when `Date.now() >= unlockAt`; before that the body text is never inserted into the DOM.

- **Two-tier update loop**: `render()` does a full teardown/rebuild and is called only on data changes. A 1-second `setInterval(updateCountdowns, 1000)` does cheap in-place updates — it reads `data-unlockAt` / `data-createdAt` off each card element and updates only the countdown text and progress-bar width. When a card crosses its unlock time, `updateCountdowns` sets `needsRerender` and defers to a full `render()` so the sealed body gets injected with the reveal animation.

- **Cross-tab sync**: a `storage` event listener re-renders when `futureMe.messages` changes in another tab.

- **`style.css`** — all theming is CSS custom properties on `:root`, overridden by `[data-theme="dark"]`. `script.js` toggles the `data-theme` attribute on `<html>`. Adding a color means adding a variable in both blocks.

## Conventions

- The code is deliberately ES5-style (`var`, function expressions, no arrow functions or template literals). Match that style when editing `script.js`.
- All user text reaches the DOM via `textContent`, never `innerHTML`, to avoid injection. Keep it that way.
- Date validation requires the reveal date to be at least tomorrow (`unlockAt <= todayStart` is rejected); `setMinDate` also sets the `<input type=date>` `min` attribute.

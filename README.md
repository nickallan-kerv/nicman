# Nicman

A lightweight browser implementation of Nicman built with plain HTML, CSS, and JavaScript.

## Features

- Grid-based maze with pellets and power pellets
- Four ghosts with chase and random behavior
- Score, lives, and level progression
- Keyboard controls: Arrow keys or WASD
- Start and replay overlay

## Run

Open `index.html` in a browser.

If you want a local server, from this folder run:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Test Suite

Install dependencies:

```powershell
npm install
```

Run tests with coverage:

```powershell
npm test
```

Coverage thresholds are enforced at 80%+ for lines, statements, functions, and branches.

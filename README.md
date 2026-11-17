# halfway

A small website for two pen pals learning English together: one question a day, the other person's letter stays sealed until you've written yours, then you correct each other. Accepted fixes go into a notebook, and a quiz brings them back.

Made by Noah (France) for writing with Erin (China).

## Run it locally

```sh
npm install
npm run dev        # http://localhost:5174
```

To play both sides, open two tabs:

- http://localhost:5174/?as=noah
- http://localhost:5174/?as=erin

What one writes shows up in the other tab. "Fill with example letters" adds 8 days of fake letters so every screen has something in it.

## Customise

- `src/config.js`: names, time zones, day 1.
- `src/questions.js`: the daily questions, in order.

## Status

This is still a preview: letters are saved in the browser only (`src/store/local.js`). Next steps:

1. Pick a free online database that works from China, using the **Connection check** page (`#/check`).
2. Swap `src/store/local.js` for an online store with the same functions, plus a small sign-in.

No Google services (Firebase, Google Fonts): they're blocked in China. Fonts are bundled with the site.

Every push to `main` is published to GitHub Pages by `.github/workflows/deploy.yml`.

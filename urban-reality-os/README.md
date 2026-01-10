# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Gemini / AI backend (security note)

This project previously attempted to load `@google/generative-ai` in the browser which fails with Vite and exposes your API key to users. The safe approach is to run the Gemini SDK on a backend and call it from the frontend.

Quick setup:

1. Create and configure server env:

```bash
cd server
cp .env.example .env
# edit .env and set GEMINI_API_KEY
npm install
npm run start
```

2. Start the frontend from project root:

```bash
npm install
npm run dev
```

3. The frontend will POST to `http://localhost:3001/api/urban-analysis` via `src/utils/gemini.js`.

If you need a short-term dev-only hack instead, install `@google/generative-ai` in the frontend and exclude it from Vite optimization, but do NOT ship an API key to the browser.

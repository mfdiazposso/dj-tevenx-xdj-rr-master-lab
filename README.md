# XDJ-RR Master Lab — DJ Tevenx

App educativa FLX4 → XDJ-RR: mapa interactivo, lecciones N0/N1/N2, ejercicios, tests, simulador Web Audio, PWA.

## Stack
Vite 8 + React 19 + TS + Tailwind v4 + Zustand (persist `xdj-rr-lab-v1`) + Fuse.js + Web Audio + framer-motion + vite-plugin-pwa.

## Correr
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
npm run preview  # verifica PWA
```
Instalar PWA: Chrome → icono Install (requiere `npm run preview` o hosting HTTPS).

## Estructura
```
src/data/ controls(47) lessons(24) exercises(12) quizzes(20) missions(10) glossary(30)
src/store/progress.ts  src/hooks/useAudioEngine.ts
src/components/ MapaRR FichaControl dashboard/ lessons/ simulator/ study/ exercises/ quizzes/ glossary/
```

## Roadmap FLX4→RR
N0 standalone/USB/pantalla → N1 gain/cue/quantize → N2 deck/mixer/FX/browser → Misiones 01-10 → Set 30 min.

## Añadir un control
Edita `src/data/controls.ts` con `vsFLX4` obligatorio + enlaza su id en `lessons`/`exercises`/`quizzes`.

import { create } from 'zustand';

interface DailyState {
  streak: number;
  lastDay: string | null;
  xp: number;
  learnedTricks: string[];
  routineDone: string[]; // `${date}:${step}`
  mixes: number; // mezclas con track real (PLAY con buffer)
  visited: string[]; // controles visitados (+20 XP c/u)
  touchToday: () => void;
  learnTrick: (id: string) => void;
  toggleRoutine: (step: string) => void;
  visit: (id: string) => void;
  bumpMixes: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const useDaily = create<DailyState>()((set, get) => ({
  streak: Number(localStorage.getItem('rr-streak') || 0),
  lastDay: localStorage.getItem('rr-lastday'),
  xp: Number(localStorage.getItem('rr-xp') || 0),
  learnedTricks: JSON.parse(localStorage.getItem('rr-tricks') || '[]'),
  routineDone: JSON.parse(localStorage.getItem('rr-routine') || '[]'),
  mixes: Number(localStorage.getItem('rr-mixes') || 0),
  visited: JSON.parse(localStorage.getItem('rr-visited') || '[]'),
  touchToday: () => {
    const t = today();
    const { lastDay, streak } = get();
    if (lastDay === t) return;
    const ns = lastDay === yesterday() ? streak + 1 : 1;
    localStorage.setItem('rr-streak', String(ns));
    localStorage.setItem('rr-lastday', t);
    set({ streak: ns, lastDay: t });
  },
  learnTrick: (id: string) => {
    if (get().learnedTricks.includes(id)) return;
    const lt = [...get().learnedTricks, id];
    const xp = get().xp + 50;
    localStorage.setItem('rr-tricks', JSON.stringify(lt));
    localStorage.setItem('rr-xp', String(xp));
    set({ learnedTricks: lt, xp });
    get().touchToday();
  },
  toggleRoutine: (step: string) => {
    const k = `${today()}:${step}`;
    const has = get().routineDone.includes(k);
    const next = has ? get().routineDone.filter((x) => x !== k) : [...get().routineDone, k];
    localStorage.setItem('rr-routine', JSON.stringify(next));
    set({ routineDone: next });
    if (!has) get().touchToday();
  },
  visit: (id: string) => {
    if (get().visited.includes(id)) return;
    const visited = [...get().visited, id];
    const xp = get().xp + 20;
    localStorage.setItem('rr-visited', JSON.stringify(visited));
    localStorage.setItem('rr-xp', String(xp));
    set({ visited, xp });
    get().touchToday();
  },
  bumpMixes: () => {
    const mixes = get().mixes + 1;
    localStorage.setItem('rr-mixes', String(mixes));
    set({ mixes });
    get().touchToday();
  },
}));

export const dayIndex = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 864e5);
};

export const CHALLENGES = [
  'Hoy: 5 mezclas con solo TRIM y FILTER, sin tocar EQ',
  'Hoy: 10 disparos de HOT CUE clavados en el 1',
  'Hoy: beatmatch 3 temas sin SYNC',
  'Hoy: 1 transición con ECHO + 1 con FILTER',
  'Hoy: arma tu TAG LIST de 10 y mezcla solo con ella',
  'Hoy: practica SLIP + HOT CUE 5 veces sin fallar',
  'Hoy: set de 10 min grabado con 3 técnicas distintas',
];

export const ROUTINE = ['Warmup: gain staging 2 min', 'Técnica: 1 truco oculto', 'Práctica: 2 tracks subidos', 'Clip: graba 15 s'];

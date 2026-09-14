import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgressState {
  done: string[];
  favs: string[];
  rrMode: boolean;
  completedLessons: string[];
  completedMissions: string[];
  completedExercises: string[];
  quizResults: { id: string; score: number }[];
  lastLessonId: string | null;
  quizErrors: string[];
  toggleDone: (id: string) => void;
  toggleFav: (id: string) => void;
  setRrMode: (v: boolean) => void;
  completeLesson: (id: string, controlIds?: string[]) => void;
  completeMission: (id: string) => void;
  completeExercise: (id: string) => void;
  saveQuiz: (id: string, score: number) => void;
  saveExam: (score: number) => void;
  addQuizError: (controlId: string) => void;
  clearQuizError: (controlId: string) => void;
  examScore: number | null;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      done: [], favs: [], rrMode: false,
      completedLessons: [], completedMissions: [], completedExercises: [], quizResults: [], examScore: null,
      lastLessonId: null, quizErrors: [],
      toggleDone: (id) => set((s) => ({ done: s.done.includes(id) ? s.done.filter((d) => d !== id) : [...s.done, id] })),
      toggleFav: (id) => set((s) => ({ favs: s.favs.includes(id) ? s.favs.filter((d) => d !== id) : [...s.favs, id] })),
      setRrMode: (rrMode) => set({ rrMode }),
      completeLesson: (id, controlIds) => set((s) => ({
        completedLessons: s.completedLessons.includes(id) ? s.completedLessons : [...s.completedLessons, id],
        lastLessonId: id,
        done: controlIds ? Array.from(new Set([...s.done, ...controlIds])) : s.done,
      })),
      completeMission: (id) => set((s) => ({
        completedMissions: s.completedMissions.includes(id) ? s.completedMissions : [...s.completedMissions, id],
      })),
      completeExercise: (id) => set((s) => ({
        completedExercises: s.completedExercises.includes(id) ? s.completedExercises : [...s.completedExercises, id],
      })),
      saveQuiz: (id, score) => set((s) => ({ quizResults: [...s.quizResults.filter((q) => q.id !== id), { id, score }] })),
      saveExam: (score) => set({ examScore: score }),
      addQuizError: (controlId) => set((s) => (s.quizErrors.includes(controlId) ? s : { quizErrors: [...s.quizErrors, controlId] })),
      clearQuizError: (controlId) => set((s) => ({ quizErrors: s.quizErrors.filter((q) => q !== controlId) })),
    }),
    { name: 'xdj-rr-lab-v1' }
  )
);

export function levelLabel(pct: number): string {
  if (pct < 30) return 'PRINCIPIANTE';
  if (pct < 60) return 'INTERMEDIO';
  if (pct < 90) return 'AVANZADO';
  return 'MASTER';
}

// Desbloqueo examen: 24 lecciones base (N0+N1+N2) + 12 ejercicios base
export const EXAM_BASE_LESSONS = 24;
export const EXAM_BASE_EXERCISES = 12;
export function examFinalUnlocked(completedLessons: string[], completedExercises: string[]): boolean {
  return completedLessons.length >= EXAM_BASE_LESSONS && completedExercises.length >= EXAM_BASE_EXERCISES;
}

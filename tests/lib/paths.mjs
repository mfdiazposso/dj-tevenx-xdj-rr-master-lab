// Rutas robustas: los tests se ejecutan desde cualquier CWD.
import path from 'path';
import { fileURLToPath } from 'url';
export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
export const WAV = path.join(FIXTURES, 'test-128bpm.wav');
export const SHOTS = path.join(ROOT, 'audit-shots');
export const CHROME = `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1169\\chrome-win\\chrome.exe`;
export const URL_APP = 'http://localhost:4173/';

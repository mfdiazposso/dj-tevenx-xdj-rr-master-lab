export interface Mission {
  id: string; n: number; title: string; difficulty: 'Fácil' | 'Media' | 'Pro';
  objective: string; instructions: string; controlIds: string[]; checkSteps: string[];
}

export const missions: Mission[] = [
  { id: 'm01', n: 1, title: 'Carga tu primera pista desde USB', difficulty: 'Fácil', objective: 'Cargar un track en Deck 1 desde USB1.', instructions: 'Inserta USB analizado, navega con BROWSE y pulsa LOAD 1.', controlIds: ['usb', 'browse', 'load1'], checkSteps: ['USB reconocido en pantalla', 'Track cargado y waveform visible', 'STOP solo al expulsar'] },
  { id: 'm02', n: 2, title: 'Encuentra el BPM en pantalla', difficulty: 'Fácil', objective: 'Leer BPM/key de 3 tracks sin laptop.', instructions: 'Usa INFO + pantalla 7" y anota BPM/key.', controlIds: ['screen', 'info'], checkSteps: ['3 BPM anotados', 'Fase identificada'] },
  { id: 'm03', n: 3, title: 'Ajusta un TRIM saludable', difficulty: 'Fácil', objective: 'Igualar 2 temas a 0dB sin clipping.', instructions: 'TRIM hasta picos verdes + 1 ámbar, MASTER fijo.', controlIds: ['trim', 'masterlevel'], checkSteps: ['Sin rojos en vúmetro', 'MASTER sin tocar'] },
  { id: 'm04', n: 4, title: 'Prepara un CUE perfecto', difficulty: 'Fácil', objective: 'Marcar el "1" de la frase entrante.', instructions: 'Pausa, ajusta con jog, pulsa CUE, preview manteniendo.', controlIds: ['cue', 'jog', 'chcue', 'hpmix'], checkSteps: ['CUE en el kick 1', 'Preview limpio en phones'] },
  { id: 'm05', n: 5, title: 'Dispara tus HOT CUE', difficulty: 'Media', objective: 'Grabar intro/verso/drop y saltar a tiempo.', instructions: 'Con QUANTIZE ON graba A/B/C y salta en frase.', controlIds: ['hotcue', 'quantize'], checkSteps: ['3 hot cues grabados', 'Saltos en frase'] },
  { id: 'm06', n: 6, title: 'Domina el BEAT LOOP', difficulty: 'Media', objective: 'Alargar outro 16 compases con loop de 4.', instructions: 'BEAT LOOP + 1/2X-2X + RELOOP/EXIT limpio.', controlIds: ['beatloop', 'loophalfdouble', 'reloop'], checkSteps: ['Loop estable 16 compases', 'Salida en frase'] },
  { id: 'm07', n: 7, title: 'Tempo + MASTER TEMPO', difficulty: 'Media', objective: 'Igualar 124→126 BPM manteniendo key.', instructions: 'MT ON, TEMPO RANGE ±8, ajusta de oído.', controlIds: ['tempo', 'mastertempo', 'temporange'], checkSteps: ['BPM igualados', 'Tono preservado'] },
  { id: 'm08', n: 8, title: 'Sincroniza SIN SYNC', difficulty: 'Pro', objective: 'Beatmatch 100% manual con jog + tempo.', instructions: 'SYNC OFF, solo borde del jog y TEMPO.', controlIds: ['tempo', 'jog', 'sync'], checkSteps: ['60s mezclados sin deriva', 'Sin mirar SYNC'] },
  { id: 'm09', n: 9, title: 'Transición EQ + FILTER/COLOR', difficulty: 'Pro', objective: 'Transición de 32 beats solo con EQ y FILTER.', instructions: 'LOWs intercambiados + HPF de salida. Crossfader al centro.', controlIds: ['hi', 'colorfilter', 'colorselect', 'chfader'], checkSteps: ['Sin doble LOW', 'Salida limpia con FILTER'] },
  { id: 'm10', n: 10, title: 'Transición con BEAT FX ECHO', difficulty: 'Pro', objective: 'Salida con ECHO: CH SELECT + LEVEL/DEPTH a tiempo.', instructions: 'ECHO 1/2 en CH, abre LEVEL, ON en el "1", cierra.', controlIds: ['beatfxselect', 'beatch', 'fxlevel', 'fxon', 'beatbuttons'], checkSteps: ['FX al canal correcto', 'ON/OFF en frase', 'LEVEL sin embarrar'] },
];

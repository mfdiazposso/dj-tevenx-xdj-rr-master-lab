// Auditoría QA del mapa: detecta botones que no responden al tap.
// Causas: z-index/cobertura, touch-action, type, hit-area, AudioContext (N/A en mapa).
export interface QAFail {
  id: string;
  name: string;
  causes: string[];
}

export function auditMapControls(root: HTMLElement): QAFail[] {
  const fails: QAFail[] = [];
  const btns = root.querySelectorAll<HTMLButtonElement>('[data-control-id]');
  btns.forEach((b) => {
    const causes: string[] = [];
    if (b.getAttribute('type') !== 'button') causes.push('sin type="button"');
    const cs = getComputedStyle(b);
    if (cs.touchAction === 'auto') causes.push('touch-action:auto → delay 300ms / tap fantasma en touch');
    if (cs.pointerEvents === 'none') causes.push('pointer-events:none');
    const r = b.getBoundingClientRect();
    if (r.width > 0 && (r.height < 40 || r.width < 40))
      causes.push(`hit-area ${Math.round(r.width)}x${Math.round(r.height)} < 44px`);
    try {
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (el && el !== b && !b.contains(el))
        causes.push(`tap robado por <${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}> (z-index/cobertura)`);
    } catch { /* noop */ }
    if (causes.length) fails.push({ id: b.dataset.controlId || '?', name: b.getAttribute('aria-label') || '?', causes });
  });
  return fails;
}

export function logQAReport(fails: QAFail[], total: number) {
  // eslint-disable-next-line no-console
  console.group('%cQA MAPA XDJ-RR — diagnóstico', 'color:#ff6b00;font-weight:bold');
  // eslint-disable-next-line no-console
  console.log(`Controles: ${total} · OK: ${total - fails.length} · FAIL: ${fails.length} (rojo = sin ✓)`);
  if (fails.length) {
    // eslint-disable-next-line no-console
    console.table(fails.map((f) => ({ control: f.id, causa: f.causes.join(' | ') })));
  } else {
    // eslint-disable-next-line no-console
    console.log('%cTodo OK: sin fallas de z-index / touch-action / type / hit-area. AudioContext: N/A en mapa (solo Simulator).', 'color:#22c55e');
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

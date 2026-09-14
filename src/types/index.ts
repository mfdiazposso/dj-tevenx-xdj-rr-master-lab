export type Zone = 'deck' | 'mixer' | 'fx' | 'browser' | 'screen';
export type Level = 0 | 1 | 2 | 3;

export interface Control {
  id: string;
  name: string;
  zone: Zone;
  deck?: 'L' | 'R' | 'both';
  kind: 'encoder' | 'button' | 'knob' | 'fader' | 'jog' | 'display' | 'port';
  shortTip: string;
  level: Level;
  vsFLX4: string;
  what: string;
  does: string;
  audioTech: string;
  whenUse: string;
  whenNot: string;
  steps: string[];
  exercise: string;
  mistake: string;
  relatedIds: string[];
  source: 'manual' | 'flx4-diff' | 'verificar';
}

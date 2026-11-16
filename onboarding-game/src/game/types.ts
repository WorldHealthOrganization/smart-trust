import type { Leg, ParcelKind, PlaceId } from '../world/World';

export type Role = 'business' | 'keymaster' | 'legal' | 'technical' | 'who';
export type Phase = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Doc {
  kind: 'letter' | 'email' | 'key' | 'cert' | 'terminal' | 'note' | 'dashboard';
  title: string;
  /** for 'dashboard': "label|days left" per certificate */
  lines: string[];
  /** indexes of lines to highlight */
  mark?: number[];
}

export interface Travel {
  legs: Leg[];
  label: string;
  kind: ParcelKind;
}

/** What happens when a choice is wrong, either at once or later (delayed via a flag). */
export interface Consequence {
  title: string;
  by: string;        // who sends it back, e.g. "WHO Secretariat"
  steps: string[];   // smart-trust business-process task refs, `<stem>#<task id>` or `page:<IG page>` (see refs.ts)
  what: string;      // what happened
  why: string;       // the rule behind it
  days: number;      // illustrative game days lost
  travel?: Travel;   // played as a bounce (out and back, in red)
  bot?: boolean;     // tng-bot shows its problem face
}

export interface Choice {
  id: string;
  text: string;
  correct?: boolean;
  /** A wrong choice that looks fine now and fails later, when a check reads this flag. */
  flag?: string;
  consequence?: Consequence;
}

export interface ChecklistItem {
  text: string;
  required: boolean;
  why?: string; // shown when a wrong item is included
  domain?: string; // a trust-domain choice: its short code. Never wrong, never missing; see minDomains
}

export interface DelayedCheck {
  flag: string;
  consequence: Consequence;
  fix: string; // what the team does to put it right
}

export interface Moment {
  id: string;
  phase: Phase;
  title: string;
  steps: string[];   // see Consequence.steps
  place: Exclude<PlaceId, never>;
  role: Role;
  brief: string;
  docs?: Doc[];
  prompt: string;
  type: 'choice' | 'checklist' | 'watch';
  choices?: Choice[];
  checklist?: {
    items: ChecklistItem[];
    consequence: Consequence;
    note?: string;       // small print under the list
    button?: string;     // label of the submit button
    minDomains?: number; // at least this many domain items must be ticked; the ticked ones become the run's domains
  };
  /** Checks run after this moment succeeds, for flags set earlier. */
  checks?: DelayedCheck[];
  success: {
    travel?: Travel[];
    note: string;
    effect?: 'bot-collect' | 'prod-open' | 'live';
  };
  days: number;  // illustrative game days for the ideal path
  learn: string; // the takeaway line used in the debrief
}

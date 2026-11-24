export type Status = 'todo' | 'doing' | 'review' | 'done';
export type Urgency = 'low' | 'normal' | 'high' | 'urgent';
export type QuestionType = 'yesno' | 'number' | 'text' | 'choice';
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: string[];
  answer: string | null;
  line: number;
  /** A required question blocks the spec until answered. Written `(optional yesno)` in the file; required when unmarked. */
  required: boolean;
  /** From a trailing `(recommended: ...)` on the question line, which is removed from `text`. */
  recommendation: string | null;
}
export interface Subtask { n: number; title: string; done: boolean; line: number; hasLog: boolean }
/**
 * A person-only check in `## To review`. `n` is its 1-based position in the section; `line` is the 0-based line of the
 * checkbox. `steps` are its `> step:` lines in order (How to check), `failed` the person's reason from the board's Fail
 * button, `fixed` Claude's history of fixes for it.
 */
export interface ReviewItem { n: number; text: string; expected: string | null; steps: string[]; failed: string | null; fixed: string[]; group: string | null; done: boolean; line: number }
export interface SpecMeta { id: string; title: string; status: Status; urgency: Urgency; categories: string[]; dependsOn: string[]; draft: boolean; milestone: string | null; currentSubtask: number | null; created: string | null; updated: string | null; needsRefresh: string | null }
export interface SpecDoc extends SpecMeta { specMd: string; featuresMd: string; questions: Question[]; subtasks: Subtask[]; reviews: ReviewItem[]; problems: string[] }

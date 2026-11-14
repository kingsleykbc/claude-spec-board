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
export interface SpecMeta { id: string; title: string; status: Status; urgency: Urgency; categories: string[]; dependsOn: string[]; draft: boolean; milestone: string | null; currentSubtask: number | null; created: string | null; updated: string | null }
export interface SpecDoc extends SpecMeta { specMd: string; featuresMd: string; questions: Question[]; subtasks: Subtask[]; problems: string[] }

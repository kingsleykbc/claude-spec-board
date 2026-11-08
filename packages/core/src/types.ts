export type Status = 'todo' | 'doing' | 'review' | 'done';
export type Urgency = 'low' | 'normal' | 'high' | 'urgent';
export type QuestionType = 'yesno' | 'number' | 'text' | 'choice';
export interface Question { id: string; type: QuestionType; text: string; options: string[]; answer: string | null; line: number }
export interface Subtask { n: number; title: string; done: boolean; line: number; hasLog: boolean }
export interface SpecMeta { id: string; title: string; status: Status; urgency: Urgency; categories: string[]; dependsOn: string[]; draft: boolean; currentSubtask: number | null; created: string | null; updated: string | null }
export interface SpecDoc extends SpecMeta { specMd: string; featuresMd: string; questions: Question[]; subtasks: Subtask[]; problems: string[] }

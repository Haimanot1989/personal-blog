export const topics = [
  'software-architecture',
  'software-design',
  'computer-science',
  'ai-developer-tools',
  'frontend-engineering',
  'learning-cognition',
  'engineering-leadership',
] as const;

export type Topic = (typeof topics)[number];

export const formats = ['learning-note', 'reflection', 'practice-report', 'review'] as const;
export type Format = (typeof formats)[number];

export const sourceTypes = ['book', 'course', 'video', 'podcast', 'article'] as const;

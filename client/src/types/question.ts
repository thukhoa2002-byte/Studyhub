export interface Question {
  id: string;

  question: string;

  answer: string;

  category: string;

  importance: number;

  remembered: boolean;

  bookmarked: boolean;

  revealed: boolean;
}
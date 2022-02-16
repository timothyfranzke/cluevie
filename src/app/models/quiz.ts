export interface Quiz {
  quizId: string;
  title: string;
  image: string;
  year: string;
  genre: string;
  answerId: string;
}

export interface Clue {
  clueId: string;
  quizId: string;
  index: number;
  name: string;
  avatar: string;
}

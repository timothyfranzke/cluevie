export interface Quiz {
  id: string;
  cluevieQuizId: string;
  movieId: string;
  title: string;
  image: string;
  year: string;
  genre: string;
  answerId: string;
  clues: Clue[];
}

export interface Clue {
  clueId: string;
  quizId: string;
  index: number;
  name: string;
  avatar: string;
}

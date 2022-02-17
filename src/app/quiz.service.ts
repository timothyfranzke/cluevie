import {Injectable} from '@angular/core';
import {Clue, Quiz} from "./models/quiz";
import {Guess, Outcome, Point, Result, Style} from "./models/results";
import {BehaviorSubject, Observable} from "rxjs";
import {Movie} from "./models/movie";
import {AngularFirestore} from "@angular/fire/compat/firestore";
import {map} from "rxjs/operators";
import {State} from "./models/state";

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private _resultSubject: BehaviorSubject<Result> = new BehaviorSubject({} as Result);
  private _clueSubject: BehaviorSubject<Clue[]> = new BehaviorSubject({} as Clue[]);
  private _quizSubject: BehaviorSubject<Quiz> = new BehaviorSubject({} as Quiz);
  private _searchResultsSubject: BehaviorSubject<Movie[]> = new BehaviorSubject({} as Movie[]);
  private _result: Result = {} as Result;
  private _quiz: Quiz = {
    quizId: 'abc123',
    year: '1985',
    genre: 'Adventure Comedy',
    answerId: 'tt0088763',
    title: 'Back to the Future',
    image: 'https://m.media-amazon.com/images/M/MV5BZmU0M2Y1OGUtZjIxNi00ZjBkLTg1MjgtOWIyNThiZWIwYjRiXkEyXkFqcGdeQXVyMTQxNzMzNDI@._V1_FMjpg_UX1218_.jpg'
  } as Quiz;
  private _clues: Clue[] = [
    { quizId: 'abc123', name: 'Claudia Wells', avatar: 'https://m.media-amazon.com/images/M/MV5BMTcxMjM2NTI4NV5BMl5BanBnXkFtZTYwMTg5Mjky._V1_QL75_UY140_CR17,0,140,140_.jpg', clueId: '', index: 0} as Clue,
    { quizId: 'abc123', name: 'Tom Wilson', avatar: 'https://m.media-amazon.com/images/M/MV5BMTM3MzM4ODM4M15BMl5BanBnXkFtZTYwMDU1Mzky._V1_QL75_UX140_CR0,0,140,140_.jpg', clueId: '', index: 1} as Clue,
    { quizId: 'abc123', name: 'Crispin Glover', avatar: 'https://m.media-amazon.com/images/M/MV5BNjNjMzg2YWEtOTY4Ny00MDJiLTg1NWYtOGI5NmU2ZTE5OTI4XkEyXkFqcGdeQXVyMjQwMDg0Ng@@._V1_QL75_UX140_CR0,1,140,140_.jpg', clueId: '', index: 2} as Clue,
    { quizId: 'abc123', name: 'Lea Thompson', avatar: 'https://m.media-amazon.com/images/M/MV5BZjgzNmViYTktMjhjNy00NDc1LWI2MjMtNGUxYmFlZTNhODViXkEyXkFqcGdeQXVyMjA3MjIzMDA@._V1_QL75_UX140_CR0,12,140,140_.jpg', clueId: '', index: 3} as Clue,
    { quizId: 'abc123', name: 'Christopher Llyod', avatar: 'https://m.media-amazon.com/images/M/MV5BMTkxNzQ0ODgxOV5BMl5BanBnXkFtZTcwMTAxMDY0Mg@@._V1_QL75_UX140_CR0,1,140,140_.jpg 140w, https://m.media-amazon.com/images/M/MV5BMTkxNzQ0ODgxOV5BMl5BanBnXkFtZTcwMTAxMDY0Mg@@._V1_QL75_UX210_CR0,2,210,210_.jpg 210w, https://m.media-amazon.com/images/M/MV5BMTkxNzQ0ODgxOV5BMl5BanBnXkFtZTcwMTAxMDY0Mg@@._V1_QL75_UX280_CR0,2,280,280_.jpg 280w', clueId: '', index: 4} as Clue,
    { quizId: 'abc123', name: 'Michael J Fox', avatar: 'https://m.media-amazon.com/images/M/MV5BMTcwNzM0MjE4NF5BMl5BanBnXkFtZTcwMDkxMzEwMw@@._V1_QL75_UX140_CR0,10,140,140_.jpg', clueId: '', index: 5} as Clue,
  ] as Clue[];
  private _visibleClues: Clue[] = [] as Clue[];
  constructor(
    private _angularFirestore: AngularFirestore
  ) {
    const resultString = localStorage.getItem('result');
    if (resultString) {
      this._result = JSON.parse(resultString);
      this._clueSubject.next(this._result.visibleClues);
    } else {
      this._result = {clueIndex: 0, score: 6} as Result;
      this._result.guesses = [];
      this._result.clues = [];
      this._result.points = [];
      this._result.visibleClues = [];
      this.save();
    }
  }
  searchSub() {
    return this._searchResultsSubject;
  }
  search(term: string): Observable<Movie[]> {
    return this._angularFirestore
      .collection(`movies`, ref => ref
        .orderBy("term")
        .startAt(term.toLowerCase())
        .endAt(term.toLowerCase()+"\uf8ff")
        .limit(10))
      .snapshotChanges()
      .pipe(
        map(movies => {
          return movies.map(a => {
            const data = a.payload.doc.data() as any;
            const id = a.payload.doc['id'];
            console.log('data', data);
            return {id: id, ...data} as Movie;
          })
        })
      )
  }
  getQuiz(): Quiz {
    return this._quiz;
  }
  getQuizSub(): Observable<Quiz> {
    this._quizSubject = new BehaviorSubject<Quiz>(this._quiz);

    return this._quizSubject;
  }
  getClue() {
    if (this._result.score == 0) return;
    const index = this._result.clueIndex;
    this._result.clueIndex++;
    const point = {
      style: Style.clue
    } as Point;
    this._result.score--;
    this._result.points.push(point);
    this._resultSubject.next(this._result);
    this._result.visibleClues.push(this._clues[index]);
    this._clueSubject.next(this._result.visibleClues);
    this.save();
  }
  getClueSub(): Observable<Clue[]> {
    this._clueSubject = new BehaviorSubject<Clue[]>(this._visibleClues);

    return this._clueSubject;
  }
  getResultSub(): Observable<Result> {
    this._resultSubject = new BehaviorSubject<Result>(this._result);

    return this._resultSubject;
  }
  getResult() {
    return this._result;
  }

  addPoint(style: Style) {
    const point = {
      style: style
    } as Point;
    this._result.score--;
    this._result.points.push(point);
    this._resultSubject.next(this._result);
  }

  makeGuess(movie: Movie) {
    if (this._result.score == 0) return;
    const guess = {
      id: movie.id,
      name: movie.name
    } as Guess;
    guess.correct = movie.id === this._quiz.answerId;
    if (guess.correct) {
      this._result.outcome = Outcome.win;
    }
    const point = {
      style: guess.correct ? Style.correct : Style.incorrect
    } as Point;
    this._result.score--;
    if (this._result.score == 0 && this._result.outcome != Outcome.win) {
      this._result.outcome = Outcome.lose;
    }
    this._result.guesses.push(guess);
    this._result.points.push(point);
    this._resultSubject.next(this._result);
    this.save();
  }

  load() {
    this._quizSubject.next(this._quiz);
    this._clueSubject.next(this._result.visibleClues);
    this._resultSubject.next(this._result);
  }

  getUserState(): State {
    let state = {} as State;
    const stateString = localStorage.getItem('state');
    if (stateString) {
      state = JSON.parse(stateString);
    } else {
      state.acceptRules = false;
      state.acceptClues = false;
    }

    return state;
  }

  saveAcceptRules() {
    const state = this.getUserState();
    state.acceptRules = true;
    localStorage.setItem('state', JSON.stringify(state));
  }

  saveAcceptClues() {
    const state = this.getUserState();
    state.acceptClues = true;
    localStorage.setItem('state', JSON.stringify(state));
  }

  private save() {
    localStorage.setItem('result', JSON.stringify(this._result));
  }
}

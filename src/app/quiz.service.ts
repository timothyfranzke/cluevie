import {Injectable} from '@angular/core';
import {Clue, Quiz} from "./models/quiz";
import {Guess, Outcome, Point, Result, Style} from "./models/results";
import {BehaviorSubject, Observable, of} from "rxjs";
import {Movie} from "./models/movie";
import {AngularFirestore} from "@angular/fire/compat/firestore";
import {map} from "rxjs/operators";
import {State} from "./models/state";
import {environment} from "../environments/environment";
import {differenceInCalendarDays} from 'date-fns';
import {HttpClient, HttpHeaders} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private _resultSubject: BehaviorSubject<Result> = new BehaviorSubject({} as Result);
  private _clueSubject: BehaviorSubject<Clue[]> = new BehaviorSubject({} as Clue[]);
  private _quizSubject: BehaviorSubject<Quiz> = new BehaviorSubject({} as Quiz);
  private _searchResultsSubject: BehaviorSubject<Movie[]> = new BehaviorSubject({} as Movie[]);
  private _result: Result = {} as Result;
  private _quiz: Quiz = {} as Quiz;
  private _movies: Movie[] = [] as Movie[];
  private _clues: Clue[] = [] as Clue[];
  private _state: State = {} as State;

  constructor(
    private _angularFirestore: AngularFirestore,
    private _httpClient: HttpClient
  ) {
    const resultString = localStorage.getItem('result');
    const stateString = localStorage.getItem('state');
    if (resultString) {
      this._result = JSON.parse(resultString);
      this._clueSubject.next(this._result.visibleClues);
    } else {
      this.resetResult();
    }
    if (stateString) {
      this._state = JSON.parse(stateString);
    } else {
      this._state = {} as State;
    }
    this.setState();
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' })
    this._httpClient.get(environment.movieListUrl, { headers })
      .subscribe((data) => {
        this._movies = data as Movie[];
        this._searchResultsSubject.next(this._movies);
      });

    this._angularFirestore.collection(environment.quizTable, ref => ref
      .where('date', '<=', new Date())
      .orderBy('date', 'desc')
      .limit(1)
    ).snapshotChanges()
      .pipe(
        map(quizzes => {
          return quizzes.map(a => {
            const data = a.payload.doc.data() as any;
            const id = a.payload.doc['id'];
            const quiz = {id: id, ...data} as Quiz;
            this._quiz = quiz;
            return quiz;
          })
        })
      ).subscribe(quizzes => {
        this._quiz = quizzes[0];
        if (this._result.quizId !== this._quiz.id) {
          this.resetResult();
        }
        this._clues = this._quiz.clues;
        this._quizSubject.next(this._quiz);
    })
  }
  searchSub() {
    return this._searchResultsSubject;
  }
  search(term: string): Observable<Movie[]>{
    if (!term || typeof term.toLowerCase !== 'function') {return of()}
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
            return {id: id, ...data} as Movie;
          })
        })
      )
  }

  getQuizSub(): Observable<Quiz> {
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
    this._result.visibleClues.push(this._clues[index]);
    if (this._result.visibleClues.length == this._clues.length) {
      this._result.noMoreClues = true;
    }
    this._resultSubject.next(this._result);
    this.save();
  }

  getResultSub(): Observable<Result> {
    return this._resultSubject;
  }
  getResult() {
    return this._result;
  }
  getMovies(): Observable<Movie[]> {
    return this._searchResultsSubject;
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
      this._result.completed = true;
      this._state.win ++;
      this._state.scores.push(this._result.points.length);
      this.saveResult();
    }
    const point = {
      style: guess.correct ? Style.correct : Style.incorrect
    } as Point;
    this._result.score--;
    if (this._result.score == 0 && this._result.outcome != Outcome.win) {
      this._result.outcome = Outcome.lose;
      this._result.completed = true;
      this.saveResult();
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

  private setState() {
    if (!this._state.streak) {
      this._state.streak = 1;
    }
    if (!this._state.lastVisit) {
      this._state.lastVisit = new Date();
    }
    if (!this._state.maxStreak) {
      this._state.maxStreak = 1;
    }
    if (!this._state.win) {
      this._state.win = 0;
    }
    if (!this._state.played) {
      this._state.played = 1;
    }
    if (!this._state.scores) {
      this._state.scores = [];
    }
    const today = new Date();
    const lastVisit = new Date(this._state.lastVisit);
    const diff = differenceInCalendarDays(today, lastVisit)
    if (diff >= 1) {
      this._state.played ++;
      this._state.streak ++;
      this._state.lastVisit = today;
    }
    if (this._state.streak > this._state.maxStreak) {
      this._state.maxStreak = this._state.streak;
    }
  }

  private saveResult(){
    this._result.completedOn = new Date();
    this._angularFirestore.collection('results')
      .add(this._result);
  }
  private resetResult() {
    this._result = {clueIndex: 0, score: 6} as Result;
    this._result.quizId = this._quiz.id;
    this._result.guesses = [];
    this._result.clues = [];
    this._result.points = [];
    this._result.visibleClues = [];
    this.save();
    this._resultSubject.next(this._result);
  }
  private save() {
    localStorage.setItem('result', JSON.stringify(this._result));
    localStorage.setItem('state', JSON.stringify(this._state));
  }
}

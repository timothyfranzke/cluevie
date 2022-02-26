import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl} from "@angular/forms";
import {Observable} from "rxjs";
import {Movie} from "../models/movie";
import {map, startWith} from "rxjs/operators";
import {QuizService} from "../quiz.service";
import {MatSnackBar, MatSnackBarConfig} from "@angular/material/snack-bar";

@Component({
  selector: 'movie-search',
  templateUrl: './movie-search.component.html',
  styleUrls: ['./movie-search.component.scss']
})
export class MovieSearchComponent implements OnInit {
  @Output() selected: EventEmitter<Movie> = new EventEmitter<Movie>();
  isButtonActive: boolean = false;
  myControl = new FormControl();
  movies: Movie[] = [] as Movie[];
  movie: Movie = {} as Movie;
  options: Movie[] = [
    {id: 'abc123', name: 'Jurassic Park'} as Movie,
    {id: 'xyz456', name: 'Back to the Future'} as Movie,
    {id: 'sdf234', name: 'Stand By Me'} as Movie
  ];
  filteredOptions: Observable<Movie[]> = new Observable<Movie[]>();
  constructor(
    private _quizService: QuizService,
    private _matSnackBar: MatSnackBar
  ) {

  }

  ngOnInit(): void {
    this.movies = [];
    this._quizService.getMovies().subscribe(movies => {
      if (!!movies) {
        this.movies = movies;
      } else {
        this.movies = [];
      }
    })
    this.filteredOptions = this.myControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value)),
    );
  }
  addValue(movie: Movie) {
    if (movie.id) {
      this.isButtonActive = true;
      this.movie = movie;
      this.myControl.setValue(this.movie.name);
    }
  }
  add() {
    if (this.movie.id) {
      this.isButtonActive = false;
      this.myControl.setValue('');
      this._quizService.makeGuess(this.movie);
      this.movie = {} as Movie;
    } else {
      this._matSnackBar.open('Hmm... We can\'t find that movie :( Please try again! (Pro tip: Use our autocomplete feature to get your spelling just right!)',
        '',
        {
          duration: 6500,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        } as MatSnackBarConfig)
    }
  }

  private _filter(value: string): Movie[] {
    if (!value ||
      value.length < 2 ||
      typeof value == 'object' ||
      !this.movies ||
      typeof this.movies.filter !== 'function') return[];

    const filterValue = value.toLowerCase();
    return this.movies.filter(option => option.term.includes(filterValue));
  }
}

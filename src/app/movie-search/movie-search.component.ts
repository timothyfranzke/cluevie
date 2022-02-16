import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl} from "@angular/forms";
import {Observable} from "rxjs";
import {Movie} from "../models/movie";
import {map, startWith} from "rxjs/operators";
import {QuizService} from "../quiz.service";

@Component({
  selector: 'movie-search',
  templateUrl: './movie-search.component.html',
  styleUrls: ['./movie-search.component.scss']
})
export class MovieSearchComponent implements OnInit {
  @Output() selected: EventEmitter<Movie> = new EventEmitter<Movie>();

  myControl = new FormControl();
  movie: Movie = {} as Movie;
  options: Movie[] = [
    {id: 'abc123', name: 'Jurassic Park'} as Movie,
    {id: 'xyz456', name: 'Back to the Future'} as Movie,
    {id: 'sdf234', name: 'Stand By Me'} as Movie
  ];
  filteredOptions: Observable<Movie[]> = new Observable<Movie[]>();
  searchedOptions: Observable<Movie[]> = new Observable<Movie[]>();
  constructor(
    private _quizService: QuizService
  ) { }

  ngOnInit(): void {
    this.myControl.valueChanges.subscribe(value => {
      this.filteredOptions = this._quizService.search(value);
    })
  }
  addValue(movie: Movie) {
    this.movie = movie;
    this.myControl.setValue(this.movie.name);
    console.log('this.movie', this.movie);
  }
  add() {
    console.log('this.movie', this.movie);
    this._quizService.makeGuess(this.movie);
  }
  private _filter(value: string): Movie[] {
    console.log('value', value);
    const filterValue = value.toLowerCase();

    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }
}

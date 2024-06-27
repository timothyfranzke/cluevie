import { Component, OnInit } from '@angular/core';
import {Guess, Result} from "../models/results";
import {QuizService} from "../quiz.service";
import {Movie} from "../models/movie";

@Component({
  selector: 'guess',
  templateUrl: './guess.component.html',
  styleUrls: ['./guess.component.scss']
})
export class GuessComponent implements OnInit {
  result: Result = {} as Result;
  searchResults: Movie[] = [];
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      })
  }

  ngOnInit(): void {
  }
}

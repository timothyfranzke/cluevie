import { Component, OnInit } from '@angular/core';
import {QuizService} from "../quiz.service";
import {Result} from "../models/results";

@Component({
  selector: 'score-counter',
  templateUrl: './score-counter.component.html',
  styleUrls: ['./score-counter.component.scss']
})
export class ScoreCounterComponent implements OnInit {
  result: Result = {} as Result;
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

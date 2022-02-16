import { Component, OnInit } from '@angular/core';
import {Result} from "../../models/results";
import {QuizService} from "../../quiz.service";

@Component({
  selector: 'app-loser',
  templateUrl: './loser.component.html',
  styleUrls: ['./loser.component.scss']
})
export class LoserComponent implements OnInit {
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

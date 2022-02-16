import { Component } from '@angular/core';
import {QuizService} from "./quiz.service";
import {Result} from "./models/results";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'cluvie';
  result: Result = {} as Result;
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      });
  }
}

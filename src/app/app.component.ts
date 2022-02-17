import { Component } from '@angular/core';
import {QuizService} from "./quiz.service";
import {Result} from "./models/results";
import {State} from "./models/state";
import {MatDialog} from "@angular/material/dialog";
import {IntroductionComponent} from "./dialogs/introduction/introduction.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'cluvie';
  result: Result = {} as Result;
  state: State = {} as State;
  constructor(
    private _quizService: QuizService,
    private _matDialog: MatDialog
  ) {
    this.state = this._quizService.getUserState();
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      });
    if (!this.state.acceptRules) {
      this._matDialog.open(IntroductionComponent)
        .afterClosed()
        .subscribe(result => {
          if (result[0]) {
            this._quizService.saveAcceptRules();
          }
        });
    }
    this._quizService.getQuizSub()
      .subscribe(quiz => {
        console.log(quiz)
      });
  }


  showRules() {
    this._matDialog.open(IntroductionComponent);
  }
}

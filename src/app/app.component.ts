import { Component } from '@angular/core';
import {QuizService} from "./quiz.service";
import {Result} from "./models/results";
import {State} from "./models/state";
import {MatDialog, MatDialogConfig} from "@angular/material/dialog";
import {IntroductionComponent} from "./dialogs/introduction/introduction.component";
import {WinnerComponent} from "./final-score/winner/winner.component";
import {LoserComponent} from "./final-score/loser/loser.component";
import {MatSnackBar, MatSnackBarConfig} from "@angular/material/snack-bar";

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
    private _matDialog: MatDialog,
    private _matSnackBar: MatSnackBar
  ) {
    this.state = this._quizService.getUserState();
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      });
    if (!this.state.acceptRules) {
      this._matDialog.open(IntroductionComponent, {
        width: '70%'
      } as MatDialogConfig)
        .afterClosed()
        .subscribe(result => {
          if (result[0]) {
            this._quizService.saveAcceptRules();
          }
        });
    }
  }

  showScore() {
    if (this.result.completed) {
      if (this.result.outcome == 0) {
        this._matDialog.open(WinnerComponent, {
          width: '60%',
          panelClass: 'dialog'
        } as MatDialogConfig);
      } else {
        this._matDialog.open(LoserComponent, {
          width: '60%',
          panelClass: 'dialog'
        } as MatDialogConfig);
      }
    } else {
      this._matSnackBar.open('No score to show for today.', '',{duration: 3000} as MatSnackBarConfig)
    }
  }
  showRules() {
    this._matDialog.open(IntroductionComponent, {
      width: '60%',
      panelClass: 'dialog'
    } as MatDialogConfig);
  }
}

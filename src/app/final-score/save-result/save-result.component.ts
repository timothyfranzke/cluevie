import {Component, OnInit} from '@angular/core';
import {Result, Style} from "../../models/results";
import {QuizService} from "../../quiz.service";
import {MatSnackBar, MatSnackBarConfig} from "@angular/material/snack-bar";

@Component({
  selector: 'save-result',
  templateUrl: './save-result.component.html',
  styleUrls: ['./save-result.component.scss']
})
export class SaveResultComponent implements OnInit {
  result: Result = {} as Result;
  constructor(
    private _quizService: QuizService,
    private _snackBar: MatSnackBar
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      })
  }

  ngOnInit(): void {
  }

  copy() {
    let resultText = '';
    this.result.points.forEach(point => {
      if (point.style == Style.incorrect) {
        resultText += '🔴 ';
      }
      if (point.style == Style.correct) {
        resultText += '🟢 ';
      }
      if (point.style == Style.clue) {
        resultText += '⚪ ';
      }
    });
    return 'Cluvie ' + (6 - this.result.score) + '/6 \n ' + resultText;
  }

  showToast() {
    this._snackBar.open('Copied score to clipboard','', {duration: 2000} as MatSnackBarConfig);
  }
}

import {Component, OnInit} from '@angular/core';
import {Result, Style} from "../../models/results";
import {QuizService} from "../../quiz.service";
import {MatSnackBar, MatSnackBarConfig} from "@angular/material/snack-bar";
import {Quiz} from "../../models/quiz";

@Component({
  selector: 'save-result',
  templateUrl: './save-result.component.html',
  styleUrls: ['./save-result.component.scss']
})
export class SaveResultComponent implements OnInit {
  result: Result = {} as Result;
  quiz: Quiz = {} as Quiz;
  canShare: boolean = false;

  constructor(
    private _quizService: QuizService,
    private _snackBar: MatSnackBar
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      });
    this._quizService.getQuizSub()
      .subscribe(quiz => {
        this.quiz = quiz;
      })
  }

  ngOnInit(): void {
    if (!!navigator.share) {
      this.canShare = true;
    }
  }

  copy() {
    return this.getCluevieText();
  }

  showToast() {
    this._snackBar.open('Copied score to clipboard','', {duration: 2000} as MatSnackBarConfig);
  }

  share() {
    navigator.share({
      text: this.getCluevieText(),
      url: 'https://cluevie.com',
      title: 'Cluevie Score'
    } as ShareData)
  }

  private getCluevieText() {
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
    return `Cluevie ${this.quiz.cluevieQuizId} ${6 - this.result.score}/6 \n\n ${resultText}`;
  }
}

import {Component, OnInit} from '@angular/core';
import {Outcome, Result} from "../models/results";
import {QuizService} from "../quiz.service";
import {MatDialog} from "@angular/material/dialog";
import {WinnerComponent} from "./winner/winner.component";
import {LoserComponent} from "./loser/loser.component";
import {Quiz} from "../models/quiz";

@Component({
  selector: 'final-score',
  templateUrl: './final-score.component.html',
  styleUrls: ['./final-score.component.scss']
})
export class FinalScoreComponent implements OnInit {
  result: Result = {} as Result;
  quiz: Quiz = {} as Quiz;
  constructor(
    private _quizService: QuizService,
    private _matDialog: MatDialog
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
        if (this.result.outcome == Outcome.win) {
          this._matDialog.open(WinnerComponent)
        } else if (this.result.outcome == Outcome.lose) {
          this._matDialog.open(LoserComponent)
        }
      });
    this._quizService.getQuizSub()
      .subscribe(
      quiz => {
        this.quiz = quiz;
      }
    )
  }

  ngOnInit(): void {
    this._quizService.load();
  }

}

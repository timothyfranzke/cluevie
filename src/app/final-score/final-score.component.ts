import {Component, OnInit} from '@angular/core';
import {Outcome, Result} from "../models/results";
import {QuizService} from "../quiz.service";
import {MatDialog, MatDialogConfig} from "@angular/material/dialog";
import {WinnerComponent} from "./winner/winner.component";
import {LoserComponent} from "./loser/loser.component";
import {Quiz} from "../models/quiz";
import {StatisticsComponent} from "../dialogs/statistics/statistics.component";

@Component({
  selector: 'final-score',
  templateUrl: './final-score.component.html',
  styleUrls: ['./final-score.component.scss']
})
export class FinalScoreComponent implements OnInit {
  result: Result = {} as Result;
  quiz: Quiz = {} as Quiz;
  isDialogOpen: boolean = false;
  constructor(
    private _quizService: QuizService,
    private _matDialog: MatDialog
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
        if (this.result.completed && !this.isDialogOpen) {
          this.isDialogOpen = true;
          this._matDialog.open(StatisticsComponent, {
            width: '60%'
          } as MatDialogConfig)
            .afterClosed()
            .subscribe(() => {this.isDialogOpen = false;})
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

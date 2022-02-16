import {Component, OnInit} from '@angular/core';
import {QuizService} from "../quiz.service";
import {Result, Style} from "../models/results";
import {Clue} from "../models/quiz";

@Component({
  selector: 'clues',
  templateUrl: './hints.component.html',
  styleUrls: ['./hints.component.scss']
})
export class HintsComponent implements OnInit {
  result: Result = {} as Result;
  clues: Clue[] = [];
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      });
    this._quizService.getClueSub()
      .subscribe(clues => {
        this.clues = clues;
      })
  }

  ngOnInit(): void {
  }

  nextClue() {
    this._quizService.getClue();
  }
}

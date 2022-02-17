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
  revealedClue: Clue = {} as Clue;
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
        this.clues = [];
        for(let i = 0; i < result.visibleClues.length; i++) {
          if (i == 0) {
            this.revealedClue = result.visibleClues[i];
          } else {
            this.clues.push(result.visibleClues[i]);
          }
        }
      });
  }

  ngOnInit(): void {
  }

  nextClue() {
    this._quizService.getClue();
  }
}

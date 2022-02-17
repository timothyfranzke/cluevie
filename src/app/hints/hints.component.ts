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
  cluesLoaded: boolean = false;
  revealedClue: Clue = {} as Clue;
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
        if (!this.clues || this.clues.length == 0 && result.visibleClues && !this.cluesLoaded) {
          result.visibleClues.forEach((clue) => {
            this.clues.push(clue);
          });
          this.cluesLoaded = true;
        }
      });
  }

  ngOnInit(): void {
  }

  addClue(clue: Clue) {
    this.clues.push(clue);
  }
}

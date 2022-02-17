import { Component, OnInit } from '@angular/core';
import {QuizService} from "../quiz.service";
import {Result} from "../models/results";
import {State} from "../models/state";
import {MatDialog} from "@angular/material/dialog";
import {ClueExplainationComponent} from "../dialogs/clue-explaination/clue-explaination.component";

@Component({
  selector: 'reveal-button',
  templateUrl: './reveal-button.component.html',
  styleUrls: ['./reveal-button.component.scss']
})
export class RevealButtonComponent implements OnInit {
  result: Result = {} as Result;
  state: State = {} as State;
  constructor(
    private _quizService: QuizService,
    private _matDialog: MatDialog
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      })
    this.state = this._quizService.getUserState();
  }

  ngOnInit(): void {
  }

  nextClue() {
    if (this.result.visibleClues.length == 0 && !this.state.acceptClues) {
      this._matDialog.open(ClueExplainationComponent)
        .afterClosed()
        .subscribe(result => {
          if (result[0]) {
            this._quizService.getClue();
            this._quizService.saveAcceptClues();
          }
        });
    } else {
      this._quizService.getClue();
    }
  }
}

import {Component, OnInit, Output, EventEmitter} from '@angular/core';
import {QuizService} from "../quiz.service";
import {Result} from "../models/results";
import {State} from "../models/state";
import {MatDialog} from "@angular/material/dialog";
import {ClueExplainationComponent} from "../dialogs/clue-explaination/clue-explaination.component";
import {Clue} from "../models/quiz";

@Component({
  selector: 'reveal-button',
  templateUrl: './reveal-button.component.html',
  styleUrls: ['./reveal-button.component.scss']
})
export class RevealButtonComponent implements OnInit {
  @Output() clueRevealed: EventEmitter<Clue> = new EventEmitter<Clue>();
  showClue: boolean = false;
  result: Result = {} as Result;
  state: State = {} as State;
  revealedClue: Clue = {} as Clue;
  constructor(
    private _quizService: QuizService,
    private _matDialog: MatDialog
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
        if (result.visibleClues && this.result.visibleClues.length >0) {
          this.revealedClue = result.visibleClues[result.visibleClues.length -1];
        }
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
            this.getClue();
            this._quizService.saveAcceptClues();
          }
        });
    } else {
      this.getClue();
    }
  }

  getClue() {
    this._quizService.getClue();
    this.showClue = true;
    setTimeout(() => {
      this.clueRevealed.emit(this.revealedClue);
      this.revealedClue = {} as Clue;
      this.showClue = false;
    }, 3000);
  }
}

import { Component, OnInit } from '@angular/core';
import {Result} from "../../models/results";
import {QuizService} from "../../quiz.service";
import {MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-winner',
  templateUrl: './winner.component.html',
  styleUrls: ['./winner.component.scss']
})
export class WinnerComponent implements OnInit {
  result: Result = {} as Result;
  constructor(
    private _quizService: QuizService,
    private _matDialogRef: MatDialogRef<WinnerComponent>
  ) {
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      })
  }

  ngOnInit(): void {
  }

  ok() {
    this._matDialogRef.close();
  }
}

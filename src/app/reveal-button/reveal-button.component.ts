import { Component, OnInit } from '@angular/core';
import {QuizService} from "../quiz.service";

@Component({
  selector: 'reveal-button',
  templateUrl: './reveal-button.component.html',
  styleUrls: ['./reveal-button.component.scss']
})
export class RevealButtonComponent implements OnInit {

  constructor(
    private _quizService: QuizService
  ) { }

  ngOnInit(): void {
  }

  nextClue() {
    this._quizService.getClue();
  }
}

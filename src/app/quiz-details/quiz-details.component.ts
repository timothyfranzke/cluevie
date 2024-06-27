import { Component, OnInit } from '@angular/core';
import {QuizService} from "../quiz.service";
import {Quiz} from "../models/quiz";

@Component({
  selector: 'quiz-details',
  templateUrl: './quiz-details.component.html',
  styleUrls: ['./quiz-details.component.scss']
})
export class QuizDetailsComponent implements OnInit {
  quiz: Quiz = {} as Quiz;
  constructor(
    private _quizService: QuizService
  ) {
    this._quizService.getQuizSub()
      .subscribe(quiz => {
        this.quiz = quiz;
      })
  }

  ngOnInit(): void {
    this._quizService.load();
  }
}

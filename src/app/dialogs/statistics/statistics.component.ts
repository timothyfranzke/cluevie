import { Component, OnInit } from '@angular/core';
import {QuizService} from "../../quiz.service";
import {Quiz} from "../../models/quiz";
import {State} from "../../models/state";

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  state: State = {} as State;
  constructor(
    private _quizService: QuizService
  ) {
    this.state = this._quizService.getUserState();
  }

  ngOnInit(): void {
  }

  private calculate() {
    const ones = this.state.scores.filter(i => i == 1).length;
    const twos = this.state.scores.filter(i => i == 2).length;
    const three = this.state.scores.filter(i => i == 3).length;
    const four = this.state.scores.filter(i => i == 4).length;
    const five = this.state.scores.filter(i => i == 5).length;
    const six = this.state.scores.filter(i => i == 6).length;
  }
}

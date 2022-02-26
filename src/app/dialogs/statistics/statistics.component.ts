import { Component, OnInit } from '@angular/core';
import {QuizService} from "../../quiz.service";
import {Quiz} from "../../models/quiz";
import {State, Win} from "../../models/state";

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  state: State = {} as State;
  one: Win = {} as Win;
  two: Win = {} as Win;
  three: Win = {} as Win;
  four: Win = {} as Win;
  five: Win = {} as Win;
  six: Win = {} as Win;

  constructor(
    private _quizService: QuizService
  ) {
    this.state = this._quizService.getUserState();
    this.calculate();
  }

  ngOnInit(): void {
  }

  private calculate() {
    let ones = this.state.scores.filter(i => i == 0).length;
    let twos = this.state.scores.filter(i => i == 1).length;
    let three = this.state.scores.filter(i => i == 2).length;
    let four = this.state.scores.filter(i => i == 3).length;
    let five = this.state.scores.filter(i => i == 4).length;
    let six = this.state.scores.filter(i => i == 5).length;

    const max = Math.max.apply(null, [ones, twos, three, four, five, six]);

    this.one.total = ones;
    this.two.total = twos;
    this.three.total = three;
    this.four.total = four;
    this.five.total = five;
    this.six.total = six;

    this.one.percentage = ones == max ? 100 : ones/max * 100;
    this.two.percentage = twos == max ? 100 : twos/max * 100;
    this.three.percentage = three == max ? 100 : three/max * 100;
    this.four.percentage = four == max ? 100 : four/max * 100;
    this.five.percentage = five == max ? 100 : five/max * 100;
    this.six.percentage = six == max ? 100 : six/max * 100;

    console.log(this.one);
    console.log(this.two);
    console.log(this.three);
    console.log(this.four);
    console.log(this.five);
    console.log(this.six);
  }
}

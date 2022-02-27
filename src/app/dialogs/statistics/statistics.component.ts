import {Component, OnDestroy, OnInit} from '@angular/core';
import {QuizService} from "../../quiz.service";
import {Quiz} from "../../models/quiz";
import {State, Win} from "../../models/state";
import {startOfToday, startOfTomorrow} from 'date-fns'
import {MatDialogRef} from "@angular/material/dialog";
import {Result} from "../../models/results";

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit, OnDestroy {
  clock: string = '';
  state: State = {} as State;
  result: Result = {} as Result;
  one: Win = {} as Win;
  two: Win = {} as Win;
  three: Win = {} as Win;
  four: Win = {} as Win;
  five: Win = {} as Win;
  six: Win = {} as Win;
  private interval: any;

  constructor(
    private _quizService: QuizService,
    private _matDialogRef: MatDialogRef<StatisticsComponent>
  ) {
    this.state = this._quizService.getUserState();
    this._quizService.getResultSub()
      .subscribe(result => {
        this.result = result;
      })
    this.calculate();
  }

  ngOnInit(): void {
    this.startClock()
  }

  startClock() {
    const countDownDate = startOfTomorrow().getTime();
    this.interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = countDownDate - now;
      let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString();
      let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString();
      let seconds = Math.floor((distance % (1000 * 60)) / 1000).toString();
      hours = hours.length == 1 ? `0${hours}` : hours;
      minutes = minutes.length == 1 ? `0${minutes}` : minutes;
      seconds = seconds.length == 1 ? `0${seconds}` : seconds;

      this.clock = `${hours}:${minutes}:${seconds}`
    },1000);
  }

  close() {
    this._matDialogRef.close();
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
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }
}

import {Component, Input, OnInit} from '@angular/core';
import {Clue} from "../models/quiz";

@Component({
  selector: 'clue-card',
  templateUrl: './clue-card.component.html',
  styleUrls: ['./clue-card.component.scss']
})
export class ClueCardComponent implements OnInit {
  @Input() clue: Clue = {} as Clue;
  constructor() { }

  ngOnInit(): void {
  }

}

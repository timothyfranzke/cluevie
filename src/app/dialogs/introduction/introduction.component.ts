import { Component, OnInit } from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-introduction',
  templateUrl: './introduction.component.html',
  styleUrls: ['./introduction.component.scss']
})
export class IntroductionComponent implements OnInit {

  constructor(
    private _matDialogRef: MatDialogRef<IntroductionComponent>
  ) { }

  ngOnInit(): void {
  }

  ok() {
    this._matDialogRef.close([true])
  }

}

import { Component, OnInit } from '@angular/core';
import {MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: 'app-clue-explaination',
  templateUrl: './clue-explaination.component.html',
  styleUrls: ['./clue-explaination.component.scss']
})
export class ClueExplainationComponent implements OnInit {

  constructor(
    private dialogRef: MatDialogRef<ClueExplainationComponent>,
  ) { }

  ngOnInit(): void {
  }

  ok() {
    this.dialogRef.close([true]);
  }

}

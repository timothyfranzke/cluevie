import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MovieSearchComponent } from './movie-search/movie-search.component';
import { HintsComponent } from './hints/hints.component';
import { ClueCardComponent } from './clue-card/clue-card.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatButtonModule} from "@angular/material/button";
import { ScoreCounterComponent } from './score-counter/score-counter.component';
import { GuessComponent } from './guess/guess.component';
import {MatAutocompleteModule} from "@angular/material/autocomplete";
import {MatInputModule} from "@angular/material/input";
import {ReactiveFormsModule} from "@angular/forms";
import {MatListModule} from "@angular/material/list";
import {FlexModule} from "@angular/flex-layout";
import { FinalScoreComponent } from './final-score/final-score.component';
import { QuizDetailsComponent } from './quiz-details/quiz-details.component';
import { WinnerComponent } from './final-score/winner/winner.component';
import {MatDialogModule} from "@angular/material/dialog";
import { LoserComponent } from './final-score/loser/loser.component';
import { SaveResultComponent } from './final-score/save-result/save-result.component';
import {ClipboardModule} from "@angular/cdk/clipboard";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {MatIconModule} from "@angular/material/icon";
import {AngularFireModule} from "@angular/fire/compat";
import {environment} from "../environments/environment";
import { RevealButtonComponent } from './reveal-button/reveal-button.component';
import { IntroductionComponent } from './dialogs/introduction/introduction.component';
import { ClueExplainationComponent } from './dialogs/clue-explaination/clue-explaination.component';

@NgModule({
  declarations: [
    AppComponent,
    MovieSearchComponent,
    HintsComponent,
    ClueCardComponent,
    ScoreCounterComponent,
    GuessComponent,
    FinalScoreComponent,
    QuizDetailsComponent,
    WinnerComponent,
    LoserComponent,
    SaveResultComponent,
    RevealButtonComponent,
    IntroductionComponent,
    ClueExplainationComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AngularFireModule.initializeApp(environment.firebaseConfig),
    BrowserAnimationsModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatDialogModule,
    MatInputModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    MatListModule,
    FlexModule,
    ClipboardModule,
    MatIconModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

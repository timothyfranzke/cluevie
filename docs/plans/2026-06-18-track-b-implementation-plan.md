# Track B Implementation Plan: Angular 12 → 20 + Modular Upgrade

**Date:** 2026-06-18
**Scope:** `src/`, `package.json`, `angular.json`, `tsconfig*.json` only.
**Out of scope:** `functions/` (Track A), zoneless change detection.
**Estimated PRs:** 7

---

## Node Version Requirement

Angular 20 requires **Node 22.x** (LTS). Angular 14 requires Node 14.15+, Angular 17 requires Node 18.13+, Angular 20 requires Node 22.0+. Confirm the runtime environment satisfies Node 22 before any step executes. Add an `engines` field to `package.json` once you land on Angular 20:

```json
"engines": { "node": ">=22.0.0" }
```

---

## Step 1: Angular 12 → 13 (Material alignment + minor RxJS)

### Goal
Advance Angular core and CLI to 13 so the existing `@angular/material@13` / `@angular/cdk@13` pre-existing mismatch becomes aligned, and pick up the Ivy-only compilation model.

### Commands

```bash
ng update @angular/core@13 @angular/cli@13 \
          @angular/router@13 @angular/forms@13 \
          @angular/platform-browser@13 \
          @angular/platform-browser-dynamic@13 \
          @angular/animations@13 \
          @angular/common@13 \
          @angular/compiler@13 \
          @angular/compiler-cli@13 \
          @angular-devkit/build-angular@13 \
          @angular/fire@7
```

`@angular/material` and `@angular/cdk` are already at 13; they do not need to move in this step. Verify with:

```bash
ng version
```

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `package.json` | Small — version bumps only |
| `tsconfig.json` | Small — target may shift to `es2022` |
| `src/polyfills.ts` | Small — Angular 13 removed IE11 polyfills |
| `src/test.ts` | Small — potential test harness cleanup |

### Validation

```bash
npm run build
npm test
npm start   # manual: load game, reveal a clue, make one guess
```

### Known Breaking Changes at This Hop

- **IE11 polyfills removed.** Angular 13 no longer emits IE11-compatible output. `src/polyfills.ts` will have stale entries that produce build warnings; remove them.
- **`ViewEngine` removed.** Any library that declared `"ivyTemplates": false` will fail to compile. `@angular/fire@7` is Ivy-compatible; this is only a risk if a third-party lib was pinned to a View Engine build.
- **`TestBed.configureTestingModule` teardown** default changed to `destroyAfterEach: true` in Angular 13. The existing `quiz.service.spec.ts` has a minimal setup; watch for unexpected state leaks in other spec files once the rule is active.

### Rollback

`git checkout .` and `git clean -fd` on changed files; restore the original `package-lock.json` via `git checkout package-lock.json` and `npm ci`.

---

## Step 2: Angular 13 → 14 (typed forms + Material 14, RxJS 7 entry)

### Goal
Reach Angular 14 which introduces typed reactive forms, enables `ng generate @angular/core:standalone` schematic, and lands RxJS 7 as the official peer dependency.

### Commands

```bash
ng update @angular/core@14 @angular/cli@14 \
          @angular/router@14 @angular/forms@14 \
          @angular/platform-browser@14 \
          @angular/platform-browser-dynamic@14 \
          @angular/animations@14 \
          @angular/common@14 \
          @angular/compiler@14 \
          @angular/compiler-cli@14 \
          @angular-devkit/build-angular@14

ng update @angular/material@14 @angular/cdk@14
```

Then upgrade RxJS explicitly:

```bash
npm install rxjs@7
```

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `package.json` | Small |
| `tsconfig.json` | Small — TypeScript minimum bumps to 4.6 |
| `src/app/movie-search/movie-search.component.ts` | Small — `FormControl` needs explicit type arg |
| All `*.spec.ts` files | Small — typed forms schematic may adjust test stubs |

### Validation

```bash
npm run build
npm test
npm start   # full play-through: intro dialog, reveal clue, search for movie, submit guess
```

### Known Breaking Changes at This Hop

- **RxJS 7: `toPromise()` deprecated.** No usages currently exist in `src/`, but verify no new usages were added. Use `firstValueFrom()` or `lastValueFrom()` for any future one-shot conversions.
- **RxJS 7: `combineLatest([])` signature** changed; array form is now preferred. The current codebase does not use `combineLatest`, so no immediate action, but worth verifying.
- **Typed `FormControl`.** `MovieSearchComponent` declares `myControl = new FormControl()` without a type argument. Angular 14's `ng update` migration runs `ng generate @angular/core:untyped-forms` automatically, which adds `UntypedFormControl` as a transitional alias. Accept this migration output; you can refine the type in a follow-on PR.
- **TypeScript bump to 4.6.** The existing `strict: true` tsconfig may surface new errors on narrowing patterns. Resolve any TS errors before merging.
- **`date-fns@2` compatibility.** `date-fns@2` is compatible through Angular 14; no change needed here.

### Rollback

Same git-based approach as Step 1. The typed-forms migration can be reverted by restoring the original `movie-search.component.ts`.

---

## Step 3: Remove `@angular/flex-layout` and replace with CSS

### Goal
Eliminate the deprecated `@angular/flex-layout` package entirely, replacing all `fxLayout` / `fxFlex` / `fxLayoutAlign` directive attributes in templates with equivalent Flexbox CSS utility classes or inline styles, and remove `FlexModule` from `AppModule`.

### Full Audit of FlexLayout Usages

Every occurrence found by `grep -rn "fxLayout\|fxFlex\|fxLayoutAlign" src/app --include="*.html"`:

**`src/app/final-score/winner/winner.component.html`** (2 usages)
- Line 1: `<div fxLayout="row" fxLayoutAlign="end">` — close-button row, flex-end alignment
- Line 6: `<div fxLayout="row" fxLayoutAlign="end">` — save-result row, flex-end alignment

**`src/app/final-score/loser/loser.component.html`** (1 usage)
- Line 1: `<div fxLayout="row" fxLayoutAlign="end">` — close-button row

**`src/app/guess/guess.component.html`** (1 usage)
- Line 3: `<h6 fxLayout="row" fxLayoutAlign="center">Previous Guesses:</h6>` — centered heading

**`src/app/dialogs/statistics/statistics.component.html`** (heavy usage — approx 25 attribute instances)
- Outer column container for the whole dialog
- Row/end div for the close icon
- Row/center for the "Statistics" heading
- Row/center wrapper, then Row/space-around with `fxFlex="85"` for the four stat tiles
- Each stat tile: `fxLayout="column"` + inner row/center pairs for number and label
- Six distribution rows each using `fxLayout="row"` with a `<span>` that carries `[fxFlex]="percentage"` and `fxLayoutAlign="end"` — this is the dynamic-width bar chart
- Bottom section: `fxLayout="row" fxLayoutAlign="space-around"` with a column and a centered column for the share button

**`src/app/dialogs/clue-explaination/clue-explaination.component.html`** (4 usages)
- Row/end for close icon
- Row/center-center for body wrapper
- Column inside body
- Row/center-center on `<strong>`

**`src/app/dialogs/introduction/introduction.component.html`** (4 usages)
- Same pattern as clue-explaination: row/end close, row/center-center body, column, row/center-center on `<h1>`

**`src/app/app.module.ts`** (1 import)
- `FlexModule` imported from `@angular/flex-layout`

### Proposed CSS Replacement Strategy

Replace FlexLayout directives with a small set of utility CSS classes added to `src/styles.scss` (not a full Tailwind integration — just the handful of classes needed):

```scss
// FlexLayout replacement utilities in styles.scss
.flex-row       { display: flex; flex-direction: row; }
.flex-col       { display: flex; flex-direction: column; }
.justify-end    { justify-content: flex-end; }
.justify-center { justify-content: center; }
.justify-around { justify-content: space-around; }
.align-center   { align-items: center; }
.flex-center    { justify-content: center; align-items: center; }
```

For the dynamic `[fxFlex]="percentage"` bar chart in `statistics.component.html`, replace the attribute binding with an inline `[style.flex]` or `[style.width.%]` binding directly on the element — this is the one place where a structural CSS class is insufficient and a style binding must remain.

**Mapping table (abbreviated):**

| Old attribute | Replacement |
|---|---|
| `fxLayout="row"` | class `flex-row` |
| `fxLayout="column"` | class `flex-col` |
| `fxLayoutAlign="end"` | class `justify-end` |
| `fxLayoutAlign="center"` | class `justify-center` |
| `fxLayoutAlign="center center"` | class `flex-center` |
| `fxLayoutAlign="space-around"` | class `justify-around` |
| `fxLayoutAlign="center center"` on column | class `flex-col align-center justify-center` |
| `fxFlex="85"` | `style="flex: 0 1 85%"` or a specific class |
| `[fxFlex]="x.percentage"` | `[style.width.%]="x.percentage"` |

### Commands

```bash
# Remove the packages
npm uninstall @angular/flex-layout flex-layout-srcs

# Then manually edit all affected HTML files (7 files) and app.module.ts
```

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `package.json` | Small — remove 2 packages |
| `src/app/app.module.ts` | Small — remove `FlexModule` import |
| `src/styles.scss` | Small — add utility classes |
| `src/app/dialogs/statistics/statistics.component.html` | Medium — ~25 attribute replacements + style binding |
| `src/app/dialogs/statistics/statistics.component.scss` | Small — may need flex adjustments |
| `src/app/dialogs/introduction/introduction.component.html` | Small — 4 replacements |
| `src/app/dialogs/clue-explaination/clue-explaination.component.html` | Small — 4 replacements |
| `src/app/final-score/winner/winner.component.html` | Small — 2 replacements |
| `src/app/final-score/loser/loser.component.html` | Small — 1 replacement |
| `src/app/guess/guess.component.html` | Small — 1 replacement |

### Validation

```bash
npm run build
npm test
npm start
# Manual: open Statistics dialog — verify four stat tiles are evenly spaced,
#   distribution bars render with correct proportional widths,
#   close icons are right-aligned in all dialogs.
```

### Known Breaking Changes

- `flex-layout-srcs` is a GitHub-sourced package (`github:angular/flex-layout`) which may produce npm install warnings even after `@angular/flex-layout` is removed. Ensure both entries are removed from `package.json` and `package-lock.json`.
- The `[fxFlex]` binding on the distribution bar `<span>` elements drives a dynamic-width chart. The `[style.width.%]` replacement is functionally equivalent but the element must have `display: block` or live inside a `display: flex` parent — verify the layout in the browser after the change.

### Rollback

Restore from git. Because this step is purely template/CSS work with no Angular version change, rollback is simple: `git checkout src/`.

---

## Step 4: AngularFire compat → modular API rewrite in `QuizService`

### Goal
Replace the `@angular/fire/compat` AngularFirestore injection with the modular `@angular/fire` v9+ API (`getFirestore`, `collection`, `query`, `where`, `orderBy`, `limit`, `collectionData`, `addDoc`), eliminating the compat shim entirely.

### Context: `firebaseConfig` and Initialization

Under the compat API, `AppModule` initializes Firebase with:

```typescript
AngularFireModule.initializeApp(environment.firebaseConfig)
```

The `environment.firebaseConfig` object (apiKey, authDomain, projectId, etc.) is the same object the modular API uses. Under modular AngularFire, initialization moves to `app.module.ts` providers using `provideFirebaseApp` and `provideFirestore`:

```typescript
// Before (compat — app.module.ts imports array):
AngularFireModule.initializeApp(environment.firebaseConfig)

// After (modular — app.module.ts providers array):
provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
provideFirestore(() => getFirestore()),
```

The `firebaseConfig` object shape does not change — only where it is passed.

### Before/After Constructor Injection Shape

**Before (compat):**
```typescript
import { AngularFirestore } from '@angular/fire/compat/firestore';

constructor(
  private _angularFirestore: AngularFirestore,
  private _httpClient: HttpClient
) { ... }
```

**After (modular):**
```typescript
import { Firestore, collection, query, where, orderBy,
         limit, collectionData, addDoc } from '@angular/fire/firestore';
import { inject } from '@angular/core';

// Option A — inject() in constructor body:
constructor(private _httpClient: HttpClient) {
  const firestore = inject(Firestore);
  ...
}

// Option B — field injection (preferred for standalone-ready code):
private readonly _firestore = inject(Firestore);
constructor(private _httpClient: HttpClient) { ... }
```

### Query Rewrite Pattern

**`quizzes` collection — current (compat):**
```typescript
this._angularFirestore.collection(environment.quizTable, ref => ref
  .where('date', '<=', new Date())
  .orderBy('date', 'desc')
  .limit(1)
).snapshotChanges()
  .pipe(
    map(quizzes => quizzes.map(a => {
      const data = a.payload.doc.data() as any;
      const id   = a.payload.doc['id'];
      return { id, ...data } as Quiz;
    }))
  ).subscribe(...)
```

**`quizzes` collection — after (modular):**
```typescript
const quizzesRef = collection(this._firestore, environment.quizTable);
const q = query(quizzesRef,
  where('date', '<=', new Date()),
  orderBy('date', 'desc'),
  limit(1)
);
collectionData(q, { idField: 'id' })
  .pipe(
    map(docs => docs as Quiz[])
  ).subscribe(quizzes => {
    this._quiz = quizzes[0];
    ...
  });
```

**`movies` search query — current (compat):**
```typescript
this._angularFirestore
  .collection(`movies`, ref => ref
    .orderBy('term')
    .startAt(term.toLowerCase())
    .endAt(term.toLowerCase() + '')
    .limit(10))
  .snapshotChanges()
  .pipe(
    map(movies => movies.map(a => {
      const data = a.payload.doc.data() as any;
      const id   = a.payload.doc['id'];
      return { id, ...data } as Movie;
    }))
  )
```

**`movies` search query — after (modular):**
```typescript
import { startAt, endAt } from '@angular/fire/firestore';

const moviesRef = collection(this._firestore, 'movies');
const q = query(moviesRef,
  orderBy('term'),
  startAt(term.toLowerCase()),
  endAt(term.toLowerCase() + ''),
  limit(10)
);
return collectionData(q, { idField: 'id' }) as Observable<Movie[]>;
```

**`results` write — current (compat):**
```typescript
this._angularFirestore.collection('results').add(this._result);
```

**`results` write — after (modular):**
```typescript
const resultsRef = collection(this._firestore, 'results');
addDoc(resultsRef, this._result);
```

### Commands

```bash
# No ng update needed — @angular/fire@7 already supports the modular API.
# This is a manual source rewrite only.
```

The key source changes are:
1. `src/app/quiz.service.ts` — full injection/query rewrite (large)
2. `src/app/app.module.ts` — replace `AngularFireModule.initializeApp()` in `imports` with `provideFirebaseApp()` + `provideFirestore()` in `providers` (small)
3. `src/app/quiz.service.spec.ts` — update the test stub to provide a mock `Firestore` token (small)

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `src/app/quiz.service.ts` | Large |
| `src/app/app.module.ts` | Small |
| `src/app/quiz.service.spec.ts` | Small |

### Validation

```bash
npm run build
npm test
npm start
# Manual: verify today's quiz loads (Firestore read works),
#   autocomplete search returns results,
#   completing a game writes to the `results` collection (check Firebase console).
```

### Known Breaking Changes

- `collectionData` returns an `Observable` that emits arrays; the compat `snapshotChanges()` returned metadata-enriched snapshots. The `idField` option on `collectionData` handles the document ID extraction that the compat code did manually via `a.payload.doc['id']`.
- The `startAt` / `endAt` cursor query functions in the modular API require the query to include a corresponding `orderBy` for the same field before the cursor — this is already the case in the current compat code (`orderBy('term')` precedes the range).
- `addDoc` is async and returns a `Promise<DocumentReference>`. The current `saveResult()` does not await the result, which is fine — the call pattern is fire-and-forget. No change needed to the callers.
- The `Firestore` token from `@angular/fire/firestore` must be provided by `provideFirestore()` in `AppModule` (or a future standalone `bootstrapApplication` providers array). If the provider is missing, the `inject(Firestore)` call will throw at runtime.

### Rollback

`git checkout src/app/quiz.service.ts src/app/app.module.ts`. The compat API is still in `node_modules`; no package removal is needed here — save that for the standalone step.

---

## Step 5: Angular 14 → 17 (standalone schematics + new control flow)

### Goal
Reach Angular 17 in two sub-hops (14 → 15 → 16 → 17 is the safe path; use `--force` only if peer-dep errors arise), picking up the standalone component schematic and the new `@if`/`@for`/`@switch` control flow syntax.

### Commands

```bash
# Hop 1: 14 → 15
ng update @angular/core@15 @angular/cli@15 \
          @angular/router@15 @angular/forms@15 \
          @angular/platform-browser@15 \
          @angular/platform-browser-dynamic@15 \
          @angular/animations@15 \
          @angular/common@15 \
          @angular/compiler@15 \
          @angular/compiler-cli@15 \
          @angular-devkit/build-angular@15

ng update @angular/material@15 @angular/cdk@15

# Hop 2: 15 → 16
ng update @angular/core@16 @angular/cli@16 \
          @angular/router@16 @angular/forms@16 \
          @angular/platform-browser@16 \
          @angular/platform-browser-dynamic@16 \
          @angular/animations@16 \
          @angular/common@16 \
          @angular/compiler@16 \
          @angular/compiler-cli@16 \
          @angular-devkit/build-angular@16

ng update @angular/material@16 @angular/cdk@16

# Hop 3: 16 → 17
ng update @angular/core@17 @angular/cli@17 \
          @angular/router@17 @angular/forms@17 \
          @angular/platform-browser@17 \
          @angular/platform-browser-dynamic@17 \
          @angular/animations@17 \
          @angular/common@17 \
          @angular/compiler@17 \
          @angular/compiler-cli@17 \
          @angular-devkit/build-angular@17

ng update @angular/material@17 @angular/cdk@17
ng update @angular/fire@17     # if a compatible release is available
```

After each sub-hop: `npm run build && npm test` before proceeding.

### Material Theme Migration (indigo-pink)

Angular Material 17 ships a new MDC-based component architecture that was stabilized in v15. The prebuilt theme path changes:

**Before (current `angular.json` styles array):**
```json
"./node_modules/@angular/material/prebuilt-themes/indigo-pink.css"
```

**After Angular Material 15+ (path is the same but the CSS content is MDC-based):**
The path itself does not change, but the MDC migration `ng update @angular/material@15` runs a schematic that may rewrite component SCSS files. Watch for visual regressions in Material components (button sizes, input height, dialog padding) — the MDC components have different default spacing. Run the full manual play-through after this sub-hop.

If the Material MDC migration introduces unacceptable visual changes, the `ng update` migration supports `--use-mdc-components=false` as an opt-out flag on the `@angular/material@15` update command, retaining legacy component styles temporarily.

### Angular 15 Known Breaking Changes

- **`RouterModule` with empty `routes: []`** — no issue; the empty routes array is valid.
- **`NgModel` on non-form elements** warnings become errors in strict mode.
- **`DatePipe` locale changes** — not used here, no impact.

### Angular 16 Known Breaking Changes

- **Signals introduced (opt-in)** — no code changes needed in this step; signals are purely additive.
- **`@angular/fire` version compatibility** — ensure `@angular/fire` peer deps align with Angular 16. If `@angular/fire@16` is not available, pin at the highest compatible version that satisfies Angular 16 peers.
- **TypeScript bump to 5.0** — the existing `strict: true` config may surface new errors. Audit for any `!` non-null assertions that TS 5.0 handles differently.

### Angular 17 Known Breaking Changes

- **New builder: `@angular-devkit/build-angular:application`** replaces `@angular-devkit/build-angular:browser`. The `ng update` schematic migrates `angular.json` automatically. The `polyfills` field moves from a string to an array.
- **`defaultProject` field removed from `angular.json`** — the schematic removes it.
- **`*ngIf` / `*ngFor` are still supported** in Angular 17 alongside the new control flow syntax; migration is optional and is covered in Step 6 via the schematic.

### Files Expected to Change (across all three sub-hops)

| File | Surface area |
|------|-------------|
| `package.json` | Small per hop |
| `angular.json` | Medium — builder migration at v17 |
| `tsconfig.json` | Small — target/lib bumps |
| `src/polyfills.ts` | Small — may be removed entirely at v17 |
| Component SCSS files (Material MDC) | Small–medium per component |

### Validation

Run after every sub-hop:

```bash
npm run build
npm test
npm start
# Manual: full game play-through; open Statistics, Introduction, ClueExplanation dialogs
# Visual check: all Material components render correctly (buttons, inputs, dialogs, snackbars)
```

### Rollback

Each sub-hop is its own git commit. Rollback to any prior commit with `git reset --hard <sha>` and `npm ci`.

---

## Step 6: `ng generate @angular/core:standalone` Migration

### Goal
Convert all NgModule-based components to standalone components, convert `AppModule` to a `bootstrapApplication` call in `main.ts`, and remove `app.module.ts`.

### What the Schematic Does

Run in three passes as Angular's migration guide prescribes:

```bash
# Pass 1: Convert all components/directives/pipes to standalone: true
ng generate @angular/core:standalone --mode=convert-to-standalone

# Pass 2: Remove NgModule declarations and move imports to each component
ng generate @angular/core:standalone --mode=prune-ng-modules

# Pass 3: Convert main.ts from platformBrowserDynamic().bootstrapModule(AppModule)
#          to bootstrapApplication(AppComponent, { providers: [...] })
ng generate @angular/core:standalone --mode=standalone-bootstrap
```

### What Changes in `app.module.ts`

Pass 1 moves `declarations` entries into each component's `standalone: true` + `imports` array. After all three passes, `app.module.ts` is deleted entirely.

**Before `app.module.ts` imports/declarations (representative):**
```typescript
@NgModule({
  declarations: [AppComponent, MovieSearchComponent, HintsComponent, ...],
  imports: [
    BrowserModule, AppRoutingModule,
    provideFirebaseApp(...), provideFirestore(...),
    BrowserAnimationsModule,
    MatButtonModule, MatAutocompleteModule, MatDialogModule, ...
    FlexModule,          // already removed in Step 3
    ClipboardModule, MatIconModule, MatProgressBarModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
```

**After — `main.ts` (new shape):**
```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideHttpClient(),
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideFirestore(() => getFirestore()),
  ]
});
```

Each component gets `standalone: true` and imports only what it directly uses (e.g., `AppComponent` imports `MatDialogModule`, `QuizDetailsComponent`, `MovieSearchComponent`, etc.).

**Note on `HttpClientModule`:** In Angular 15+, `HttpClientModule` is deprecated in favour of `provideHttpClient()`. The schematic may not migrate this automatically — check that `HttpClientModule` is replaced with the functional provider.

**Note on `AppRoutingModule`:** The routing module with `routes: []` simplifies to `provideRouter([])` in the `bootstrapApplication` providers array.

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `src/main.ts` | Medium — full rewrite |
| `src/app/app.module.ts` | Deleted |
| `src/app/app-routing.module.ts` | Deleted (routes moved to providers) |
| Every `*.component.ts` (13 components) | Small each — add `standalone: true` + `imports` array |
| `src/app/quiz.service.spec.ts` | Small — test providers may need updating |
| All `*.spec.ts` files | Small — test bed setup changes |

### Control Flow Syntax Migration (optional at this step)

Angular 17 ships a schematic to convert `*ngIf`/`*ngFor`/`*ngSwitch` to `@if`/`@for`/`@switch`:

```bash
ng generate @angular/core:control-flow
```

This can be run immediately after the standalone migration or deferred to Step 7. The schematic handles all 13 component templates automatically. The only manual review needed is:
- `@for` requires a `track` expression; the schematic defaults to `track $index` for `*ngFor` loops without a `trackBy`. Review each generated `track` expression and substitute a meaningful identity (e.g., `track guess.id` in `guess.component.html`).
- `*ngIf="x; else y"` patterns are converted to `@if (x) { ... } @else { ... }` blocks — verify the else branches render correctly.

### Validation

```bash
npm run build
npm test
npm start
# Manual: full play-through verifying all 13 components render and interact correctly.
# Specifically: dialog open/close (Introduction, ClueExplanation, Statistics, Winner, Loser)
#   movie autocomplete, clue reveal animation, score counter updates.
```

### Rollback

Each pass of the schematic should be committed separately (three commits). Roll back to before Pass 1 if the build fails after Pass 1, rather than trying to partially undo the schematic output.

---

## Step 7: Angular 17 → 20 (mechanical version bumps)

### Goal
Advance the Angular platform from 17 to 20 in two steps (17 → 19, then 19 → 20), keeping all build and test targets green.

### Commands

```bash
# Hop: 17 → 18
ng update @angular/core@18 @angular/cli@18 \
          @angular/router@18 @angular/forms@18 \
          @angular/platform-browser@18 \
          @angular/platform-browser-dynamic@18 \
          @angular/animations@18 \
          @angular/common@18 \
          @angular/compiler@18 \
          @angular/compiler-cli@18 \
          @angular-devkit/build-angular@18

ng update @angular/material@18 @angular/cdk@18

# Hop: 18 → 19
ng update @angular/core@19 @angular/cli@19 \
          @angular/router@19 @angular/forms@19 \
          @angular/platform-browser@19 \
          @angular/platform-browser-dynamic@19 \
          @angular/animations@19 \
          @angular/common@19 \
          @angular/compiler@19 \
          @angular/compiler-cli@19 \
          @angular-devkit/build-angular@19

ng update @angular/material@19 @angular/cdk@19

# Hop: 19 → 20
ng update @angular/core@20 @angular/cli@20 \
          @angular/router@20 @angular/forms@20 \
          @angular/platform-browser@20 \
          @angular/platform-browser-dynamic@20 \
          @angular/animations@20 \
          @angular/common@20 \
          @angular/compiler@20 \
          @angular/compiler-cli@20 \
          @angular-devkit/build-angular@20

ng update @angular/material@20 @angular/cdk@20
ng update @angular/fire    # to latest stable compatible with Angular 20

# Add engines field after landing on Angular 20:
# (edit package.json manually)
# "engines": { "node": ">=22.0.0" }
```

### Angular 18 Known Breaking Changes

- **`@angular/material` component API changes.** Check the Angular Material 18 changelog for any removed or renamed component inputs/outputs. No known breaking changes affect the components used in Cluvie (button, autocomplete, input, list, dialog, snack-bar, icon, progress-bar, clipboard).
- **`providedIn: 'root'` services.** No change — `QuizService` uses this and it remains valid.
- **Signal-based inputs/outputs (opt-in preview).** No action needed in this step.

### Angular 19 Known Breaking Changes

- **`linkedSignal` and `resource` APIs** — additive, no action.
- **`@angular/fire` compatibility** — verify `@angular/fire` peer dependencies align with Angular 19 before running the update. Check the `@angular/fire` release page.

### Angular 20 Known Breaking Changes

- **Minimum Node version is 22.** Ensure CI and hosting environments are updated.
- **`experimental-standalone-discovery`** — no longer experimental. This does not require code changes since Step 6 already migrated to standalone.
- **Builder changes.** The `@angular-devkit/build-angular:application` builder (introduced at v17) is fully stable; verify `angular.json` uses it.

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `package.json` | Small per hop |
| `tsconfig.json` | Small — TypeScript target may advance |
| `angular.json` | Small — possible builder option changes |

### Validation

Run after each sub-hop:

```bash
npm run build
npm test
npm start   # full play-through
```

### Rollback

Commit after each sub-hop; roll back by SHA.

---

## Step 8: Signals Refactor of `QuizService`

### Goal
Replace the four `BehaviorSubject` reactive primitives in `QuizService` with Angular signals (`signal()` / `computed()`), converting the service from push-Observable-based state to a pull-signal model, and update all subscriber components to read signals instead of subscribing to Observables.

### Current State: Four BehaviorSubjects

| Subject field | Type | What it broadcasts | Current consumers |
|---|---|---|---|
| `_resultSubject` | `BehaviorSubject<Result>` | Game result state after every action | `AppComponent`, `ScoreCounterComponent`, `HintsComponent`, `GuessComponent`, `RevealButtonComponent`, `FinalScoreComponent`, `StatisticsComponent` (7 components) |
| `_clueSubject` | `BehaviorSubject<Clue[]>` | Currently only set but never subscribed to externally — components read clues from `_resultSubject` | None (dead signal; safe to remove) |
| `_quizSubject` | `BehaviorSubject<Quiz>` | Today's quiz once loaded from Firestore | `QuizDetailsComponent`, `MovieSearchComponent`, `FinalScoreComponent` (3 components) |
| `_searchResultsSubject` | `BehaviorSubject<Movie[]>` | Full movie list for autocomplete | `MovieSearchComponent` via `getMovies()` |

### Signal Replacement Map

**In `QuizService`:**

```typescript
// Before:
private _resultSubject: BehaviorSubject<Result> = new BehaviorSubject({} as Result);
private _clueSubject: BehaviorSubject<Clue[]>   = new BehaviorSubject({} as Clue[]);
private _quizSubject: BehaviorSubject<Quiz>      = new BehaviorSubject({} as Quiz);
private _searchResultsSubject: BehaviorSubject<Movie[]> = new BehaviorSubject({} as Movie[]);

// After:
readonly result        = signal<Result>({} as Result);
readonly quiz          = signal<Quiz>({} as Quiz);
readonly searchResults = signal<Movie[]>([]);
// _clueSubject is removed — clues are accessed via result().visibleClues
```

Every internal call to `this._resultSubject.next(this._result)` becomes `this.result.set(this._result)` (or `this.result.update(r => ({ ...r, ...changes }))`).

The public Observable-returning accessor methods can be removed or kept as compatibility shims during the transition:

```typescript
// Remove:
getResultSub(): Observable<Result>
getQuizSub(): Observable<Quiz>
getMovies(): Observable<Movie[]>
searchSub(): BehaviorSubject<Movie[]>
getResult(): Result   // replaced by result() signal read

// Keep temporarily if needed, or remove if all consumers are updated:
// (none needed once all 7 result subscribers and 3 quiz subscribers migrate)
```

### Component-by-Component Subscription Changes

**`AppComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => { this.result = result; });

// After (option A — store the signal reference, use in template as result()):
result = this._quizService.result;
// Template: result().outcome != 0  →  stays the same but called as a function: result().outcome
```

**`ScoreCounterComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => { this.result = result; });

// After:
result = this._quizService.result;
// Template reads result().score, result().points etc.
```

**`HintsComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => {
  this.result = result;
  // clues initialization logic
});

// After:
result = this._quizService.result;
// Use computed() for derived clue list:
clues = computed(() => this._quizService.result().visibleClues ?? []);
```

**`GuessComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => { this.result = result; });

// After:
result = this._quizService.result;
```

**`RevealButtonComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => {
  this.result = result;
  if (result.visibleClues && ...) { this.revealedClue = ...; }
});

// After:
result = this._quizService.result;
revealedClue = computed(() => {
  const clues = this._quizService.result().visibleClues;
  return clues?.length > 0 ? clues[clues.length - 1] : ({} as Clue);
});
```

**`FinalScoreComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => { this.result = result; ... });
this._quizService.getQuizSub().subscribe(quiz => { this.quiz = quiz; });

// After:
result = this._quizService.result;
quiz   = this._quizService.quiz;
// The "open dialog when completed" side-effect must move to an effect():
constructor() {
  effect(() => {
    const r = this.result();
    if (r.completed && !this.isDialogOpen) {
      this.isDialogOpen = true;
      this._matDialog.open(StatisticsComponent, { width: '90vw' })
        .afterClosed().subscribe(() => { this.isDialogOpen = false; });
    }
  });
}
```

**`QuizDetailsComponent`**

```typescript
// Before:
this._quizService.getQuizSub().subscribe(quiz => { this.quiz = quiz; });

// After:
quiz = this._quizService.quiz;
// Remove ngOnInit load() call — signal emits current value automatically
```

**`MovieSearchComponent`**

```typescript
// Before:
this._quizService.getQuizSub().subscribe(quiz => { this.quizMovie = ...; });
this._quizService.getMovies().subscribe(movies => { this.movies = movies; });

// After:
// Use toObservable() from @angular/core/rxjs-interop to keep the existing
// valueChanges pipe pattern working:
private _quizSignal = this._quizService.quiz;
private _moviesSignal = this._quizService.searchResults;

// In ngOnInit, react to signal changes via effect():
effect(() => {
  const quiz = this._quizSignal();
  this.quizMovie = { id: quiz.answerId, name: quiz.title, ... } as Movie;
  this._reconcileMovie();
});
effect(() => {
  const movies = this._moviesSignal();
  this.movies = movies ?? [];
  this._reconcileMovie();
});
```

**`StatisticsComponent`**

```typescript
// Before:
this._quizService.getResultSub().subscribe(result => { this.result = result; });

// After:
result = this._quizService.result;
```

### `_clueSubject` Disposition

`_clueSubject` is written in the constructor (`this._clueSubject.next(this._result.visibleClues)`) and in `getClue()`, but no component subscribes to the Observable returned by a public method — `getClue` method exists but components call `getResultSub()` to read `visibleClues`. The `_clueSubject` field and its `next()` calls can be removed cleanly in this step. Confirm no external subscription exists before deleting.

### `load()` Method

The `load()` method (`this._quizSubject.next(this._quiz); this._clueSubject.next(...); this._resultSubject.next(this._result)`) exists to re-broadcast current state to late subscribers. With signals, this is unnecessary — signal reads always return the current value. The `load()` method can be removed, along with the `ngOnInit` calls to it in `QuizDetailsComponent` and `FinalScoreComponent`.

### Commands

```bash
# No ng commands — this is a manual source refactor only.
# Signals (signal, computed, effect) are available from @angular/core since Angular 17.
```

### Files Expected to Change

| File | Surface area |
|------|-------------|
| `src/app/quiz.service.ts` | Large — full state model rewrite |
| `src/app/app.component.ts` | Small |
| `src/app/score-counter/score-counter.component.ts` | Small |
| `src/app/hints/hints.component.ts` | Small |
| `src/app/guess/guess.component.ts` | Small |
| `src/app/reveal-button/reveal-button.component.ts` | Small |
| `src/app/final-score/final-score.component.ts` | Small |
| `src/app/quiz-details/quiz-details.component.ts` | Small |
| `src/app/movie-search/movie-search.component.ts` | Medium |
| `src/app/dialogs/statistics/statistics.component.ts` | Small |
| All `*.component.html` templates that bind `result` or `quiz` | Small — `result.score` becomes `result().score` etc. |
| `src/app/quiz.service.spec.ts` | Medium — signal-based mocking |

### Test Strategy for This Step

The existing `quiz.service.spec.ts` tests only the `'should be created'` smoke test. Expand the test suite before this step to cover the four signal values using `TestBed` with `runInInjectionContext` to test signal reads:

```typescript
it('result signal starts empty', () => {
  expect(service.result()).toEqual({} as Result);
});
```

For component tests that previously used `spyOn(quizService, 'getResultSub').and.returnValue(of(...))`, replace with direct signal writes on a mock service:

```typescript
const mockService = { result: signal({} as Result), quiz: signal({} as Quiz), ... };
```

### Template Updates

Every template binding that currently reads `result.score` must become `result().score` after the component field changes from a `Result` object to a `Signal<Result>`. This applies to all 7 components that subscribe to `_resultSubject`. The `@if` / `@for` control flow blocks (migrated in Step 6) handle signal reads naturally — Angular's template compiler will call the signal function automatically when the signal is referenced in the template expression.

### Validation

```bash
npm run build
npm test
# Manual: verify all reactive updates still fire:
#   - Reveal clue → score counter decrements
#   - Submit guess → guess appears in guess list, score counter updates
#   - Win → statistics dialog auto-opens
#   - Statistics dialog shows correct played/win/streak values
```

### Rollback

`git checkout src/app/quiz.service.ts` and all modified component files. The signals API is backwards-compatible — there is no framework version to roll back.

---

## Cross-Cutting Concerns

### Test Strategy (All Steps)

Every step has the same testing obligation:

1. `npm test` must pass with zero failures before the PR is merged.
2. The existing Karma/Jasmine setup (`karma.conf.js`, `tsconfig.spec.json`) is maintained throughout. No tooling change is planned.
3. The `quiz.service.spec.ts` currently has only a smoke test. Before Step 8 (signals), expand it to cover signal initial values and the `makeGuess`/`getClue` mutation paths using Firestore mocks.
4. Component spec files that use `NO_ERRORS_SCHEMA` to suppress child component errors are not impacted by the standalone migration; however, after Step 6 the test bed setup must provide standalone component imports rather than relying on `AppModule`.

### AngularFire Version Matrix

| Angular version | Recommended `@angular/fire` version |
|---|---|
| 12 | 7.x (compat) |
| 13–14 | 7.x (both compat and modular APIs available) |
| 15–16 | 7.x or 7.6.x |
| 17–18 | Check `@angular/fire` releases; use `@latest` peer-compatible |
| 19–20 | Check `@angular/fire` releases; use `@latest` peer-compatible |

Always check `npm info @angular/fire peerDependencies` before each hop.

### `date-fns` Version

`date-fns@2.28.0` is used (`differenceInCalendarDays`, `startOfToday`, `startOfTomorrow`). It is compatible through Angular 20. There is no need to upgrade `date-fns` as part of this track; leave it pinned at `^2.28.0` unless a vulnerability is identified.

### `animate.css`

`animate.css@4.1.1` has no Angular version coupling. Leave it pinned.

### PR Sequence Summary

| PR | Step | Key change |
|---|---|---|
| PR 1 | Step 1 | Angular 12 → 13, align Material 13 |
| PR 2 | Step 2 | Angular 13 → 14, RxJS 7 |
| PR 3 | Step 3 | Remove `@angular/flex-layout`, CSS replacement |
| PR 4 | Step 4 | AngularFire compat → modular rewrite |
| PR 5 | Step 5 | Angular 14 → 17 (three sub-hop commits within the PR) |
| PR 6 | Step 6 | `ng generate @angular/core:standalone` + control flow migration |
| PR 7 | Steps 7 & 8 | Angular 17 → 20 + signals refactor (can split into two PRs if preferred) |

**Total PRs: 7 (or 8 if Step 7 and Step 8 are split).**

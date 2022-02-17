import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClueExplainationComponent } from './clue-explaination.component';

describe('ClueExplainationComponent', () => {
  let component: ClueExplainationComponent;
  let fixture: ComponentFixture<ClueExplainationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClueExplainationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClueExplainationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

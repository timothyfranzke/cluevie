import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClueCardComponent } from './clue-card.component';

describe('ClueCardComponent', () => {
  let component: ClueCardComponent;
  let fixture: ComponentFixture<ClueCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClueCardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClueCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

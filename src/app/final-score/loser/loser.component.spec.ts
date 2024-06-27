import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoserComponent } from './loser.component';

describe('LoserComponent', () => {
  let component: LoserComponent;
  let fixture: ComponentFixture<LoserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoserComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

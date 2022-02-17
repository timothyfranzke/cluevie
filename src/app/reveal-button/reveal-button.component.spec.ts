import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevealButtonComponent } from './reveal-button.component';

describe('RevealButtonComponent', () => {
  let component: RevealButtonComponent;
  let fixture: ComponentFixture<RevealButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ RevealButtonComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RevealButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

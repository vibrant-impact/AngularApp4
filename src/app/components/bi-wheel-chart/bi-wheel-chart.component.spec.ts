import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BiWheelChartComponent } from './bi-wheel-chart.component';

describe('BiWheelChartComponent', () => {
  let component: BiWheelChartComponent;
  let fixture: ComponentFixture<BiWheelChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BiWheelChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BiWheelChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

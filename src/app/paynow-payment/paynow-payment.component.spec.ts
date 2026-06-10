import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';
import { PayNowPaymentComponent } from './paynow-payment.component';

describe('PayNowPaymentComponent', () => {
  async function createComponent(moduleParameters: Record<string, unknown>) {
    const finesPage = document.createElement('main');
    finesPage.setAttribute('data-testid', 'test-fines-page');
    finesPage.textContent = 'Current fines balance is 15.50 SGD';
    document.body.appendChild(finesPage);

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [PayNowPaymentComponent],
      providers: [
        {
          provide: 'MODULE_PARAMETERS',
          useValue: moduleParameters,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PayNowPaymentComponent);
    fixture.componentInstance.hostComponent = {
      finesService: {
        personalInfoService: {
          jwtUtilService: {
            getDecodedToken: () => ({
              userName: 'A1234567',
              displayName: 'Asha Kumar',
            }),
          },
        },
      },
      finesCounters: 15.5,
    };
    fixture.detectChanges();

    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    document.querySelectorAll('[data-testid="test-fines-page"]').forEach((element) => element.remove());
  });

  it('renders the configured payment button when fine context is available', async () => {
    const fixture = await createComponent({
      formBaseUrl: 'https://form.gov.sg/example',
      nameFieldId: 'name',
      patronIdFieldId: 'patron',
      amountFieldId: 'amount',
      buttonLabel: 'Pay library fine',
    });

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    expect(button?.textContent?.trim()).toBe('Pay library fine');
  });

  it('hides the button when runtime FormSG config is missing', async () => {
    const fixture = await createComponent({});

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    expect(button).toBeNull();
  });

  it('keeps the existing payment URL stable when clicked', async () => {
    const fixture = await createComponent({
      formBaseUrl: 'https://form.gov.sg/example',
      nameFieldId: 'name',
      patronIdFieldId: 'patron',
      amountFieldId: 'amount',
      openInSameTab: false,
    });
    const openSpy = spyOn(window, 'open');
    const component = fixture.componentInstance;

    component.hostComponent = {};
    component.pay();

    expect(openSpy).toHaveBeenCalledWith(
      jasmine.stringMatching(/^https:\/\/form\.gov\.sg\/example\?/),
      '_blank',
      'noopener,noreferrer',
    );
    expect(component.paymentState.visible).toBeTrue();
  });

  it('keeps store patron details while waiting for the visible fines balance', async () => {
    const finesPage = document.createElement('main');
    finesPage.setAttribute('data-testid', 'test-fines-page');
    finesPage.textContent = 'Loading fines';
    document.body.appendChild(finesPage);

    const storeState = new BehaviorSubject({
      user: {
        profile: {
          name: 'Asha Kumar',
          patronId: 'A1234567',
        },
      },
    });

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [PayNowPaymentComponent],
      providers: [
        {
          provide: 'MODULE_PARAMETERS',
          useValue: {
            formBaseUrl: 'https://form.gov.sg/example',
            nameFieldId: 'name',
            patronIdFieldId: 'patron',
            amountFieldId: 'amount',
          },
        },
        {
          provide: Store,
          useValue: storeState,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PayNowPaymentComponent);
    fixture.componentInstance.hostComponent = {};
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    finesPage.textContent = 'Current fines balance is 0.40 SGD';
    (fixture.componentInstance as unknown as { refreshPaymentState: () => void }).refreshPaymentState();
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    expect(button?.textContent?.trim()).toBe('Pay via PayNow');
    expect(fixture.componentInstance.paymentState.paymentUrl).toContain('amount=0.40');
  });
});

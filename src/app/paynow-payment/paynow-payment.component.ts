import {
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { distinctUntilChanged, map, Subscription } from 'rxjs';
import { normalizePaymentConfig, PaymentConfig } from './payment-config';
import {
  extractPatronFineContext,
  patronFineContextsEqual,
  PatronFineContext,
} from './payment-context';
import { getPaymentState, PaymentState } from './payment-state';

@Component({
  selector: 'primo-nde-paynow-payment',
  templateUrl: './paynow-payment.component.html',
  styleUrls: ['./paynow-payment.component.scss'],
})
export class PayNowPaymentComponent implements OnInit, OnChanges, OnDestroy {
  @Input() hostComponent: unknown;

  readonly paymentConfig: PaymentConfig;
  paymentState: PaymentState;

  private storeSubscription?: Subscription;

  constructor(
    @Optional() @Inject('MODULE_PARAMETERS') moduleParameters: unknown,
    @Optional() private readonly store: Store<unknown> | null,
  ) {
    this.paymentConfig = normalizePaymentConfig(moduleParameters);
    this.paymentState = getPaymentState(this.paymentConfig, null);
  }

  ngOnInit(): void {
    this.refreshPaymentState(null);

    if (!this.store) {
      return;
    }

    this.storeSubscription = this.store.pipe(
      map((state) => extractPatronFineContext(this.hostComponent, state)),
      distinctUntilChanged(patronFineContextsEqual),
    ).subscribe((context) => this.refreshPaymentState(context));
  }

  ngOnChanges(): void {
    this.refreshPaymentState(null);
  }

  ngOnDestroy(): void {
    this.storeSubscription?.unsubscribe();
  }

  pay(): void {
    if (!this.paymentState.paymentUrl) {
      return;
    }

    if (this.paymentConfig.openInSameTab) {
      window.location.assign(this.paymentState.paymentUrl);
      return;
    }

    window.open(this.paymentState.paymentUrl, '_blank', 'noopener,noreferrer');
  }

  private refreshPaymentState(storeContext: PatronFineContext | null): void {
    const context = extractPatronFineContext(this.hostComponent, storeContext);
    this.paymentState = getPaymentState(this.paymentConfig, context);
  }
}

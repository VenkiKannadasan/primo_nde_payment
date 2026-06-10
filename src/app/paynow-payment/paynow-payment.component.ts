import {
  Component,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
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
  private pageObserver?: MutationObserver;

  constructor(
    @Inject(DOCUMENT) private readonly documentRef: Document,
    @Optional() @Inject('MODULE_PARAMETERS') moduleParameters: unknown,
    @Optional() private readonly store: Store<unknown> | null,
  ) {
    this.paymentConfig = normalizePaymentConfig(moduleParameters);
    this.paymentState = getPaymentState(this.paymentConfig, null);
  }

  ngOnInit(): void {
    this.refreshPaymentState(null);
    this.watchPageForFinesBalance();

    if (!this.store) {
      return;
    }

    this.storeSubscription = this.store.pipe(
      map((state) => extractPatronFineContext(this.documentRef, this.hostComponent, state)),
      distinctUntilChanged(patronFineContextsEqual),
    ).subscribe((context) => this.refreshPaymentState(context));
  }

  ngOnChanges(): void {
    this.refreshPaymentState(null);
  }

  ngOnDestroy(): void {
    this.storeSubscription?.unsubscribe();
    this.pageObserver?.disconnect();
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
    const context = extractPatronFineContext(this.documentRef, this.hostComponent, storeContext);
    const nextPaymentState = getPaymentState(this.paymentConfig, context);

    if (
      this.paymentState.visible === nextPaymentState.visible
      && this.paymentState.paymentUrl === nextPaymentState.paymentUrl
      && this.paymentState.reason === nextPaymentState.reason
    ) {
      return;
    }

    this.paymentState = nextPaymentState;
  }

  private watchPageForFinesBalance(): void {
    if (typeof MutationObserver === 'undefined' || !this.documentRef.body) {
      return;
    }

    this.pageObserver = new MutationObserver(() => this.refreshPaymentState(null));
    this.pageObserver.observe(this.documentRef.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
}

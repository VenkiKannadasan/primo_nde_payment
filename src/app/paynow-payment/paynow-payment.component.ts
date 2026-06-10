import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Optional,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Store } from '@ngrx/store';
import { distinctUntilChanged, Subscription } from 'rxjs';
import { normalizePaymentConfig, PaymentConfig } from './payment-config';
import {
  extractPatronFineContext,
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
  private balancePollingIntervalId?: number;
  private balancePollingAttempts = 0;
  private latestStoreState?: unknown;

  constructor(
    @Inject(DOCUMENT) private readonly documentRef: Document,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    @Optional() @Inject('MODULE_PARAMETERS') moduleParameters: unknown,
    @Optional() private readonly store: Store<unknown> | null,
  ) {
    this.paymentConfig = normalizePaymentConfig(moduleParameters);
    this.paymentState = getPaymentState(this.paymentConfig, null);
  }

  ngOnInit(): void {
    this.refreshPaymentState();
    this.watchPageForFinesBalance();
    this.startBalancePolling();

    if (!this.store) {
      return;
    }

    this.storeSubscription = this.store.pipe(
      distinctUntilChanged(),
    ).subscribe((state) => {
      this.latestStoreState = state;
      this.refreshPaymentState();
    });
  }

  ngOnChanges(): void {
    this.refreshPaymentState();
  }

  ngOnDestroy(): void {
    this.storeSubscription?.unsubscribe();
    this.pageObserver?.disconnect();
    this.stopBalancePolling();
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

  private refreshPaymentState(): void {
    const context = extractPatronFineContext(this.documentRef, this.hostComponent, this.latestStoreState);
    const nextPaymentState = getPaymentState(this.paymentConfig, context);

    if (
      this.paymentState.visible === nextPaymentState.visible
      && this.paymentState.paymentUrl === nextPaymentState.paymentUrl
      && this.paymentState.reason === nextPaymentState.reason
    ) {
      return;
    }

    this.paymentState = nextPaymentState;
    this.changeDetectorRef.markForCheck();

    if (nextPaymentState.visible) {
      this.stopBalancePolling();
    }
  }

  private watchPageForFinesBalance(): void {
    if (typeof MutationObserver === 'undefined' || !this.documentRef.body) {
      return;
    }

    this.pageObserver = new MutationObserver(() => {
      this.ngZone.run(() => this.refreshPaymentState());
    });
    this.pageObserver.observe(this.documentRef.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private startBalancePolling(): void {
    const windowRef = this.documentRef.defaultView;

    if (!windowRef || this.balancePollingIntervalId !== undefined) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.balancePollingIntervalId = windowRef.setInterval(() => {
        this.balancePollingAttempts += 1;

        this.ngZone.run(() => this.refreshPaymentState());

        if (this.balancePollingAttempts >= 80) {
          this.stopBalancePolling();
        }
      }, 250);
    });
  }

  private stopBalancePolling(): void {
    const windowRef = this.documentRef.defaultView;

    if (!windowRef || this.balancePollingIntervalId === undefined) {
      return;
    }

    windowRef.clearInterval(this.balancePollingIntervalId);
    this.balancePollingIntervalId = undefined;
  }
}

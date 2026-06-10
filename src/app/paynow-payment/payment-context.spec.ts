import { extractPatronFineContext, patronFineContextsEqual } from './payment-context';

describe('extractPatronFineContext', () => {
  it('reads the old Primo-style decoded token and fines counter when present', () => {
    const context = extractPatronFineContext({
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
    });

    expect(context).toEqual({
      patronName: 'Asha Kumar',
      patronId: 'A1234567',
      fineAmount: 15.5,
    });
  });

  it('merges patron details and fine details from separate NDE sources', () => {
    const context = extractPatronFineContext(
      {
        finesCounters: 'SGD 8.20',
      },
      {
        user: {
          profile: {
            displayName: 'Wei Lin',
            primaryId: 'U998877',
          },
        },
      },
    );

    expect(context).toEqual({
      patronName: 'Wei Lin',
      patronId: 'U998877',
      fineAmount: 8.2,
    });
  });

  it('sums fine-like arrays when NDE exposes itemized fines', () => {
    const context = extractPatronFineContext({
      displayName: 'Daniel Lee',
      patronId: 'D100',
      fines: [
        { amount: 1.25 },
        { amountDue: 'SGD 2.75' },
      ],
    });

    expect(context?.fineAmount).toBe(4);
  });

  it('returns null when required patron fields are missing', () => {
    expect(extractPatronFineContext({ finesCounters: 3 })).toBeNull();
  });
});

describe('patronFineContextsEqual', () => {
  it('compares complete patron fine contexts', () => {
    const context = {
      patronName: 'Asha Kumar',
      patronId: 'A1234567',
      fineAmount: 15.5,
    };

    expect(patronFineContextsEqual(context, { ...context })).toBeTrue();
    expect(patronFineContextsEqual(context, { ...context, fineAmount: 2 })).toBeFalse();
    expect(patronFineContextsEqual(context, null)).toBeFalse();
  });
});

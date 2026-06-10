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

  it('prefers the visible current fines balance over itemized fine amounts', () => {
    const page = document.createElement('main');
    page.textContent = 'Current fines balance is 0.1 SGD Active Fines Debit 0.10 SGD';

    const context = extractPatronFineContext(
      page,
      {
        displayName: 'Daniel Lee',
        patronId: 'D100',
        fines: [
          { amount: 25 },
        ],
      },
    );

    expect(context).toEqual({
      patronName: 'Daniel Lee',
      patronId: 'D100',
      fineAmount: 0.1,
    });
  });

  it('reads the patron name from a scoped profile section without using institution name', () => {
    const page = document.createElement('main');
    page.innerHTML = `
      <section aria-label="Profile">
        <p>Name: Lim Mei</p>
        <p>User ID: L100</p>
      </section>
      <section>
        <p>Current fines balance is 0.10 SGD</p>
        <p>Institution Name: Ngee Ann Polytechnic</p>
      </section>
    `;

    const context = extractPatronFineContext(
      page,
      {
        patronId: 'L100',
      },
    );

    expect(context).toEqual({
      patronName: 'Lim Mei',
      patronId: 'L100',
      fineAmount: 0.1,
    });
  });

  it('does not use fine type or item names as the patron name', () => {
    const page = document.createElement('main');
    page.textContent = 'Current fines balance is 0.10 SGD';

    const context = extractPatronFineContext(
      page,
      {
        patronId: 'D100',
        fines: [
          {
            name: 'Other',
            fineType: {
              name: 'Active',
            },
            amount: 25,
          },
        ],
      },
    );

    expect(context).toBeNull();
  });

  it('uses profile-scoped name fields instead of fine item names', () => {
    const page = document.createElement('main');
    page.textContent = 'Current fines balance is 0.10 SGD';

    const context = extractPatronFineContext(
      page,
      {
        patronId: 'D100',
        user: {
          profile: {
            name: 'Daniel Lee',
          },
        },
        fines: [
          {
            name: 'Other',
            fineType: {
              name: 'Active',
            },
            amount: 25,
          },
        ],
      },
    );

    expect(context).toEqual({
      patronName: 'Daniel Lee',
      patronId: 'D100',
      fineAmount: 0.1,
    });
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

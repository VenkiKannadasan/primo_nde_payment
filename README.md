# primo_nde_payment

Primo NDE add-on module that places a PayNow payment button in the Fines/Fees area and redirects patrons to a FormSG payment form with patron details and the outstanding fine amount prefilled.

The project is based on Ex Libris' `customModule` Angular/module-federation scaffold. It can be deployed as a hosted NDE add-on through Alma Add-on Configuration, and it can still be built into a Primo view customization package as a fallback.

## Requirements

- Node.js 22 is recommended. This repository includes `.nvmrc` and `.node-version`.
- npm 10 or later.
- A public HTTPS static host for the preferred hosted add-on deployment.

The current local machine may report a newer Node version. Use Node 22 for normal development and release builds.

## Install and Build

```bash
nvm use
npm install
npm run test:ci
npm run build
```

The build runs the Ex Libris prebuild/postbuild scripts. Outputs are written to `dist/`, including:

- `dist/custom-module/` during the Angular build phase.
- `dist/PRIMO-NDE/` and `dist/PRIMO-NDE.zip` after postbuild for view-package fallback.
- `remoteEntry.js` inside the built output for hosted add-on configuration.

Set `INST_ID` and `VIEW_ID` in `build-settings.env` before creating a production view package ZIP.

## Alma Runtime Configuration

Use this JSON in Alma's Add-on Configuration. Update the FormSG field IDs for each library or FormSG form.

```json
{
  "formBaseUrl": "https://form.gov.sg/YOUR_FORM_ID",
  "nameFieldId": "YOUR_NAME_FIELD_ID",
  "patronIdFieldId": "YOUR_PATRON_ID_FIELD_ID",
  "outstandingAmountFieldId": "YOUR_TOTAL_OUTSTANDING_AMOUNT_FIELD_ID",
  "amountFieldId": "YOUR_PAYMENT_AMOUNT_FIELD_ID",
  "amountMultiplier": 1,
  "buttonLabel": "Pay via PayNow",
  "openInSameTab": true
}
```

The add-on hides the button when any required FormSG config is missing, the patron context is unavailable, or the fine amount is zero or invalid.

Use `amountMultiplier: 1` when FormSG should receive the same displayed SGD amount. For example, `0.40 SGD` is sent as `0.40`. Only use another multiplier if a payment form explicitly requires a different unit.

`outstandingAmountFieldId` is optional. Use it when the FormSG form has a separate read-only/display field for the total outstanding fines or fees amount in addition to the actual payment amount field.

To temporarily remove the PayNow button during a payment gateway or FormSG issue, deactivate or disable this add-on in Alma for the affected view. No JSON flag is required.

## NDE Hook

The component is registered in `src/app/custom1-module/customComponentMappings.ts` for:

```ts
['nde-fines-after', PayNowPaymentComponent]
```

Confirm this selector in your Primo NDE staging tenant before production activation. If Ex Libris exposes a different Fines/Fees hook for your tenant, update this one mapping entry.

## Hosted Add-On Deployment

1. Build the project with Node 22.
2. Upload the built add-on folder containing `remoteEntry.js` to an HTTPS static host.
3. In Alma, create or update the NDE Add-on Configuration:
   - Add-on name: `primo_nde_payment`
   - URL: the hosted folder URL that contains `remoteEntry.js`
   - View scope: the Primo NDE view(s) where the button should appear
   - Parameters: the runtime JSON above
4. Activate in staging first, then test with signed-in patrons.

Each library can reuse the same hosted code and supply its own FormSG URL and field IDs in Alma.

## View Package Fallback

If a hosted add-on URL is not available, upload the generated `dist/<INST_ID>-<VIEW_ID>.zip` through the Primo NDE customization package flow for the target view.

## Smoke Test Checklist

- Signed-out users do not see the button.
- Signed-in users with zero fines do not see the button.
- Signed-in users with fines see one PayNow button in the Fines/Fees tab.
- Clicking the button opens FormSG in the configured tab mode.
- FormSG receives patron name, patron ID, total outstanding amount when configured, and payment amount.
- Mobile layout keeps the button readable and tappable.

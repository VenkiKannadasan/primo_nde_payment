# primo_nde_payment Deployment Notes

## Hosted Add-On

Use hosted add-on deployment for sharing this module across libraries. Alma stores the add-on URL and each library's runtime JSON, while the static host serves the built JavaScript bundle.

Required hosting behavior:

- HTTPS URL reachable from patron browsers.
- Static serving of `remoteEntry.js`, JavaScript chunks, CSS, and assets.
- No authentication wall in front of the add-on bundle.
- CORS headers that allow Primo NDE to load the module.

## Runtime Parameters

The module expects flat JSON parameters:

```json
{
  "formBaseUrl": "https://form.gov.sg/YOUR_FORM_ID",
  "nameFieldId": "YOUR_NAME_FIELD_ID",
  "patronIdFieldId": "YOUR_PATRON_ID_FIELD_ID",
  "amountFieldId": "YOUR_PAYMENT_AMOUNT_FIELD_ID",
  "amountMultiplier": 100,
  "buttonLabel": "Pay via PayNow",
  "openInSameTab": true
}
```

`amountMultiplier` defaults to `100` to preserve the existing Primo `common.js` behavior: a fine value such as `12.34` is sent to FormSG as `1234.00`.

## Staging Validation

Before production activation:

1. Confirm the NDE hook selector `nde-fines-after` renders in the Fines/Fees tab.
2. Confirm patron name and ID are available from the NDE host/store in your tenant.
3. Confirm FormSG accepts the amount format from your configured payment amount field.
4. Confirm browser back navigation returns to Primo NDE cleanly.

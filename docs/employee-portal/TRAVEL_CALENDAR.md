# ShoreVest One Travel Calendar

## Purpose

ShoreVest One can temporarily change the dashboard location when the signed-in employee is travelling. The employee's normal location remains the default. An active event in a dedicated Outlook calendar named `Travel` overrides it for the event period.

## Employee setup

1. In Outlook, create a separate calendar named `Travel`.
2. Add one all-day or timed event covering each trip.
3. Put the supported city in the event's **Location** field, for example `Dubai`, `New York`, `San Francisco`, `Riyadh` or `Singapore`.
4. Do not rely on the subject or body. ShoreVest One does not request either field.

When an event is active, the dashboard uses that city automatically. A manual location selection overrides the calendar for the current browser session. The **Use Travel calendar** action restores automatic selection.

## Privacy and permissions

- Authentication remains delegated Microsoft Entra ID sign-in with PKCE.
- The app requests delegated `Calendars.ReadBasic`, not application-wide mailbox access.
- The adapter searches only for a calendar whose exact name matches the configured `travelCalendarName`.
- The event query selects only `start`, `end`, `location`, `locations`, `isAllDay` and `sensitivity`.
- Event subject, body, attendees, attachments and extensions are not requested.
- No calendar data is written to Dataverse, SharePoint, Salesforce or localStorage.
- The result is held in browser memory for ten minutes and reduced to current location plus trip end time.

## Deployment configuration

The optional `travel-calendar-config.js` layer adds the required delegated scope and default calendar name:

```js
entra: {
  scopes: ['User.Read', 'Calendars.ReadBasic']
},
calendar: {
  travelCalendarName: 'Travel'
}
```

The Entra app registration must include delegated Microsoft Graph permission `Calendars.ReadBasic`. The production content security policy must allow `https://graph.microsoft.com` in `connect-src`.

## Failure behaviour

The integration fails open for dashboard convenience but closed for privacy:

- If the Travel calendar is missing, no events are read from another calendar.
- If permission or Microsoft Graph is unavailable, the dashboard keeps the employee's default location.
- If the event location does not match a supported financial centre, the dashboard does not guess.
- Calendar failure never blocks the rest of ShoreVest One.

## Demonstration mode

The repository remains in `demo` mode and makes no Microsoft Graph request. A clearly labelled synthetic Dubai trip demonstrates the automatic override. Disable or change it under `calendar.demoCurrentTrip`.

# GridGuard Tshwane responsive PWA

## What I’ll build
- Replace the blank page with a polished City of Tshwane outage-management prototype.
- Create a responsive operations shell for laptop, desktop, and tablet, with role switching for Customer, Dispatcher, Technician, and Operations.
- Make the Dispatcher view the first screen: live incident map, priority queue, response metrics, technician availability, and assignment workflow.
- Add complete role-specific screens: a fast outage report and tracking view, field job progress and documentation, and city-wide analytics.
- Use realistic Tshwane sample incidents and a clear blue, orange, red, green, and neutral status system.

## Interaction and accessibility
- Make role switching, queue filtering, incident selection, report submission, technician assignment, status progression, and export controls interactive.
- Keep every control keyboard accessible, labelled for screen readers, and large enough for touch use.
- Provide high-contrast focus states, clear non-color status labels, readable density, and responsive layouts that do not clip on tablet widths.

## PWA support
- Add install metadata, an app icon, and guarded offline support.
- Cache the application shell only on published builds; keep previews free from stale service-worker caching.
- Show network/sync state and keep prototype actions usable with local demo state.

## Technical details
- Use the existing React 19 and TanStack Start app with Tailwind CSS v4 semantic design tokens.
- Build focused React components and use Lucide icons for familiar controls.
- Add route-specific title, description, Open Graph, and Twitter metadata.
- Validate the finished experience in desktop and tablet viewports, including core interactions and accessibility basics.

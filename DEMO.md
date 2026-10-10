# Presenting the LesediLink simulation

This is the checklist for showing the system live. Everything on screen is a real, running simulation: sensors, reports, dispatching, technicians, alerts and the manager's numbers all change as people act.

## Set up (two minutes)

1. Start the app with `npm run dev` and open the address it prints.
2. **Use one browser window and open one tab per person.** Every tab is its own login, and all tabs share the same data. Do **not** use a second browser, an incognito window or a phone for this: those cannot see each other's data yet (there is no backend), so they will look as if nothing updates.
3. Log each tab in with the **Quick tap login** buttons on the login page. The one-time code is shown on screen.
4. In a dispatcher tab, press **Reset simulation** (in the Sensor node network panel). This clears every report, job and outage in every tab and starts from a quiet city.

Tip: allow location for the site, and tap the bell then **Turn on** to allow device notifications, so the alerts also appear when a tab is in the background.

## Who to log in as

| Role | Accounts |
| --- | --- |
| Residents | Nomsa Mahlangu and Bongani Sithebe (Soshanguve Block H), Sipho Ndlovu and Lerato Sithole (Mamelodi East), Naomi Botha (Hatfield), Karabo Mokwena (Pretoria CBD), Zinhle Khoza (Centurion) |
| Technicians | Thabo Molefe and Mpho Sekhukhune (Soshanguve depot), Maria Dlamini and Fatima Patel (Pretoria Central), James Nkosi and Sizwe Cele (Pretoria East), Ayanda Zulu and Themba Nxumalo (Mamelodi), Lindiwe Khumalo and Pieter van Wyk (Centurion) |
| Dispatchers | Naledi Mokoena (senior), Tumelo Radebe (northern region), Zanele Dube (eastern region) |
| Manager | Kagiso Phiri |

The passwords for the typed login are in `src/components/lesedi/data.ts`.

## The story to tell: "I'm away from home when the power goes off"

Open four tabs: **Nomsa** (resident), **Naledi** (dispatcher), **Mpho** (technician) and **Kagiso** (manager).

1. **Nomsa lives in Soshanguve Block H but is visiting Mamelodi.** Her dashboard shows "Power is on at home" and "You are about N km from home".
2. **Naledi presses "Cut power" on Soshanguve Block H.** The sensors go quiet. After about ten seconds the system opens an outage on its own.
3. **Nomsa gets an alert straight away**, although she is 35 km from home: a pop-up, an unread count on the bell, a device notification, and the Home card turns red with a live tracker.
4. **A dispatcher assigns Mpho** (select the outage, pick Mpho, Dispatch). Mpho's dashboard receives the job instantly with an alert. Nomsa is told a technician was assigned.
5. **Mpho works the job:** a new job must be answered first. **Accept job**, or **Decline job** with a reason (the job goes straight back to the dispatcher's queue marked "Declined by Mpho · reassign", with the reason, and the dispatcher gets an alert). "Simulate drive" stays off until the job is accepted. If the dispatcher reassigned or withdrew the job in another tab meanwhile, Mpho is told so instead of the answer going through. After accepting: I'm on my way. Then arrival, which needs his position:
   - **On a laptop, press "Simulate drive (demo)"** in the Directions bar. The marker drives along the real road route, the resident watches it move, and the position stays at the destination when it finishes, so "I've arrived" then passes.
   - **If arrival is still refused** (a laptop's location can be kilometres out), open **"GPS not working? Confirm arrival yourself"** under the button, pick a reason and confirm. The job carries on and the control centre sees it was not GPS-backed. Use this if anything stalls on the day.
   - On site, he chooses **Start repairs** (30 minutes, or longer for a complex fault) or **Awaiting parts** (2 hours unless he picks longer; the work notes must say which parts). Each choice sets a new ERT that Nomsa sees on her tracker.
   - From Awaiting parts: **Parts arrived · start repairs**. Then **Repair done · start testing**, then **Mark resolved · power restored**.
6. **The repair restores power in the simulation.** The sensors see it return, the outage closes, and Nomsa gets "Power restored". Her bell tells the whole story.
7. **The dispatcher closes it.** A sensor outage has no reporter to ask for feedback, so it waits under "Resolved · awaiting closure" until the dispatcher presses Close. For an outage a resident *reported*, a "How did we do?" card appears on their dashboard once it is resolved (stars, whether they were kept informed, and a comment), and their feedback closes the incident. Residents who only **followed** the outage get the same card and can rate it too (their rating counts towards satisfaction but does not close the incident). Once an outage is closed, or resolved and rated, it is cleared from the resident's dashboard and stays only in "My report history". Show this with a "Just my home" report.
8. **Kagiso's numbers moved by themselves:** outages today, response time, resolution time, share within the 2-hour ERT, status reports on time, parts and repair deadlines met, customer satisfaction, residents' comments, hotspots and technician performance. "Export report" downloads a CSV.

**The resident watches the technician the whole way.** From the moment the job is accepted until it is finished, the resident's tracker shows the technician's live position: a route and an ETA while driving, then "on site now" during the repair.

Other things worth showing:

- **First-visit guide for residents:** the first time a resident opens their dashboard, a step-by-step guide walks them through it on cue cards. Each card lights up the part of the page it explains, with **Back**, **Next** and **Skip guide**. It does not open again once finished or skipped, but **How it works** at the top of the page replays it. To show it as a first visit again, use a resident who has not opened their dashboard in this browser, sign up a new resident, or clear the site data (Reset simulation keeps it).

- **A home visit with a Visit code:** a resident chooses "Just my home". When the technician taps "I've arrived", **the technician's app shows a 6-digit Visit code**. They give it to the resident, who enters it on their dashboard to confirm this is the technician the city sent. The job then moves to "On site". At the end the resident confirms "Yes, my power is back".
- **Complaint lists:** after choosing what is happening, the resident picks the exact problem from a drop-down list. Free text appears only for "Something else", and is limited to 100 characters.
- **Duplicates:** when a second resident picks the **same type and the same complaint within 1 km** of an open report, the app shows "This problem is already reported nearby" and offers "Follow this outage". When the complaint is **exactly the same**, "Send outage report" is switched off for that resident, so the same problem cannot be filed twice; it is also off for anyone re-reporting a fault they already reported. Complaints that describe the same fault in different words still go through and are merged: "The whole street has no power" and "Several houses have no power" are one fault. "Just my home" and "Something else" reports are never merged.
- **Related, not duplicate:** cut power in an area, then report damage or "Just my home" inside it as a resident. The resident is told the sensors already know about the outage. For a home outage they are offered "Follow the outage" instead. The dispatcher sees "Probably related" on both incidents, with the crew already working the outage, so one crew can handle both.
- **Maps that follow the action:** the technician and resident maps keep everyone in view as they move. Zoom or drag the map and it stays where you put it. Tap **Show everything** to bring everyone back into view.
- **Additional crew:** a technician on a job opens **Request additional crew** at the bottom of their job panel, picks a reason and how many extra technicians they need, and sends it. Every other technician gets an alert with **Accept** and **Decline**, in the pop-up, in the bell and on their dashboard. The one who accepts gets the route, ETA (arrival clock time and minutes), turn list and "Simulate drive" to that job, then taps "I've arrived to help". The requester sees who is coming and each helper's ETA. The dispatcher sees the request in the job feed and on the crew board. Open two technician tabs to show it.
- **Storm scenario:** the "Storm" button cuts three areas at once, so the queue fills up and you can dispatch several crews.
- **Who is online:** the dispatcher's header shows how many crews and dispatchers are online, and a technician whose window is closed shows as offline.

## Expected response times and status reports

- Every logged fault has an **ERT of 2 hours**: a crew should be on site by then.
- From allocation until the job is resolved, the technician owes a **status report every 30 minutes** ("Send status report"). While awaiting parts or repairing, the report is due at that phase's ERT instead.
- A technician can **extend the ERT** with a reason. The resident is told the new time, and performance is still measured on the first ERT.
- Overdue reports and passed ERTs show in red on the dispatcher's queue, the job feed and the manager's dashboard.
- The stages are: Accepted, En route, On site, Awaiting parts (only if needed), Repairs in progress, Testing, Resolved, Closed.

## If a technician cannot move a job forward

The stage list is a status display, not a set of buttons. The job moves with the **buttons at the bottom of the "Update job progress" panel**, which change with each stage. At "En route" that button is replaced by the arrival step, so the job only moves once arrival is confirmed, by GPS or by hand with a reason.

## If something looks like it is "not updating"

- Are all the windows tabs of the **same browser**? Different browsers, incognito windows and other devices do not share data.
- Look at the dispatcher's header. If a technician you expect is not counted as online, that window is not sharing data with this one.
- Look at the sensor panel: "Sensors checked N s ago" should stay under a few seconds. The sensors run in whichever open dashboard tab holds the engine, and move to another tab if that one closes.
- A technician who is not signed in still receives a dispatched job. It appears as soon as they sign in, and the dispatcher is warned that they are offline.

## What is simulated

- The sensor network, the roads and the technicians' movement (when using "Simulate drive").
- Text messages: nothing is sent. The login code is shown on screen.
- Device alerts work while a tab is open, in the foreground or the background. A phone that is completely closed needs a push service and a server, which is a pilot-phase item.
- Manager budget and the earlier days on the response-time chart are sample figures and are labelled that way.

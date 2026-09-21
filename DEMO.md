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
5. **Mpho works the job:** Save and continue (accepted), Save and continue (en route). Then arrival, which needs his position:
   - **On a laptop, press "Simulate drive (demo)"** in the Directions bar. The marker drives along the real road route, the resident watches it move, and the position stays at the destination when it finishes, so "I've arrived" then passes.
   - **If arrival is still refused** (a laptop's location can be kilometres out), open **"GPS not working? Confirm arrival yourself"** under the button, pick a reason and confirm. The job carries on and the control centre sees it was not GPS-backed. Use this if anything stalls on the day.
   - Then Save and continue (in progress) and **Mark job complete**.
6. **The repair restores power in the simulation.** The sensors see it return, the outage closes, and Nomsa gets "Power restored". Her bell tells the whole story.
7. **Kagiso's numbers moved by themselves:** outages today, response time, resolution time, SLA compliance, hotspots and technician performance. "Export report" downloads a CSV.

**The resident watches the technician the whole way.** From the moment the job is accepted until it is finished, the resident's tracker shows the technician's live position: a route and an ETA while driving, then "on site now" during the repair.

Other things worth showing:

- **A home visit with a PIN:** a resident chooses "Just my home". When the technician arrives, the resident gets a 6-digit Visit PIN to read out at the gate, and confirms "Yes, my power is back" at the end.
- **Duplicates:** a second resident near an existing outage is offered "Follow this outage" instead of filing another report.
- **Storm scenario:** the "Storm" button cuts three areas at once, so the queue fills up and you can dispatch several crews.
- **Who is online:** the dispatcher's header shows how many crews and dispatchers are online, and a technician whose window is closed shows as offline.

## If a technician cannot move a job forward

"In progress" and "Complete" are not buttons in the stage list: that list is a status display. The job moves with the **big button at the bottom of the "Update job progress" panel**. At "En route" that button is replaced by the arrival step, so the job only moves once arrival is confirmed, by GPS or by hand with a reason.

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

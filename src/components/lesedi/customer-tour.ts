import type { TourStep } from "@/lib/tour";

/**
 * The resident's first-visit guide, in the order the dashboard reads from top to bottom. Parts that only
 * appear later (the repair tracker, the Visit code, the rating card) are explained here too, so the resident
 * knows what to expect; while they are not on the page their cards show in the middle of the screen.
 */
export function customerTourSteps(firstName: string): TourStep[] {
  return [
    {
      title: `Welcome to LesediLink, ${firstName}`,
      body: "This short guide shows you how to report a power problem and follow the repair until your lights are back on. Use Next and Back to move between cards, or Skip guide to start straight away.",
    },
    {
      target: "report-button",
      title: "Report an outage",
      body: "Tap here whenever your power is off or you see damaged equipment. It takes you to the report form and finds your location for you.",
    },
    {
      target: "notifications",
      title: "Your alerts",
      body: "The bell shows every update about your outages: a technician assigned, on the way, on site, power restored. Tap it, then “Turn on”, to get alerts on this device even when the app is in the background.",
    },
    {
      target: "home",
      title: "Your home area",
      body: "This card watches the area on your account. It turns red if the power goes off at home, and we alert you wherever you are, even if you are far from home.",
    },
    {
      target: "area-check",
      title: "Is it already reported?",
      body: "Tap “Check my area” to see outages near you. If a neighbour already reported your fault, tap “Follow this outage” to get the same live updates. You do not need to report it again.",
    },
    {
      target: "my-tracker",
      title: "Follow the repair live",
      body: "Once you report or follow an outage, a live tracker shows here: each step of the repair, the technician's first name, where they are on the map, their ETA (when they should arrive) and the time the work should be done by.",
    },
    {
      target: "report-location",
      title: "1. Where is the fault?",
      body: "Tap “Use my location” so the crew can find the fault. If your location is not right, tap “Adjust on map” and drop the pin yourself.",
    },
    {
      target: "report-type",
      title: "2. What is happening?",
      body: "Choose “Just my home”, “My street or area” or “Sparks, fallen line or damage”, then pick the exact problem from the list. If someone nearby already reported the same problem, sending is switched off and you can follow theirs instead.",
    },
    {
      target: "report-contact",
      title: "3. Your contact number",
      body: "We use the cell number on your account, so there is nothing to type. Tap “Change” if the crew should call a different number.",
    },
    {
      target: "report-extras",
      title: "4. Landmark and photos (optional)",
      body: "Add a landmark, such as the blue gate next to the spaza shop, or a photo or short video. It helps the crew find and understand the fault. Keep a safe distance from damaged equipment.",
    },
    {
      target: "report-send",
      title: "5. Send your report",
      body: "Tap “Send outage report”. You get a reference number straight away. If your connection drops, the report is saved and sent automatically.",
    },
    {
      title: "When the technician comes to your home",
      body: "For a “Just my home” report, the technician gives you a Visit code at your gate. Enter it on this dashboard. Only let them in once it matches. When the repair is done, we ask you to confirm your power is back.",
    },
    {
      title: "Tell us how we did",
      body: "When the outage is fixed, a “How did we do?” card appears here, whether you reported the outage or followed it. Rate the service and add a comment if you like. The finished report then clears from your dashboard.",
    },
    {
      target: "summary",
      title: "Your summary",
      body: "A quick look at your supply status, your open reports, the next planned outage and alerts for your area.",
    },
    {
      target: "notices",
      title: "Notices for your area",
      body: "Planned maintenance, load reduction and outages our sensors detect in your area show here, so you can plan ahead.",
    },
    {
      target: "history",
      title: "Your report history",
      body: "Every report you have sent stays here with its reference number, how long it took to fix and the rating you gave.",
    },
    {
      target: "tour-replay",
      title: "You are ready",
      body: "That is everything. If you want to see this guide again, tap “How it works” at the top of the page.",
    },
  ];
}

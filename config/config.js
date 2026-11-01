// config.js - Alag-alag stages ke liye alag-alag Zoom links aur timing
export const ZOOM_LINKS = {
  planShow: {
    link: "https://us04web.zoom.us/j/plan_show_link_here",
    time: "06:00 PM",
    description: "Naye logo ke liye jo pehli baar plan dekhenge"
  },
  training: {
    link: "https://us04web.zoom.us/j/training_link_here",
    time: "08:00 PM",
    description: "Jin logo ne token money de diya hai unke liye training"
  },
  leadership: {
    link: "https://us04web.zoom.us/j/leadership_link_here",
    time: "09:00 PM",
    description: "Leaders aur active team members ke liye"
  }
};

// State machine (conversation/state_machine.js) yahin se ZOOM_TIME / ZOOM_LINK padhta hai.
export const ZOOM_TIME = ZOOM_LINKS.planShow.time;
export const ZOOM_LINK = ZOOM_LINKS.planShow.link;

// Step 3 & 4: sirf inhi leaders ka naam aane par flow aage badhta hai.
export const ACCEPTED_LEADERS = ["Rahul Sir", "Rahul Dewangan"];

// Step 13+: payment-day follow-up delay.
export const FOLLOWUP_HOURS = 24;

export default { ZOOM_LINKS, ZOOM_TIME, ZOOM_LINK, ACCEPTED_LEADERS, FOLLOWUP_HOURS };

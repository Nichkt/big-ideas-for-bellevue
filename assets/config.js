/*
  Contest settings. Edit this file to change names, dates, prizes and sponsors.
  Nothing here is secret. The Supabase "anon" key is meant to be public.
*/
window.CONTEST = {
  name: "Big Ideas for Bellevue",
  season: "2027",
  tagline: "A scholarship contest for Bellevue students, kindergarten through 12th grade.",

  // Set to false once dates, prizes and partners are confirmed. While true,
  // every page shows a notice that details are not final.
  draft: true,

  // Shown in the footer and on the sponsor page. Leave blank to hide.
  contactEmail: "",
  organizer: "Bellevue community volunteers",

  // Backend. Leave both blank to run the site in demo mode (forms do not save).
  // See README.md for setup.
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Replace each TBD with a date, for example "March 5, 2027".
  dates: {
    submissionsOpen: "TBD",
    submissionsClose: "TBD",
    judgingOpens: "TBD",
    judgingCloses: "TBD",
    winnersAnnounced: "TBD",
    presentations: "TBD"
  },

  grades: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],

  // Essay word limits by grade band.
  wordLimits: [
    { label: "Kindergarten to 2nd grade", grades: ["K", "1", "2"], max: 150, note: "An adult may type the student's own words." },
    { label: "3rd to 5th grade", grades: ["3", "4", "5"], max: 300, note: "" },
    { label: "6th to 8th grade", grades: ["6", "7", "8"], max: 500, note: "" },
    { label: "9th to 12th grade", grades: ["9", "10", "11", "12"], max: 750, note: "" }
  ],

  // City of Bellevue departments an idea can be addressed to.
  departments: [
    "Parks & Community Services",
    "Transportation",
    "Utilities",
    "Community Development",
    "Development Services",
    "Police",
    "Fire",
    "Information Technology",
    "City Manager's Office",
    "Not sure. Help me pick."
  ],

  // PLACEHOLDER AMOUNTS. Change these before you talk to sponsors.
  // There is no cap on how many sponsors can join at any level.
  sponsorTiers: [
    {
      name: "Presenting sponsor",
      amount: "$5,000",
      perks: [
        "Name and logo at the top of every page",
        "A few minutes to speak at the awards event",
        "Named in all press and school outreach"
      ]
    },
    {
      name: "Grade sponsor",
      amount: "$1,000",
      perks: [
        "Name and logo on the sponsor page",
        "Named next to a grade of your choice when winners are announced",
        "Thanked by name at the awards event"
      ]
    },
    {
      name: "Community sponsor",
      amount: "$250",
      perks: [
        "Name listed on the sponsor page"
      ]
    }
  ],

  // Confirmed sponsors. Example: { name: "Acme Bakery", tier: "Grade sponsor", grade: "3", url: "https://..." }
  sponsors: []
};

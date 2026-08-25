// program.js
// Structured version of the 7-day UL Sport Arena strength program.
// Each day has: key, label, subtitle, type ("lift" | "swim" | "rest"),
// warmup / cooldown notes, and an exercises[] list.
// Each exercise has: name, target (sets x reps display string),
// defaultSets (number of set rows to render), repHint (placeholder text).

const PROGRAM = [
  {
    key: "mon",
    label: "Monday",
    dayName: "Lower Body / Glutes",
    subtitle: "~50 min · Work day",
    type: "lift",
    warmup: "5 min easy bike/treadmill incline walk &rarr; bodyweight squats x10, glute bridges x10, leg swings/hip circles",
    cooldown: "Hamstring / hip flexor / quad stretch, 20-30s each side",
    exercises: [
      { name: "Leg Press (machine)", target: "4 x 8-10", sets: 4, repHint: "8-10" },
      { name: "Dumbbell Romanian Deadlift", target: "3 x 8-10", sets: 3, repHint: "8-10" },
      { name: "Leg Extension (machine)", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Leg Curl (machine)", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Hip Abduction / Glute Kickback", target: "3 x 15", sets: 3, repHint: "15" },
      { name: "Standing Calf Raise", target: "3 x 15-20", sets: 3, repHint: "15-20" },
      { name: "Plank", target: "3 x 30-45s", sets: 3, repHint: "sec", isHold: true }
    ]
  },
  {
    key: "tue",
    label: "Tuesday",
    dayName: "Upper Body Push + Core",
    subtitle: "~50 min · Work day",
    type: "lift",
    warmup: "5 min easy cardio, arm circles, band/light DB shoulder rotations, 1-2 light warm-up sets on first press",
    cooldown: "Chest doorway stretch, triceps overhead stretch, shoulder cross-body stretch, 20-30s each",
    exercises: [
      { name: "Chest Press Machine (or DB Bench)", target: "4 x 8-10", sets: 4, repHint: "8-10" },
      { name: "Seated Shoulder Press (machine/DB)", target: "3 x 8-10", sets: 3, repHint: "8-10" },
      { name: "Incline DB Press or Pec Deck", target: "3 x 10-12", sets: 3, repHint: "10-12" },
      { name: "Lateral Raise (DB)", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Triceps Pushdown (cable)", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Cable Woodchopper / Weighted Sit-up", target: "3 x 12", sets: 3, repHint: "12" },
      { name: "Side Plank", target: "2 x 30s/side", sets: 2, repHint: "sec", isHold: true }
    ]
  },
  {
    key: "wed",
    label: "Wednesday",
    dayName: "Active Recovery: Swim + Mobility",
    subtitle: "~35-40 min · Work day · Recovery",
    type: "swim",
    warmup: null,
    cooldown: null,
    exercises: [
      { name: "Easy Swim (continuous or 4x50m easy + 4x100m steady)", target: "20-25 min", sets: 1, repHint: "min", isCardio: true },
      { name: "Mobility: hips / shoulders / thoracic spine", target: "10 min", sets: 1, repHint: "min", isCardio: true }
    ]
  },
  {
    key: "thu",
    label: "Thursday",
    dayName: "Upper Body Pull + Core",
    subtitle: "~50 min · Work day",
    type: "lift",
    warmup: "5 min easy cardio, band pull-aparts x15, scap retractions, 1-2 light warm-up sets on first pull",
    cooldown: "Lat stretch, rear delt/cross-body stretch, biceps wall stretch, 20-30s each",
    exercises: [
      { name: "Lat Pulldown (machine)", target: "4 x 8-10", sets: 4, repHint: "8-10" },
      { name: "Seated Cable Row", target: "3 x 8-10", sets: 3, repHint: "8-10" },
      { name: "Single-Arm Dumbbell Row", target: "3 x 10-12/side", sets: 3, repHint: "10-12" },
      { name: "Rear Delt Fly (machine/DB)", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Dumbbell Bicep Curl", target: "3 x 12-15", sets: 3, repHint: "12-15" },
      { name: "Lying Leg Raise", target: "3 x 12", sets: 3, repHint: "12" },
      { name: "Superman Hold", target: "3 x 20s", sets: 3, repHint: "sec", isHold: true }
    ]
  },
  {
    key: "fri",
    label: "Friday",
    dayName: "Full Body (Lighter)",
    subtitle: "~45 min · Work day · End-of-week fatigue",
    type: "lift",
    warmup: "5 min easy cardio + a couple of bodyweight squats/pushes to open up",
    cooldown: "Full-body light stretch: quads, chest, lats — 15-20s each",
    exercises: [
      { name: "Goblet Squat (dumbbell)", target: "3 x 10-12", sets: 3, repHint: "10-12" },
      { name: "Chest Press Machine", target: "3 x 10-12", sets: 3, repHint: "10-12" },
      { name: "Lat Pulldown", target: "3 x 10-12", sets: 3, repHint: "10-12" },
      { name: "Dumbbell Step-Up", target: "2 x 10/leg", sets: 2, repHint: "10" },
      { name: "Plank + Bird-Dog Circuit", target: "2 rounds", sets: 2, repHint: "round", isHold: true },
      { name: "Easy-Moderate Cardio (Watt bike / cross-trainer)", target: "10-15 min", sets: 1, repHint: "min", isCardio: true }
    ]
  },
  {
    key: "sat",
    label: "Saturday",
    dayName: "Full Body — Heaviest Session",
    subtitle: "~60-70 min · Day off",
    type: "lift",
    warmup: "8-10 min: bike/row, dynamic hip & shoulder mobility, 2 light warm-up sets on the squat before working weight",
    cooldown: "Full lower + upper stretch routine, 8-10 min. Optional 20-30 min easy recovery swim afterward.",
    exercises: [
      { name: "Barbell / Smith Machine Squat", target: "4 x 6-8", sets: 4, repHint: "6-8" },
      { name: "Romanian Deadlift (barbell or DB)", target: "3 x 8", sets: 3, repHint: "8" },
      { name: "Chest Press (machine or bench in rack)", target: "3 x 8-10", sets: 3, repHint: "8-10" },
      { name: "Lat Pulldown or Assisted Pull-up", target: "3 x 8-10", sets: 3, repHint: "8-10" },
      { name: "Walking Lunge (dumbbells)", target: "3 x 10/leg", sets: 3, repHint: "10" },
      { name: "Cable Face Pull", target: "3 x 15", sets: 3, repHint: "15" },
      { name: "Weighted Plank or Cable Crunch", target: "3 x 15", sets: 3, repHint: "15" },
      { name: "Optional Swim (recovery)", target: "20-30 min", sets: 1, repHint: "min", isCardio: true }
    ]
  },
  {
    key: "sun",
    label: "Sunday",
    dayName: "Swim (Main Session) + Mobility",
    subtitle: "~45-60 min · Day off · Full recovery",
    type: "swim",
    warmup: null,
    cooldown: null,
    exercises: [
      { name: "Warm-up Swim", target: "200m easy", sets: 1, repHint: "m", isCardio: true },
      { name: "Steady Swim", target: "4 x 100m, 30s rest", sets: 4, repHint: "100m" },
      { name: "Faster Effort Swim", target: "4 x 50m", sets: 4, repHint: "50m" },
      { name: "Cool-down Swim", target: "200m easy", sets: 1, repHint: "m", isCardio: true },
      { name: "Full-Body Stretch (hips, shoulders, spine)", target: "10-15 min", sets: 1, repHint: "min", isCardio: true }
    ]
  }
];

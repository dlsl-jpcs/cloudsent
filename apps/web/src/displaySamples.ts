import type { PrayerCategory, PublicPrayer } from "@cloudsent/contracts";

// Fictional display-only content. Never sent to the API or inserted into Supabase.
const samples: [string, string, PrayerCategory][] = [
  [
    "A little courage",
    "Lord, give me courage to ask questions, try again, and keep learning even when I feel unsure.",
    "Prayer Intention",
  ],
  [
    "For our teachers",
    "Thank you for the teachers who explain things twice, notice our progress, and remind us that we can grow.",
    "Thanksgiving",
  ],
  [
    "Before the exams",
    "May we find calm as we prepare. Help us remember what we have learned and be kind to ourselves along the way.",
    "Prayer Intention",
  ],
  [
    "You belong here",
    "May anyone who feels left out today find a welcoming seat, a friendly voice, and a reason to smile.",
    "Encouragement",
  ],
  [
    "Small beginnings",
    "A small step still moves us forward. Today, I want to be grateful for progress that no one else can see.",
    "Reflection",
  ],
  [
    "For the people we miss",
    "We remember those who made our lives brighter. May their love stay with us in the little things we do.",
    "Memorial Prayer",
  ],
  [
    "A peaceful home",
    "Bless our families with patience, understanding, and enough time to listen to one another.",
    "Prayer Intention",
  ],
  [
    "An ordinary good day",
    "Thank you for a safe journey, a shared meal, and the friends who make an ordinary school day feel special.",
    "Thanksgiving",
  ],
  [
    "One task at a time",
    "When everything feels urgent, help us slow down, take a breath, and begin with the next small task.",
    "Encouragement",
  ],
  [
    "Room for kindness",
    "May our words leave people feeling lighter. Help us choose kindness when a quick judgment would be easier.",
    "Reflection",
  ],
  [
    "For new friendships",
    "Guide us toward friendships where we can be ourselves, support each other, and grow without fear.",
    "Prayer Intention",
  ],
  [
    "Thank you for another chance",
    "I am grateful that one difficult day does not have to decide the rest of my story. Thank you for fresh starts.",
    "Thanksgiving",
  ],
  [
    "For tired students",
    "May those carrying quiet worries find rest tonight. Let tomorrow arrive with a little more hope.",
    "Prayer Intention",
  ],
  [
    "Keep going gently",
    "You do not have to do everything perfectly today. May you find the strength to keep going at your own pace.",
    "Encouragement",
  ],
  [
    "Listening well",
    "Today I want to listen without planning my reply. May I notice what someone is really trying to say.",
    "Reflection",
  ],
  [
    "In loving remembrance",
    "For the grandparents, mentors, and friends we hold in memory: thank you for the love you planted in our lives.",
    "Memorial Prayer",
  ],
  [
    "For our school community",
    "Bless everyone who makes this campus a place to learn, from the classrooms to the gates and quiet corridors.",
    "Prayer Intention",
  ],
  [
    "People who show up",
    "Thank you for the people who check in, share their notes, and stay beside us when the day is difficult.",
    "Thanksgiving",
  ],
  [
    "A brave first step",
    "May we have the courage to join a new group, start a conversation, or try something we have never done before.",
    "Encouragement",
  ],
  [
    "What matters most",
    "May we remember that grades tell only part of our story. Character, compassion, and curiosity matter too.",
    "Reflection",
  ],
  [
    "For working students",
    "Give strength to students balancing school and work. May they find support, rest, and moments of joy.",
    "Prayer Intention",
  ],
  [
    "A shared lunch",
    "Thank you for simple meals and the company around the table. May we always make room for someone new.",
    "Thanksgiving",
  ],
  [
    "After a difficult day",
    "May you find a quiet moment to breathe. One hard day does not erase the good you have done.",
    "Encouragement",
  ],
  [
    "Patience with myself",
    "I am learning that growth takes time. Help me speak to myself with the patience I would offer a friend.",
    "Reflection",
  ],
  [
    "A safe way home",
    "Watch over everyone traveling home today. May each journey end with safety, rest, and a warm welcome.",
    "Prayer Intention",
  ],
  [
    "The gift of learning",
    "Thank you for books that open new worlds, lessons that challenge us, and questions that make us curious.",
    "Thanksgiving",
  ],
  [
    "For someone starting over",
    "May a new beginning feel less lonely. Let there be people nearby who welcome your next chapter.",
    "Encouragement",
  ],
  [
    "More than a busy schedule",
    "Help us make room for stillness. May we notice the good around us instead of rushing past it.",
    "Reflection",
  ],
  [
    "For our parents",
    "Bless the people who support our education in ways we may never fully see. May they feel our gratitude.",
    "Prayer Intention",
  ],
  [
    "A reason to smile",
    "Thank you for laughter in the hallway, a thoughtful message, and the little moments that lift our spirits.",
    "Thanksgiving",
  ],
  [
    "You can ask for help",
    "May asking for help feel like a brave step, not a failure. We are not meant to carry everything alone.",
    "Encouragement",
  ],
  [
    "Choosing forgiveness",
    "Give us the patience to understand, the courage to apologize, and the wisdom to begin again with care.",
    "Reflection",
  ],
  [
    "Before a presentation",
    "Steady our voices and quiet our worries. Help us share what we know with clarity and confidence.",
    "Prayer Intention",
  ],
  [
    "For a helping hand",
    "Thank you for someone who made time to help today. May I pass that kindness along to another person.",
    "Thanksgiving",
  ],
  [
    "Hope for tomorrow",
    "May tomorrow bring a little more clarity, a little more courage, and a moment that reminds you to keep hoping.",
    "Encouragement",
  ],
  [
    "Noticing the quiet good",
    "Today I want to notice the good that does not ask for attention: patience, honesty, and everyday care.",
    "Reflection",
  ],
  [
    "For our next chapter",
    "As we prepare for what comes after school, guide us toward work and lives that bring meaning and kindness.",
    "Prayer Intention",
  ],
  [
    "Grateful for this community",
    "Thank you for a community where we can learn together, make mistakes, and help each other find our way.",
    "Thanksgiving",
  ],
  [
    "A little light",
    "May we be a source of hope for someone today, even through a simple greeting or a small act of care.",
    "Encouragement",
  ],
  [
    "Carrying love forward",
    "We honor the people we miss by carrying their kindness forward. May their memory inspire the way we care.",
    "Memorial Prayer",
  ],
];
const colors: PublicPrayer["color"][] = [
  "sky",
  "lavender",
  "gold",
  "rose",
  "sage",
  "cloud",
];

export const displaySamples: PublicPrayer[] = samples.map(
  ([title, message, category], index) => {
    const mood =
      category === "Thanksgiving"
        ? "Grateful"
        : category === "Memorial Prayer"
          ? "Sorrowful"
          : "Hopeful";
    const createdAt = new Date(Date.UTC(2026, 9, 4, 8, index)).toISOString();
    return {
      id: `display-sample-${index + 1}`,
      title,
      message,
      excerpt: message,
      color: colors[index % colors.length],
      isAnonymous: index % 4 !== 0,
      displayName: index % 4 === 0 ? "Sample student" : null,
      category: {
        id: `sample-${category}`,
        name: category,
        active: true,
        position: 0,
      },
      mood: { id: `sample-${mood}`, name: mood, active: true, position: 0 },
      createdAt,
      approvedAt: createdAt,
    };
  },
);

import type { Level } from "@/lib/types";

export interface ChorLocation {
  name: string;
  emoji: string;
  level: Level;
  roles: string[];
}

/** Locations for Chor Kaun?. "kids" ones are also used at family level. */
export const CHOR_LOCATIONS: ChorLocation[] = [
  { name: "School Classroom", emoji: "🏫", level: "kids", roles: ["Class teacher", "Monitor", "Back-bencher", "Topper", "Peon bhaiya", "New student", "Naughty kid"] },
  { name: "Zoo", emoji: "🦒", level: "kids", roles: ["Zookeeper", "Ticket seller", "Child with balloon", "Photographer", "Ice-cream wala", "Lost tourist", "Monkey feeder"] },
  { name: "Birthday Party", emoji: "🎂", level: "kids", roles: ["Birthday kid", "Mummy", "Magician", "Cake cutter", "Gift giver", "Balloon blower", "Shy cousin"] },
  { name: "Playground", emoji: "🛝", level: "kids", roles: ["Swing champion", "Cricket captain", "Ball boy", "Grandpa on bench", "Ice-gola wala", "Kid who fell", "Watchman"] },
  { name: "Ice-cream Parlour", emoji: "🍦", level: "kids", roles: ["Scooper", "Cashier", "Kid choosing flavours", "Family on outing", "Delivery boy", "Sprinkle lover", "Owner"] },
  { name: "Circus", emoji: "🎪", level: "kids", roles: ["Ringmaster", "Joker", "Trapeze artist", "Elephant trainer", "Popcorn seller", "Front-row kid", "Juggler"] },
  { name: "Beach", emoji: "🏖️", level: "kids", roles: ["Lifeguard", "Sandcastle builder", "Bhelpuri wala", "Horse-ride man", "Swimmer", "Tourist", "Shell collector"] },
  { name: "Train Journey", emoji: "🚂", level: "kids", roles: ["TT uncle", "Chaiwala", "Upper-berth sleeper", "Window-seat kid", "Pantry staff", "Family with tiffin", "Passenger with luggage"] },
  { name: "Hospital", emoji: "🏥", level: "kids", roles: ["Doctor", "Nurse", "Patient", "Receptionist", "Ward boy", "Worried relative", "Chemist"] },
  { name: "Space Station", emoji: "🚀", level: "kids", roles: ["Astronaut", "Commander", "Scientist", "Space chef", "Robot", "Mission control", "Alien visitor"] },
  { name: "Indian Wedding", emoji: "💍", level: "family", roles: ["Dulha", "Dulhan", "Pandit ji", "Dancing uncle", "Caterer", "Photographer", "Band-baaja wala", "Mehendi aunty"] },
  { name: "Railway Station", emoji: "🚉", level: "family", roles: ["Coolie", "Station master", "Announcer", "Passenger running late", "Chai stall owner", "Book stall owner", "Ticket checker"] },
  { name: "Cricket Stadium", emoji: "🏏", level: "family", roles: ["Batter", "Bowler", "Umpire", "Commentator", "Cheerleader", "Fan with painted face", "Groundsman", "Samosa seller"] },
  { name: "Diwali Mela", emoji: "🪔", level: "family", roles: ["Giant wheel operator", "Diya seller", "Sweet shop owner", "Rangoli artist", "Balloon wala", "Family shopping", "Fortune teller"] },
  { name: "Bollywood Film Set", emoji: "🎬", level: "family", roles: ["Hero", "Heroine", "Director", "Villain", "Spot boy", "Choreographer", "Makeup artist", "Junior artist"] },
  { name: "Sabzi Mandi", emoji: "🥬", level: "family", roles: ["Sabzi wala", "Bargaining aunty", "Porter", "Fruit seller", "Weighing-scale guy", "Cow wandering by", "Shopkeeper's kid"] },
  { name: "Temple", emoji: "🛕", level: "family", roles: ["Pujari", "Devotee", "Flower seller", "Bell ringer", "Prasad distributor", "Shoe keeper", "Tourist"] },
  { name: "Dhaba on Highway", emoji: "🍛", level: "family", roles: ["Truck driver", "Cook", "Waiter chhotu", "Owner at counter", "Road-trip family", "Lassi maker", "Bike rider"] },
  { name: "Goa Beach Shack", emoji: "🌴", level: "family", roles: ["Shack owner", "Tourist", "Lifeguard", "Musician", "Waiter", "Parasailing guide", "Sunbather"] },
  { name: "Kirana Store", emoji: "🛒", level: "family", roles: ["Shopkeeper", "Customer with list", "Delivery boy", "Kid buying toffee", "Supplier", "Neighbour aunty", "Accountant"] },
  { name: "Bank", emoji: "🏦", level: "family", roles: ["Cashier", "Manager", "Security guard", "Customer in queue", "Loan applicant", "Peon", "Senior citizen"] },
  { name: "Cinema Hall", emoji: "🍿", level: "family", roles: ["Ticket checker", "Popcorn seller", "Couple", "Loud talker", "Projector operator", "Family with kids", "Usher with torch"] },
  { name: "Hill Station", emoji: "🏔️", level: "family", roles: ["Tourist", "Pony man", "Maggi stall owner", "Hotel receptionist", "Photographer", "Honeymoon couple", "Local guide"] },
  { name: "Government Office", emoji: "🗂️", level: "adults", roles: ["Babu at desk", "Peon", "Applicant", "Tea boy", "Agent", "Officer", "Typist"] },
  { name: "Wedding Sangeet", emoji: "💃", level: "adults", roles: ["Choreographer", "DJ", "Bride's best friend", "Shy uncle", "Groom's cousin", "Video-wala", "Dadi giving blessings"] },
  { name: "IPL Auction", emoji: "💰", level: "adults", roles: ["Auctioneer", "Team owner", "Analyst", "Player waiting", "Reporter", "Coach", "Camera operator"] },
  { name: "Mumbai Local Train", emoji: "🚆", level: "adults", roles: ["Daily commuter", "Hawker", "Door-hanger", "Ladies compartment passenger", "Motorman", "First-timer", "Bhajan group"] },
  { name: "Tech Office", emoji: "💻", level: "adults", roles: ["Manager", "Intern", "Developer", "HR", "Canteen staff", "Client on call", "IT support"] },
  { name: "Kumbh Mela", emoji: "🙏", level: "adults", roles: ["Sadhu", "Pilgrim", "Police volunteer", "Foreign tourist", "Boatman", "Lost-and-found announcer", "Food seller"] },
  { name: "Airport", emoji: "✈️", level: "adults", roles: ["Pilot", "Air hostess", "Security officer", "Passenger", "Duty-free seller", "Check-in staff", "Cleaner"] },
  { name: "Newsroom", emoji: "📺", level: "adults", roles: ["Anchor", "Reporter", "Camera person", "Editor", "Guest expert", "Producer", "Makeup artist"] },
  { name: "Village Panchayat", emoji: "🌳", level: "adults", roles: ["Sarpanch", "Farmer", "Schoolteacher", "Postman", "Village elder", "Complaining neighbour", "Milkman"] },
  { name: "Car Service Centre", emoji: "🔧", level: "adults", roles: ["Mechanic", "Service advisor", "Customer", "Washing boy", "Manager", "Parts supplier", "Waiting dad"] },
];

export function locationsFor(level: Level): ChorLocation[] {
  if (level === "kids") return CHOR_LOCATIONS.filter((l) => l.level === "kids");
  if (level === "family") return CHOR_LOCATIONS.filter((l) => l.level !== "adults");
  return CHOR_LOCATIONS;
}

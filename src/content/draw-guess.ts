import type { Level } from "@/lib/types";

/** Words for Draw & Guess. Each entry: word, plus optional accepted alternatives after "|". */
export const DRAW_WORDS: Record<Level, string[]> = {
  kids: [
    "Sun", "Moon", "Star", "Tree", "House", "Car", "Bus", "Train", "Boat", "Kite", "Ball", "Cat|Billi", "Dog|Kutta",
    "Fish|Machli", "Elephant|Haathi", "Lion|Sher", "Tiger", "Peacock|Mor", "Parrot|Tota", "Monkey|Bandar",
    "Cow|Gaay", "Snake|Saanp", "Butterfly|Titli", "Flower|Phool", "Apple|Seb", "Banana|Kela", "Mango|Aam",
    "Ice cream", "Cake", "Umbrella|Chhata", "Rainbow", "Cloud|Baadal", "Rain|Baarish", "Pencil", "Book|Kitaab",
    "Clock|Ghadi", "Chair|Kursi", "Table", "Bed", "Cup", "Spoon|Chammach", "Shoe|Joota", "Hat|Topi", "Glasses|Chashma|Spectacles",
    "Balloon|Gubbara", "Cycle|Bicycle", "Rocket", "Aeroplane|Airplane|Plane", "Duck|Batakh", "Egg|Anda",
    "Laddoo|Ladoo|Laddu", "Diya|Diya lamp|Deepak", "Candle|Mombatti", "Snowman", "Crown|Mukut", "Heart|Dil",
    "Spider|Makdi", "Ant|Cheenti", "Frog|Mendak", "Turtle|Kachua|Tortoise", "Football", "Cricket bat|Bat",
    "Mountain|Pahad", "Ship|Jahaz", "Teddy bear|Teddy", "Robot", "Watermelon|Tarbooz", "Carrot|Gajar",
  ],
  family: [
    "Samosa", "Jalebi", "Pani puri|Golgappa|Puchka", "Dosa", "Idli", "Chai|Tea", "Pressure cooker|Cooker",
    "Auto rickshaw|Auto|Rickshaw", "Taj Mahal", "India Gate", "Rangoli", "Diwali", "Holi", "Kite festival|Sankranti|Uttarayan",
    "Rakhi", "Mehendi|Mehndi|Henna", "Saree|Sari", "Turban|Pagdi", "Bindi", "Bangles|Chudi", "Tabla", "Sitar",
    "Dhol", "Cricket", "Wicket|Stumps", "Kabaddi", "Carrom", "Ludo", "Snakes and ladders|Saanp seedhi", "Gilli danda",
    "Coconut tree|Coconut|Nariyal", "Lotus|Kamal", "Temple|Mandir", "Mosque|Masjid", "Church", "Gurudwara",
    "Camel|Oont", "Tiffin box|Tiffin|Dabba", "Lunch box", "Thali", "Chapati|Roti", "Rolling pin|Belan",
    "Tawa", "Matka|Earthen pot|Pot", "Charpai|Cot", "Hand pump", "Ceiling fan|Fan|Pankha", "Cooler",
    "Mosquito|Machhar", "Lizard|Chhipkali", "Train ticket|Ticket", "Railway station|Station", "Traffic light|Signal",
    "Police|Policeman", "Doctor", "Teacher", "Postman|Dakiya", "Farmer|Kisan", "Tractor", "Bullock cart|Bail gaadi",
    "Scooter", "Helmet", "Selfie", "Mobile phone|Phone|Mobile", "Television|TV", "Remote", "Wedding|Shaadi",
    "Groom on horse|Ghodi|Baraat", "Swing|Jhoola", "Fireworks|Firecracker|Pataka", "Lighthouse", "Ganesha|Ganpati",
    "Peacock feather|Mor pankh", "Banyan tree|Bargad", "Well|Kuan", "Pickle|Achaar", "Paratha", "Biryani",
  ],
  adults: [
    "Monsoon", "Traffic jam", "Power cut|Load shedding", "Mumbai local|Local train", "Dabbawala", "Chandrayaan|Moon mission",
    "Bollywood", "Selfie stick", "Wi-Fi|Wifi", "Work from home|WFH", "Online meeting|Zoom call|Video call",
    "Queue|Line", "Exam|Board exam", "Report card|Marksheet", "Tuition", "Gossip", "Arranged marriage",
    "Mother-in-law|Saas", "Kitty party", "Antakshari", "Dumb charades|Charades", "Yoga", "Meditation", "Cricket umpire|Umpire",
    "Hat-trick|Hattrick", "Run out", "Bowled", "Free hit", "Toll plaza|Toll", "Speed breaker", "Pothole",
    "Honeymoon", "Haldi ceremony|Haldi", "Sangeet", "Pandit|Priest", "Horoscope|Kundli", "Jugaad",
    "Bargaining|Mol bhav", "Street food|Chaat", "Food delivery", "Gym", "Treadmill", "Diet", "Hangover",
    "Alarm clock|Alarm", "Sleepwalking", "Nightmare", "Time travel", "Black hole", "Volcano", "Earthquake",
    "Lightning|Bijli", "Tsunami", "Desert|Registan", "Oasis", "Iceberg", "Submarine", "Parachute", "Hot air balloon",
    "Telescope", "Microscope", "Magnet", "Stethoscope", "Injection|Syringe", "Election|Voting", "Ink mark|Voter ink",
    "Budget", "Stock market|Sensex|Share market", "Piggy bank|Gullak", "ATM", "Credit card|Card", "Passport",
  ],
};

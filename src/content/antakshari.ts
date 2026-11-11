/** Song suggestions for Antakshari hints. Title + source only (no lyrics). */
export interface SongHint {
  title: string;
  source: string;
  kids?: boolean;
}

const RAW: [string, string, boolean?][] = [
  // A
  ["Aaj Kal Tere Mere Pyar Ke Charche", "Brahmachari"],
  ["Aaj Ki Raat", "Don"],
  ["Aankhon Mein Teri", "Om Shanti Om"],
  ["Abhi Na Jao Chhod Kar", "Hum Dono"],
  ["Ae Watan", "Raazi"],
  ["Aye Mere Watan Ke Logon", "Patriotic song"],
  ["Ankhiyon Ke Jharokhon Se", "Ankhiyon Ke Jharokhon Se"],
  ["Aao Twist Karen", "Bhoot Bungla"],
  ["Aloo Kachaloo Beta Kahan Gaye The", "Kids rhyme", true],
  ["Ab Tumhare Hawale Watan Saathiyo", "Haqeeqat"],
  // B
  ["Badtameez Dil", "Yeh Jawaani Hai Deewani"],
  ["Balam Pichkari", "Yeh Jawaani Hai Deewani"],
  ["Bachna Ae Haseeno", "Hum Kisise Kum Nahin"],
  ["Bade Achhe Lagte Hain", "Balika Badhu"],
  ["Bum Bum Bole", "Taare Zameen Par", true],
  ["Bachpan Ki Mohabbat", "Baiju Bawra"],
  ["Bholi Si Surat", "Dil To Pagal Hai"],
  ["Bhaag Milkha Bhaag", "Bhaag Milkha Bhaag"],
  // C
  ["Chaiyya Chaiyya", "Dil Se"],
  ["Chak De India", "Chak De! India"],
  ["Chalte Chalte", "Chalte Chalte"],
  ["Chura Liya Hai Tumne", "Yaadon Ki Baaraat"],
  ["Chanda Mama Door Ke", "Vachan", true],
  ["Chal Chal Chal Mere Haathi", "Haathi Mere Saathi", true],
  ["Chaand Chhupa Badal Mein", "Hum Dil De Chuke Sanam"],
  ["Chammak Challo", "Ra.One"],
  ["Chhod Aaye Hum", "Maachis"],
  // D
  ["Dil To Pagal Hai", "Dil To Pagal Hai"],
  ["Dola Re Dola", "Devdas"],
  ["Dus Bahane", "Dus"],
  ["Dard-e-Disco", "Om Shanti Om"],
  ["Dil Chahta Hai", "Dil Chahta Hai"],
  ["Desi Girl", "Dostana"],
  ["Dhoom Machale", "Dhoom"],
  ["Dum Maro Dum", "Hare Rama Hare Krishna"],
  ["Dekha Ek Khwab", "Silsila"],
  // E
  ["Ek Do Teen", "Tezaab"],
  ["Ek Ladki Ko Dekha", "1942: A Love Story"],
  ["Ek Pyar Ka Nagma Hai", "Shor"],
  ["Ek Chatur Naar", "Padosan"],
  ["Ek Mota Haathi", "Kids rhyme", true],
  // G
  ["Gaata Rahe Mera Dil", "Guide"],
  ["Genda Phool", "Delhi-6"],
  ["Gerua", "Dilwale"],
  ["Gallan Goodiyaan", "Dil Dhadakne Do"],
  ["Ghar More Pardesiya", "Kalank"],
  ["Gulabi Aankhen", "The Train"],
  ["Ghoomar", "Padmaavat"],
  // H
  ["Hawa Hawai", "Mr. India", true],
  ["Humko Humise Chura Lo", "Mohabbatein"],
  ["Hum Honge Kaamyab", "Patriotic / School song", true],
  ["Hum Tum Ek Kamre Mein Band Ho", "Bobby"],
  ["Hai Apna Dil To Awara", "Solva Saal"],
  ["Hum Aapke Hain Kaun", "Hum Aapke Hain Kaun"],
  ["Haathi Raja Kahan Chale", "Kids rhyme", true],
  // I
  ["Ik Junoon", "Zindagi Na Milegi Dobara"],
  ["Ilahi", "Yeh Jawaani Hai Deewani"],
  ["Inhi Logon Ne", "Pakeezah"],
  ["Is Tarah Aashiqui Ka", "Imtihaan"],
  ["Itni Si Baat Hai", "Azhar"],
  ["Ichak Dana Bichak Dana", "Shree 420", true],
  // J
  ["Jhanda Ooncha Rahe Hamara", "Patriotic song", true],
  ["Jai Ho", "Slumdog Millionaire"],
  ["Jab Koi Baat Bigad Jaye", "Jurm"],
  ["Jhoom Barabar Jhoom", "Jhoom Barabar Jhoom"],
  ["Jeena Jeena", "Badlapur"],
  ["Jo Jeeta Wohi Sikander", "Jo Jeeta Wohi Sikandar"],
  ["Jaane Kyon Log Pyaar Karte Hain", "Dil Chahta Hai"],
  ["Jungle Jungle Baat Chali Hai", "The Jungle Book (TV)", true],
  ["Jhoome Jo Pathaan", "Pathaan"],
  // K
  ["Kal Ho Naa Ho", "Kal Ho Naa Ho"],
  ["Kajra Re", "Bunty Aur Babli"],
  ["Kabhi Kabhi Mere Dil Mein", "Kabhi Kabhie"],
  ["Kesariya", "Brahmastra"],
  ["Koi Mil Gaya", "Kuch Kuch Hota Hai"],
  ["Kuch Kuch Hota Hai", "Kuch Kuch Hota Hai"],
  ["Kar Har Maidaan Fateh", "Sanju"],
  ["Kabootar Ja Ja Ja", "Maine Pyar Kiya"],
  ["Khaike Paan Banaraswala", "Don"],
  // L
  ["Ladki Badi Anjani Hai", "Kuch Kuch Hota Hai"],
  ["Lag Ja Gale", "Woh Kaun Thi?"],
  ["Lakdi Ki Kaathi", "Masoom", true],
  ["London Thumakda", "Queen"],
  ["Lungi Dance", "Chennai Express"],
  ["Lal Dupatta Malmal Ka", "Lal Dupatta Malmal Ka"],
  // M
  ["Mere Sapno Ki Rani", "Aradhana"],
  ["Mehndi Laga Ke Rakhna", "Dilwale Dulhania Le Jayenge"],
  ["Mujhse Shaadi Karogi", "Mujhse Shaadi Karogi"],
  ["Mere Desh Ki Dharti", "Upkar"],
  ["Masakali", "Delhi-6"],
  ["Mauja Hi Mauja", "Jab We Met"],
  ["Machhli Jal Ki Rani Hai", "Kids rhyme", true],
  ["Main Hoon Na", "Main Hoon Na"],
  ["Mera Joota Hai Japani", "Shree 420"],
  // N
  ["Nagada Sang Dhol", "Goliyon Ki Raasleela Ram-Leela"],
  ["Nani Teri Morni Ko Mor Le Gaye", "Masoom", true],
  ["Naatu Naatu", "RRR"],
  ["Nainowale Ne", "Padmaavat"],
  ["Nashe Si Chadh Gayi", "Befikre"],
  // O
  ["O Saathi Re", "Muqaddar Ka Sikandar"],
  ["Om Shanti Om", "Karz"],
  ["O Mere Dil Ke Chain", "Mere Jeevan Saathi"],
  ["Oye Oye", "Tridev"],
  ["O Haseena Zulfonwali", "Teesri Manzil"],
  // P
  ["Phoolon Ka Taaron Ka", "Hare Rama Hare Krishna"],
  ["Pyar Kiya To Darna Kya", "Mughal-e-Azam"],
  ["Pal Pal Dil Ke Paas", "Blackmail"],
  ["Pehla Nasha", "Jo Jeeta Wohi Sikandar"],
  ["Pyar Hua Ikrar Hua", "Shree 420"],
  ["Pardesi Pardesi", "Raja Hindustani"],
  ["Papa Kehte Hain", "Qayamat Se Qayamat Tak"],
  ["Pinga", "Bajirao Mastani"],
  // R
  ["Raghupati Raghav Raja Ram", "Bhajan", true],
  ["Rang De Basanti", "Rang De Basanti"],
  ["Roop Tera Mastana", "Aradhana"],
  ["Radha Kaise Na Jale", "Lagaan"],
  ["Rim Jhim Gire Saawan", "Manzil"],
  ["Ruk Ja O Dil Deewane", "Dilwale Dulhania Le Jayenge"],
  // S
  ["Suraj Hua Maddham", "Kabhi Khushi Kabhie Gham"],
  ["Saare Jahan Se Achha", "Patriotic song", true],
  ["Sheila Ki Jawani", "Tees Maar Khan"],
  ["Senorita", "Zindagi Na Milegi Dobara"],
  ["Sooraj Ki Garmi Se", "Parinay"],
  ["Shava Shava", "Kabhi Khushi Kabhie Gham"],
  ["Sandese Aate Hai", "Border"],
  // T
  ["Tujhe Dekha To", "Dilwale Dulhania Le Jayenge"],
  ["Tum Hi Ho", "Aashiqui 2"],
  ["Tera Ban Jaunga", "Kabir Singh"],
  ["Taare Zameen Par", "Taare Zameen Par", true],
  ["Tamma Tamma Loge", "Thanedaar"],
  ["Tune Maari Entriyaan", "Gunday"],
  ["Teri Mitti", "Kesari"],
  ["Tittli Udi", "Suraj"],
  // U
  ["Udi Udi Jaye", "Raees"],
  ["Ude Jab Jab Zulfein Teri", "Naya Daur"],
  ["Ui Amma Ui Amma", "Mard"],
  ["Uff Teri Adaa", "Karthik Calling Karthik"],
  // V / W
  ["Vande Mataram", "National song", true],
  ["Vaaste", "Single"],
  ["Woh Ladki Hai Kahan", "Dil Chahta Hai"],
  ["Waqt Ne Kiya", "Kaagaz Ke Phool"],
  // Y
  ["Yeh Dosti", "Sholay"],
  ["Yeh Sham Mastani", "Kati Patang"],
  ["Ye Jo Desh Hai Tera", "Swades"],
  ["Yaari Hai Imaan Mera", "Zanjeer"],
  ["Yamma Yamma", "Shaan"],
  ["Yeh Ladka Hai Allah", "Kabhi Khushi Kabhie Gham"],
  // Z
  ["Zara Zara", "Rehnaa Hai Terre Dil Mein"],
  ["Zindagi Ek Safar Hai Suhana", "Andaz"],
  ["Zoobi Doobi", "3 Idiots"],
  ["Zinda", "Bhaag Milkha Bhaag"],
  ["Zor Ka Jhatka", "Action Replayy"],
];

export const SONGS: SongHint[] = RAW.map(([title, source, kids]) => ({ title, source, kids: kids ?? false }));

/** Letters that are fair to start on (enough songs exist for each). */
export const START_LETTERS = ["A", "B", "C", "D", "E", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "Y"];

export function songsFor(letter: string): SongHint[] {
  const l = letter.toUpperCase();
  return SONGS.filter((s) => s.title.toUpperCase().startsWith(l));
}

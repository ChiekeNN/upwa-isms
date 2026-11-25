import {
  CLASS_ORDER,
  HOUSES,
  divisionOfClass,
  type AdmissionApplication,
  type ApplicationStatus,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassArm,
  type DemoData,
  type DemoSettings,
  type Gender,
  type Guardian,
  type House,
  type Invoice,
  type Message,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type SchoolClass,
  type SchoolEvent,
  type Score,
  type Staff,
  type Student,
  type Subject,
  type TermCode,
} from "./types";

/**
 * Synthetic demonstration dataset for the UPWA-ISMS portal preview.
 *
 * Names, addresses and figures are realistic for a private school in Choba,
 * Port Harcourt, but every record is fictional and exists only so the client can
 * see how the finished product behaves. Nothing here is a real UPWA pupil,
 * parent, staff member, invoice or result, and nothing is written to the school
 * database.
 *
 * Generation is deterministic (a seeded PRNG) so the demo looks identical on
 * every machine, which matters when presenting to a client.
 */

/* ------------------------------- utilities ------------------------------- */

/** Small deterministic PRNG so generated figures never change between loads. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261125);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

function between(min: number, max: number) {
  return Math.round(min + rand() * (max - min));
}

function pad(value: number, length = 4) {
  return String(value).padStart(length, "0");
}

/** Nigerian school year: September to July. */
export function academicContext(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const session = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const term: TermCode = month <= 2 ? "SECOND" : month <= 6 ? "THIRD" : "FIRST";
  return { session, term };
}

function termWindow(session: string, term: TermCode) {
  const start = Number(session.split("/")[0]);
  if (term === "FIRST") {
    return {
      start: `${start}-09-08`,
      end: `${start}-12-18`,
      next: `${start + 1}-01-12`,
      label: "First Term",
    };
  }
  if (term === "SECOND") {
    return {
      start: `${start + 1}-01-12`,
      end: `${start + 1}-04-02`,
      next: `${start + 1}-04-20`,
      label: "Second Term",
    };
  }
  return {
    start: `${start + 1}-04-20`,
    end: `${start + 1}-07-24`,
    next: `${start + 1}-09-08`,
    label: "Third Term",
  };
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Last `count` weekdays, newest first — used for the attendance register. */
function recentSchoolDays(count: number, today = new Date()) {
  const days: string[] = [];
  const cursor = new Date(today);
  while (days.length < count) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days.push(iso(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/* --------------------------------- people -------------------------------- */

type GuardianSeed = {
  title: string;
  fullName: string;
  relationship: Guardian["relationship"];
  phone: string;
  email: string;
  occupation: string;
  address: string;
};

const GUARDIAN_SEEDS: GuardianSeed[] = [
  { title: "Mrs.", fullName: "Ngozi Okafor", relationship: "Mother", phone: "0803 412 7789", email: "ngozi.okafor@gmail.com", occupation: "Fashion retailer, Rumuigbo", address: "12 Rumuigbo Road, Obio-Akpor" },
  { title: "Mr.", fullName: "Emeka Nwachukwu", relationship: "Father", phone: "0816 220 4417", email: "emeka.nwachukwu@yahoo.com", occupation: "Civil engineer", address: "45 Choba Road, Choba" },
  { title: "Mrs.", fullName: "Blessing Etim", relationship: "Mother", phone: "0706 883 2210", email: "blessing.etim21@gmail.com", occupation: "Registered nurse, UPTH", address: "8 Eliozu Street, Eliozu" },
  { title: "Alhaji", fullName: "Musa Bello", relationship: "Father", phone: "0805 771 9034", email: "musa.bello@outlook.com", occupation: "Building materials merchant", address: "27 Ikwerre Road, Mile 1" },
  { title: "Mrs.", fullName: "Aisha Lawal", relationship: "Mother", phone: "0902 446 7183", email: "aisha.lawal@gmail.com", occupation: "Chartered accountant", address: "15 Rukpokwu Close, Rukpokwu" },
  { title: "Dr.", fullName: "Tamuno George", relationship: "Father", phone: "0813 908 4472", email: "dr.tam.george@gmail.com", occupation: "Consultant paediatrician", address: "6 GRA Phase 2, Port Harcourt" },
  { title: "Mrs.", fullName: "Ibinabo Briggs", relationship: "Mother", phone: "0703 559 2284", email: "ibi.briggs@yahoo.com", occupation: "Lecturer, University of Port Harcourt", address: "22 Uniport Staff Quarters, Choba" },
  { title: "Mr.", fullName: "Uche Okoro", relationship: "Father", phone: "0809 664 1130", email: "uche.okoro@gmail.com", occupation: "Branch manager, Zenith Bank", address: "31 Woji Road, Woji" },
  { title: "Mrs.", fullName: "Folake Adeyemi", relationship: "Mother", phone: "0818 227 6690", email: "folake.adeyemi@gmail.com", occupation: "Community pharmacist", address: "9 Ada George Road, Ada George" },
  { title: "Chief", fullName: "Godspower Amadi", relationship: "Father", phone: "0802 447 8819", email: "gp.amadi@amadiholdings.ng", occupation: "Oil and gas services contractor", address: "3 Peter Odili Road, Elekahia" },
  { title: "Mrs.", fullName: "Halima Yusuf", relationship: "Mother", phone: "0913 774 2205", email: "halima.yusuf@gmail.com", occupation: "Tailoring business owner", address: "18 Mile 3 Market Road, Diobu" },
  { title: "Mr.", fullName: "Chukwuemeka Iheanacho", relationship: "Father", phone: "0706 118 3394", email: "c.iheanacho@gmail.com", occupation: "Haulage and logistics manager", address: "44 Rumuokoro Road, Rumuokoro" },
  { title: "Mrs.", fullName: "Peace Udeh", relationship: "Mother", phone: "0810 335 7712", email: "peace.udeh@yahoo.com", occupation: "Industrial caterer", address: "7 Nkpolu Street, Nkpolu" },
  { title: "Engr.", fullName: "Sunday Akpan", relationship: "Father", phone: "0803 990 4461", email: "sunday.akpan@gmail.com", occupation: "Petroleum engineer", address: "12 Elekahia Estate, Elekahia" },
  { title: "Mrs.", fullName: "Zainab Danjuma", relationship: "Mother", phone: "0909 224 7738", email: "zainab.danjuma@gmail.com", occupation: "Civil servant, Rivers State Ministry of Education", address: "25 Ozuoba Road, Ozuoba" },
  { title: "Mr.", fullName: "Obinna Umeh", relationship: "Father", phone: "0705 663 1180", email: "obinna.umeh@gmail.com", occupation: "Legal practitioner", address: "16 Rumuola Road, Rumuola" },
  { title: "Mrs.", fullName: "Comfort Bassey", relationship: "Mother", phone: "0807 442 9905", email: "comfort.bassey@gmail.com", occupation: "Provision store owner", address: "5 Oro-igwe Road, Rumuigbo" },
  { title: "Pastor", fullName: "Daniel Okon", relationship: "Father", phone: "0814 776 2233", email: "daniel.okon@faithhouse.org", occupation: "Clergy", address: "33 Airport Road, Rumuolumeni" },
  { title: "Mrs.", fullName: "Kemi Olawale", relationship: "Mother", phone: "0812 558 3340", email: "kemi.olawale@gmail.com", occupation: "Regional sales manager", address: "21 Igwuruta Road, Igwuruta" },
  { title: "Mr.", fullName: "Kabiru Sani", relationship: "Father", phone: "0916 330 7748", email: "kabiru.sani@yahoo.com", occupation: "Warrant officer, Nigerian Army", address: "14 Bori Barracks Road, Obio-Akpor" },
  { title: "Mrs.", fullName: "Grace Amachree", relationship: "Mother", phone: "0806 227 4419", email: "grace.amachree@gmail.com", occupation: "Provisions and foodstuff trader", address: "11 Rumuodara Road, Rumuodara" },
  { title: "Mr.", fullName: "Kelechi Orji", relationship: "Father", phone: "0708 442 6631", email: "kelechi.orji@gmail.com", occupation: "Electrical installations contractor", address: "19 Eneka Road, Eneka" },
  { title: "Mrs.", fullName: "Ruth Wokoma", relationship: "Mother", phone: "0813 664 8820", email: "ruth.wokoma@yahoo.com", occupation: "Head teacher (private school)", address: "26 Rumuekwe Road, Rumuekwe" },
  { title: "Mr.", fullName: "Olumide Fashola", relationship: "Father", phone: "0802 118 7745", email: "olumide.fashola@gmail.com", occupation: "Operations officer, Guaranty Trust Bank", address: "17 Ikwerre Road, Mile 4" },
  { title: "Mrs.", fullName: "Joy Eze", relationship: "Mother", phone: "0903 557 2218", email: "joy.eze@gmail.com", occupation: "Salon and spa proprietor", address: "6 Diobu Road, Diobu" },
  { title: "Alhaji", fullName: "Sani Mohammed", relationship: "Father", phone: "0810 992 4476", email: "sani.mohammed@gmail.com", occupation: "Warehouse and stores supervisor", address: "30 Mgbuoba Road, Mgbuoba" },
  { title: "Mrs.", fullName: "Patience Dokubo", relationship: "Mother", phone: "0703 668 1129", email: "patience.dokubo@gmail.com", occupation: "Event caterer", address: "13 Ogbunabali Road, Ogbunabali" },
];

/** [first, other, last, gender, class, arm, guardian index, state of origin] */
const ROSTER: [string, string, string, Gender, SchoolClass, ClassArm, number, string][] = [
  ["Chidinma", "Amaka", "Okafor", "FEMALE", "Primary 4", "A", 0, "Anambra"],
  ["Obiageli", "Rita", "Okafor", "FEMALE", "Primary 1", "B", 0, "Anambra"],
  ["Ifeanyi", "Emeka", "Nwachukwu", "MALE", "JSS 2", "A", 1, "Imo"],
  ["Adaeze", "Bianca", "Nwachukwu", "FEMALE", "Primary 5", "B", 1, "Imo"],
  ["Edidiong", "Blessing", "Etim", "FEMALE", "JSS 1", "B", 2, "Akwa Ibom"],
  ["Ime", "Daniel", "Etim", "MALE", "Nursery 2", "A", 2, "Akwa Ibom"],
  ["Fatima", "Zahra", "Bello", "FEMALE", "SSS 2", "A", 3, "Kano"],
  ["Amina", "Halima", "Bello", "FEMALE", "Primary 3", "B", 3, "Kano"],
  ["Ibrahim", "Musa", "Bello", "MALE", "JSS 3", "A", 3, "Kano"],
  ["Zainab", "Aisha", "Lawal", "FEMALE", "Primary 6", "A", 4, "Kaduna"],
  ["Sadiq", "Abdul", "Lawal", "MALE", "Primary 2", "B", 4, "Kaduna"],
  ["Tamunotonye", "William", "George", "MALE", "SSS 1", "A", 5, "Rivers"],
  ["Bara", "Favour", "George", "FEMALE", "JSS 2", "B", 5, "Rivers"],
  ["Daminibo", "Tamuno", "Briggs", "MALE", "Primary 5", "A", 6, "Rivers"],
  ["Sifon", "Ibinabo", "Briggs", "FEMALE", "Nursery 1", "B", 6, "Rivers"],
  ["Chidera", "Nneoma", "Okoro", "FEMALE", "SSS 3", "A", 7, "Abia"],
  ["Kamsiyochukwu", "Uche", "Okoro", "MALE", "JSS 1", "A", 7, "Abia"],
  ["Oluwaseun", "Tobiloba", "Adeyemi", "MALE", "Primary 4", "B", 8, "Oyo"],
  ["Ayomide", "Folake", "Adeyemi", "FEMALE", "Primary 2", "A", 8, "Oyo"],
  ["Ebiere", "Grace", "Amadi", "FEMALE", "SSS 2", "B", 9, "Rivers"],
  ["Tamunoibi", "Felix", "Amadi", "MALE", "JSS 3", "B", 9, "Rivers"],
  ["Zulkifli", "Musa", "Yusuf", "MALE", "Primary 3", "A", 10, "Katsina"],
  ["Hafsat", "Amina", "Yusuf", "FEMALE", "Nursery 2", "B", 10, "Katsina"],
  ["Nnamdi", "Chukwuemeka", "Iheanacho", "MALE", "SSS 1", "B", 11, "Enugu"],
  ["Chiamaka", "Zikora", "Iheanacho", "FEMALE", "JSS 2", "A", 11, "Enugu"],
  ["Somtochukwu", "Victor", "Udeh", "MALE", "Primary 1", "A", 12, "Ebonyi"],
  ["Ginikachukwu", "Peace", "Udeh", "FEMALE", "Primary 6", "B", 12, "Ebonyi"],
  ["Aniefiok", "Sunday", "Akpan", "MALE", "JSS 3", "A", 13, "Cross River"],
  ["Uwana", "Blessed", "Akpan", "FEMALE", "SSS 3", "B", 13, "Cross River"],
  ["Abdulrahman", "Sani", "Danjuma", "MALE", "SSS 1", "A", 14, "Plateau"],
  ["Aisha", "Zainab", "Danjuma", "FEMALE", "Primary 4", "A", 14, "Plateau"],
  ["Ugonna", "Obinna", "Umeh", "MALE", "Primary 5", "B", 15, "Abia"],
  ["Nneka", "Chidera", "Umeh", "FEMALE", "JSS 1", "B", 15, "Abia"],
  ["Ekemini", "Comfort", "Bassey", "FEMALE", "SSS 2", "A", 16, "Akwa Ibom"],
  ["Udo", "Ekanem", "Bassey", "MALE", "Primary 3", "B", 16, "Akwa Ibom"],
  ["Imoh", "Daniel", "Okon", "MALE", "Primary 2", "A", 17, "Cross River"],
  ["Imaobong", "Ruth", "Okon", "FEMALE", "JSS 3", "B", 17, "Cross River"],
  ["Tobiloba", "Kemi", "Olawale", "FEMALE", "Primary 1", "B", 18, "Ogun"],
  ["Fikayo", "Oluwa", "Olawale", "MALE", "Nursery 1", "A", 18, "Ogun"],
  ["Hadiza", "Maryam", "Sani", "FEMALE", "JSS 2", "A", 19, "Sokoto"],
  ["Umar", "Kabiru", "Sani", "MALE", "Primary 6", "A", 19, "Sokoto"],
  ["Efetabomo", "Grace", "Amachree", "FEMALE", "Crèche", "A", 20, "Bayelsa"],
  ["Tariwari", "Sam", "Amachree", "MALE", "Pre-Nursery", "A", 20, "Bayelsa"],
  ["Chinelo", "Joy", "Orji", "FEMALE", "SSS 3", "A", 21, "Imo"],
  ["Ugochukwu", "Kelvin", "Orji", "MALE", "JSS 2", "B", 21, "Imo"],
  ["Dawari", "Rex", "Wokoma", "MALE", "Primary 3", "A", 22, "Rivers"],
  ["Biobele", "Ruth", "Wokoma", "FEMALE", "Nursery 2", "A", 22, "Rivers"],
  ["Oluwadamilola", "Ife", "Fashola", "FEMALE", "Primary 5", "A", 23, "Lagos"],
  ["Babatunde", "Olumide", "Fashola", "MALE", "JSS 1", "A", 23, "Lagos"],
  ["Chisom", "Grace", "Eze", "FEMALE", "SSS 1", "B", 24, "Anambra"],
  ["Ebubechukwu", "David", "Eze", "MALE", "Primary 2", "B", 24, "Anambra"],
  ["Maryam", "Sadiq", "Mohammed", "FEMALE", "Primary 4", "B", 25, "Borno"],
  ["Abdullahi", "Sani", "Mohammed", "MALE", "SSS 2", "B", 25, "Borno"],
  ["Tamunoimi", "Patience", "Dokubo", "MALE", "Nursery 1", "B", 26, "Rivers"],
  ["Ebiowei", "Joy", "Dokubo", "FEMALE", "Primary 1", "A", 26, "Rivers"],
];

const CLASS_TYPICAL_AGE: Record<SchoolClass, number> = {
  "Crèche": 2,
  "Pre-Nursery": 3,
  "Nursery 1": 4,
  "Nursery 2": 5,
  "Primary 1": 6,
  "Primary 2": 7,
  "Primary 3": 8,
  "Primary 4": 9,
  "Primary 5": 10,
  "Primary 6": 11,
  "JSS 1": 12,
  "JSS 2": 13,
  "JSS 3": 14,
  "SSS 1": 15,
  "SSS 2": 16,
  "SSS 3": 17,
};

const MEDICAL_NOTES = [
  "",
  "",
  "",
  "",
  "Sickle cell trait (AS) — notified to school nurse.",
  "Mild asthma; inhaler kept with the school nurse.",
  "Allergic to groundnut — canteen informed.",
  "Wears corrective glasses; seated at the front of class.",
  "Lactose intolerant — feeding plan adjusted.",
];

function buildGuardians(): Guardian[] {
  return GUARDIAN_SEEDS.map((seed, index) => ({
    id: `grd-${pad(index + 1, 3)}`,
    ...seed,
  }));
}

function buildStudents(guardians: Guardian[], sessionStartYear: number): Student[] {
  return ROSTER.map(([firstName, otherName, lastName, gender, className, arm, guardianIndex, stateOfOrigin], index) => {
    const age = CLASS_TYPICAL_AGE[className] + (rand() < 0.18 ? 1 : 0);
    const birthYear = sessionStartYear - age;
    const month = pad(between(1, 12), 2);
    const day = pad(between(1, 28), 2);
    const yearsInSchool = CLASS_ORDER.indexOf(className);
    const admissionYear = sessionStartYear - yearsInSchool;
    const division = divisionOfClass(className);
    const house = HOUSES[index % HOUSES.length] as House;

    return {
      id: `stu-${pad(index + 1, 3)}`,
      admissionNumber: `UPWA/${division === "SECONDARY" ? "SEC" : "PRY"}/${admissionYear}/${pad(index + 101, 4)}`,
      firstName,
      otherName,
      lastName,
      gender,
      dateOfBirth: `${birthYear}-${month}-${day}`,
      className,
      arm,
      house,
      guardianId: guardians[guardianIndex]?.id ?? guardians[0].id,
      address: guardians[guardianIndex]?.address ?? "Choba, Obio-Akpor",
      stateOfOrigin,
      admissionDate: `${admissionYear}-09-${pad(between(8, 20), 2)}`,
      status: "ACTIVE" as const,
      medicalNote: MEDICAL_NOTES[Math.floor(rand() * MEDICAL_NOTES.length)],
    };
  });
}

function buildStaff(): Staff[] {
  const seeds: [string, string, string, Gender, Staff["role"], string, string, string][] = [
    ["Mrs.", "Chinwe", "Chike", "FEMALE", "Head Teacher", "—", "Primary / Early Years", "0803 552 7710"],
    ["Mr.", "Anthony", "Wokoma", "MALE", "Principal", "—", "Secondary", "0816 447 9920"],
    ["Mrs.", "Bisi", "Adekunle", "FEMALE", "Vice Principal", "Economics", "SSS 1–3", "0809 336 1174"],
    ["Mrs.", "Uchenna", "Aluu", "FEMALE", "Class Teacher", "Literacy & Numeracy", "Primary 1A", "0706 228 4415"],
    ["Mr.", "Peter", "Imoh", "MALE", "Class Teacher", "Mathematics", "Primary 4A", "0813 774 0092"],
    ["Mrs.", "Hauwa", "Sadiq", "FEMALE", "Class Teacher", "Basic Science", "JSS 1B", "0902 118 6640"],
    ["Mr.", "Ebimiboere", "Dokubo", "MALE", "Subject Teacher", "Physics", "SSS 1–3", "0807 553 2281"],
    ["Mrs.", "Chinyere", "Nwosu", "FEMALE", "Subject Teacher", "English Language", "JSS 1–3", "0810 664 7738"],
    ["Mr.", "Tunde", "Olawale", "MALE", "Subject Teacher", "Further Mathematics", "SSS 1–3", "0705 992 4417"],
    ["Mrs.", "Ngozi", "Udeh", "FEMALE", "Subject Teacher", "Chemistry", "SSS 1–3", "0903 447 1180"],
    ["Mrs.", "Grace", "Ameh", "FEMALE", "Bursar", "—", "Bursary", "0802 664 9903"],
    ["Mr.", "Ikechukwu", "Anozie", "MALE", "ICT Officer", "Computer Studies", "Primary 3 – SSS 3", "0814 220 7765"],
    ["Mrs.", "Funmi", "Adelakun", "FEMALE", "Counsellor", "—", "All classes", "0708 331 6642"],
    ["Mr.", "Suleiman", "Bature", "MALE", "Administrator", "—", "School office", "0916 552 8804"],
    ["Mrs.", "Kainabo", "Cookey-Gam", "FEMALE", "Class Teacher", "Rhymes & Writing", "Nursery 2A", "0806 442 7719"],
    ["Mr.", "Joseph", "Etim", "MALE", "Subject Teacher", "Agricultural Science", "JSS 1–3", "0703 995 2284"],
  ];

  return seeds.map(([title, firstName, lastName, gender, role, subject, assignedClass, phone], index) => ({
    id: `stf-${pad(index + 1, 3)}`,
    staffNumber: `UPWA/STF/${pad(index + 21, 3)}`,
    title,
    firstName,
    lastName,
    gender,
    role,
    subject,
    assignedClass,
    phone,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@upwaschools.ng`,
    employmentDate: `${2016 + (index % 9)}-01-${pad(between(9, 20), 2)}`,
    status: index === 15 ? ("ON_LEAVE" as const) : ("ACTIVE" as const),
  }));
}

function buildSubjects(staff: Staff[]): Subject[] {
  const primary: SchoolClass[] = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
  const jss: SchoolClass[] = ["JSS 1", "JSS 2", "JSS 3"];
  const sss: SchoolClass[] = ["SSS 1", "SSS 2", "SSS 3"];
  const early: SchoolClass[] = ["Crèche", "Pre-Nursery", "Nursery 1", "Nursery 2"];

  const seeds: [string, string, Subject["level"], SchoolClass[], string][] = [
    ["EGG", "Literacy & Rhymes", "EARLY_YEARS", early, "Mrs. Kainabo Cookey-Gam"],
    ["EGN", "Numeracy & Counting", "EARLY_YEARS", early, "Mrs. Kainabo Cookey-Gam"],
    ["EWR", "Writing & Handwriting", "EARLY_YEARS", early, "Mrs. Uchenna Aluu"],
    ["ENG", "English Language", "LOWER_PRIMARY", primary, "Mrs. Chinyere Nwosu"],
    ["MTH", "Mathematics", "LOWER_PRIMARY", primary, "Mr. Peter Imoh"],
    ["BSC", "Basic Science", "LOWER_PRIMARY", primary, "Mrs. Hauwa Sadiq"],
    ["SOC", "Social Studies", "LOWER_PRIMARY", primary, "Mrs. Chinyere Nwosu"],
    ["CVC", "Civic Education", "LOWER_PRIMARY", primary, "Mr. Suleiman Bature"],
    ["CPT", "Computer Studies", "LOWER_PRIMARY", primary, "Mr. Ikechukwu Anozie"],
    ["IKW", "Nigerian Language (Ikwerre)", "LOWER_PRIMARY", primary, "Mrs. Kainabo Cookey-Gam"],
    ["CRS", "Christian Religious Studies", "LOWER_PRIMARY", primary, "Mrs. Funmi Adelakun"],
    ["PHE", "Physical & Health Education", "LOWER_PRIMARY", primary, "Mr. Joseph Etim"],
    ["ART", "Creative Arts", "LOWER_PRIMARY", primary, "Mrs. Uchenna Aluu"],
    ["ENG2", "English Language", "UPPER_PRIMARY", primary, "Mrs. Chinyere Nwosu"],
    ["MTH2", "Mathematics", "UPPER_PRIMARY", primary, "Mr. Peter Imoh"],
    ["BST", "Basic Science & Technology", "UPPER_PRIMARY", primary, "Mrs. Hauwa Sadiq"],
    ["FRE", "French", "JUNIOR_SECONDARY", jss, "Mrs. Bisi Adekunle"],
    ["BUS", "Business Studies", "JUNIOR_SECONDARY", jss, "Mrs. Grace Ameh"],
    ["BTS", "Basic Technology", "JUNIOR_SECONDARY", jss, "Mr. Joseph Etim"],
    ["CCA", "Cultural & Creative Arts", "JUNIOR_SECONDARY", jss, "Mrs. Uchenna Aluu"],
    ["ENG3", "English Language", "SENIOR_SECONDARY", sss, "Mrs. Chinyere Nwosu"],
    ["MTH3", "Mathematics", "SENIOR_SECONDARY", sss, "Mr. Tunde Olawale"],
    ["FMT", "Further Mathematics", "SENIOR_SECONDARY", sss, "Mr. Tunde Olawale"],
    ["BIO", "Biology", "SENIOR_SECONDARY", sss, "Mrs. Hauwa Sadiq"],
    ["CHM", "Chemistry", "SENIOR_SECONDARY", sss, "Mrs. Ngozi Udeh"],
    ["PHY", "Physics", "SENIOR_SECONDARY", sss, "Mr. Ebimiboere Dokubo"],
    ["ECO", "Economics", "SENIOR_SECONDARY", sss, "Mrs. Bisi Adekunle"],
    ["GOV", "Government", "SENIOR_SECONDARY", sss, "Mr. Suleiman Bature"],
    ["LIT", "Literature-in-English", "SENIOR_SECONDARY", sss, "Mrs. Chinyere Nwosu"],
    ["GEO", "Geography", "SENIOR_SECONDARY", sss, "Mr. Joseph Etim"],
    ["ACC", "Financial Accounting", "SENIOR_SECONDARY", sss, "Mrs. Grace Ameh"],
    ["DPR", "Data Processing", "SENIOR_SECONDARY", sss, "Mr. Ikechukwu Anozie"],
  ];

  return seeds.map(([code, name, level, classes, teacherName], index) => {
    const teacher = staff.find((member) => `${member.title} ${member.firstName} ${member.lastName}` === teacherName);
    return {
      id: `sub-${pad(index + 1, 3)}`,
      code,
      name,
      level,
      classes,
      teacherId: teacher?.id ?? staff[0].id,
    };
  });
}

/** Subjects a class actually sits for, using the Nigerian UBE/NERDC pattern. */
export function subjectsForClass(subjects: Subject[], className: SchoolClass): Subject[] {
  if (className === "Crèche" || className === "Pre-Nursery" || className === "Nursery 1" || className === "Nursery 2") {
    return subjects.filter((subject) => subject.level === "EARLY_YEARS");
  }
  const lower = ["Primary 1", "Primary 2", "Primary 3"];
  const jss = ["JSS 1", "JSS 2", "JSS 3"];
  if (lower.includes(className)) return subjects.filter((s) => s.level === "LOWER_PRIMARY");
  if (className === "Primary 4" || className === "Primary 5" || className === "Primary 6") {
    return subjects.filter((s) => s.level === "UPPER_PRIMARY" || s.code === "ENG2" || s.code === "MTH2").slice(0, 9);
  }
  if (jss.includes(className)) {
    return subjects.filter((s) => s.level === "JUNIOR_SECONDARY" || s.code === "ENG" || s.code === "MTH" || s.code === "BSC" || s.code === "SOC" || s.code === "CVC" || s.code === "CPT" || s.code === "CRS" || s.code === "PHE");
  }
  return subjects.filter((s) => s.level === "SENIOR_SECONDARY" || s.code === "ENG3" || s.code === "MTH3");
}

function buildScores(students: Student[], subjects: Subject[], session: string, term: TermCode): Score[] {
  const scores: Score[] = [];
  students.forEach((student, studentIndex) => {
    // A per-pupil aptitude keeps results coherent across subjects, like real school data.
    const aptitude = 0.42 + ((studentIndex * 37) % 53) / 100;
    subjectsForClass(subjects, student.className).forEach((subject, subjectIndex) => {
      const jitter = ((studentIndex * 13 + subjectIndex * 29) % 17) / 100;
      const ability = Math.min(0.99, aptitude + jitter - 0.08);
      const ca1 = Math.round(Math.max(6, Math.min(20, 20 * ability + between(-2, 2))));
      const ca2 = Math.round(Math.max(6, Math.min(20, 20 * ability + between(-2, 2))));
      const exam = Math.round(Math.max(15, Math.min(60, 60 * ability + between(-5, 5))));
      scores.push({
        id: `sco-${student.id}-${subject.id}`,
        studentId: student.id,
        subjectId: subject.id,
        className: student.className,
        arm: student.arm,
        session,
        term,
        ca1,
        ca2,
        exam,
      });
    });
  });
  return scores;
}

function buildAttendance(students: Student[], days: string[], recorder: string): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  days.forEach((date, dateIndex) => {
    students.forEach((student, studentIndex) => {
      const roll = ((studentIndex * 7 + dateIndex * 31) % 100);
      let status: AttendanceStatus = "PRESENT";
      if (roll > 94) status = "ABSENT";
      else if (roll > 89) status = "LATE";
      else if (roll > 86) status = "EXCUSED";
      records.push({
        id: `att-${student.id}-${date}`,
        studentId: student.id,
        className: student.className,
        arm: student.arm,
        date,
        status,
        note: status === "EXCUSED" ? "Excused — medical note from parent" : status === "ABSENT" ? "" : "",
        recordedBy: recorder,
      });
    });
  });
  return records;
}

function feeRowFor(className: SchoolClass, settings: DemoSettings) {
  const index = CLASS_ORDER.indexOf(className);
  if (index <= 1) return settings.fees[0];
  if (index <= 3) return settings.fees[1];
  if (index <= 5) return settings.fees[2];
  if (index <= 9) return settings.fees[3];
  if (index <= 12) return settings.fees[4];
  return settings.fees[5];
}

function buildInvoices(students: Student[], settings: DemoSettings): Invoice[] {
  const termLabel = settings.currentTerm === "FIRST" ? "First Term" : settings.currentTerm === "SECOND" ? "Second Term" : "Third Term";
  return students.map((student, index) => {
    const fee = feeRowFor(student.className, settings);
    const items = [
      { label: `Tuition fee — ${termLabel}, ${settings.session}`, amount: fee.tuition },
      { label: "Development levy", amount: Math.round(fee.levies * 0.5) },
      { label: "PTA dues", amount: Math.round(fee.levies * 0.2) },
      { label: "Examination & ICT levy", amount: Math.round(fee.levies * 0.3) },
    ];
    if (fee.feeding > 0) items.push({ label: `Feeding / lunch plan — ${termLabel}`, amount: fee.feeding });
    // Two thirds of families are due within the first month of term; the rest are on an
    // approved instalment plan whose balance falls due on the last day of term.
    const instalmentPlan = index % 3 === 2;
    return {
      id: `inv-${student.id}`,
      invoiceNumber: `INV/${settings.session.replace("/", "-")}/${pad(index + 311)}`,
      studentId: student.id,
      session: settings.session,
      term: settings.currentTerm,
      items,
      dueDate: instalmentPlan ? settings.termEndDate : iso(addDays(new Date(`${settings.termStartDate}T09:00:00`), 30)),
    };
  });
}

const BANKS = [
  "Zenith Bank",
  "Guaranty Trust Bank",
  "First Bank of Nigeria",
  "Access Bank",
  "United Bank for Africa",
  "Sterling Bank",
  "Wema Bank",
];

const METHOD_REF: Record<PaymentMethod, (n: number) => string> = {
  BANK_TRANSFER: (n) => `TRF/${pad(n, 9)}`,
  PAYSTACK: (n) => `PSK_${n.toString(36)}kd0lqp2`,
  CASH_BURSARY: (n) => `CASH-BUR-${pad(n, 4)}`,
};

function buildPayments(invoices: Invoice[], students: Student[], settings: DemoSettings, today: Date): Payment[] {
  const payments: Payment[] = [];
  let counter = 1;
  const termStart = new Date(`${settings.termStartDate}T09:00:00`);
  const spanDays = Math.max(10, Math.round((today.getTime() - termStart.getTime()) / 86400000));
  invoices.forEach((invoice, index) => {
    const student = students.find((item) => item.id === invoice.studentId);
    if (!student) return;
    const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const roll = (index * 23) % 100;
    // Roughly 63% of families have paid something this term; about half of those still
    // carry a balance, and a handful of transfers are waiting for the bursar to confirm.
    if (roll > 62) return;
    const method = pick<PaymentMethod>(["BANK_TRANSFER", "BANK_TRANSFER", "PAYSTACK", "CASH_BURSARY"]);
    const partial = roll > 34;
    const amount = partial ? Math.round((total * between(45, 80)) / 100 / 500) * 500 : total;
    const status: PaymentStatus = roll % 11 === 0 ? "PENDING_REVIEW" : "CONFIRMED";
    payments.push({
      id: `pay-${pad(counter, 4)}`,
      receiptNumber: `RCP/${settings.session.replace("/", "-")}/${pad(counter + 420)}`,
      invoiceId: invoice.id,
      studentId: student.id,
      amount,
      method,
      reference: METHOD_REF[method](counter + 100000),
      bank: method === "BANK_TRANSFER" ? pick(BANKS) : method === "PAYSTACK" ? "Paystack (card / transfer)" : "School bursary",
      status,
      paidAt: iso(addDays(termStart, between(0, spanDays))),
      recordedBy: "Mrs. Grace Ameh (Bursary)",
    });
    counter += 1;
    if (partial && roll % 7 === 0) {
      const second = Math.min(
        Math.max(0, total - amount - 500),
        Math.round((total * between(10, 25)) / 100 / 500) * 500,
      );
      if (second <= 0) return;
      payments.push({
        id: `pay-${pad(counter, 4)}`,
        receiptNumber: `RCP/${settings.session.replace("/", "-")}/${pad(counter + 420)}`,
        invoiceId: invoice.id,
        studentId: student.id,
        amount: second,
        method: "BANK_TRANSFER",
        reference: METHOD_REF.BANK_TRANSFER(counter + 200000),
        bank: pick(BANKS),
        status: "CONFIRMED",
        paidAt: iso(addDays(termStart, between(Math.round(spanDays * 0.55), spanDays))),
        recordedBy: "Mrs. Grace Ameh (Bursary)",
      });
      counter += 1;
    }
  });
  return payments;
}

function buildApplications(session: string): AdmissionApplication[] {
  const seeds: [string, string, Gender, SchoolClass, string, string, string, ApplicationStatus, string, string][] = [
    ["Amarachi", "Nnenna", "FEMALE", "Nursery 1", "Mrs. Nnenna Obi", "0803 774 2210", "nnenna.obi@gmail.com", "EXAM_SCHEDULED", "Little Angels Nursery, Rumuigbo", "Parent requested the morning feeding plan."],
    ["Tobi", "Segun", "MALE", "Primary 1", "Mr. Segun Bakare", "0816 220 7745", "segun.bakare@yahoo.com", "UNDER_REVIEW", "Home-schooled", "Transferring from Ekiti State."],
    ["Zainab", "Halima", "FEMALE", "JSS 1", "Alhaji Haliru Zango", "0706 991 3348", "haliru.zango@gmail.com", "SUBMITTED", "Capital City School, Kano", "Awaiting last session's report card."],
    ["Efe", "Oghenero", "MALE", "JSS 2", "Mrs. Oghenero Asiu", "0902 664 8812", "oghenero.asiu@gmail.com", "OFFER_MADE", "Delta Springs School, Warri", "Offer issued; parent to confirm by month end."],
    ["Chukwudi", "Ike", "MALE", "SSS 1", "Mr. Ike Onyekwere", "0810 447 2293", "ike.onyekwere@gmail.com", "EXAM_SCHEDULED", "Government Secondary School, Ohafia", "Sits Mathematics and English entrance papers."],
    ["Seyi", "Adedoyin", "FEMALE", "Primary 3", "Mrs. Adedoyin Olaniyan", "0809 335 6621", "adedoyin.o@gmail.com", "ENROLLED", "Sunbeam Kiddies, Ibadan", "Completed enrolment; uniform issued."],
    ["Musa", "Lawan", "MALE", "Primary 2", "Mrs. Fatima Lawan", "0913 228 4470", "fatima.lawan@gmail.com", "WAITLISTED", "Al-Amin Primary, Kaduna", "No vacancy in Primary 2A; waitlisted for 2B."],
    ["Ibinye", "Kula", "FEMALE", "Nursery 2", "Mrs. Kula Ibibo", "0703 882 9914", "kula.ibibo@gmail.com", "SUBMITTED", "—", "First-time applicant."],
    ["Daniel", "Oluwa", "MALE", "SSS 2", "Mr. Oluwa Fagbemi", "0802 663 4419", "o.fagbemi@gmail.com", "DECLINED", "Community High School, Abeokuta", "Entrance score below the SSS 2 cut-off."],
    ["Amaka", "Uche", "FEMALE", "Primary 4", "Mrs. Uche Nduka", "0818 447 2206", "uche.nduka@gmail.com", "UNDER_REVIEW", "Faith Academy, Port Harcourt", "Sibling of a current pupil — sibling discount applies."],
    ["Ebi", "Tamuno", "MALE", "Crèche", "Mrs. Tamuno Jack", "0806 552 7731", "tamuno.jack@gmail.com", "EXAM_SCHEDULED", "—", "Play-based observation scheduled, not a written test."],
    ["Halima", "Bintu", "FEMALE", "JSS 3", "Mr. Bintu Sallau", "0916 774 2208", "bintu.sallau@outlook.com", "OFFER_MADE", "Nigerian Tulip International College", "Requires BECE registration support."],
  ];

  return seeds.map(([firstName, otherName, gender, applyingFor, guardianName, guardianPhone, guardianEmail, status, previousSchool, note], index) => {
    const submitted = addDays(new Date(), -(between(4, 96)));
    return {
      id: `adm-${pad(index + 1, 3)}`,
      applicationNumber: `UPWA/APP/${new Date().getFullYear()}/${pad(index + 501)}`,
      firstName,
      lastName: otherName,
      dateOfBirth: `${new Date().getFullYear() - CLASS_TYPICAL_AGE[applyingFor]}-${pad(between(1, 12), 2)}-${pad(between(1, 28), 2)}`,
      gender,
      applyingFor,
      guardianName,
      guardianPhone,
      guardianEmail,
      previousSchool,
      status,
      submittedAt: iso(submitted),
      examDate: ["EXAM_SCHEDULED", "OFFER_MADE", "ENROLLED", "DECLINED"].includes(status)
        ? iso(addDays(submitted, between(7, 21)))
        : "",
      examVenue: ["EXAM_SCHEDULED", "OFFER_MADE", "ENROLLED", "DECLINED"].includes(status)
        ? "School examination hall, Choba campus"
        : "",
      note,
    };
  });
}

function buildEvents(settings: DemoSettings, today: Date): SchoolEvent[] {
  const startYear = Number(settings.session.split("/")[0]);
  const seeds: [string, string, SchoolEvent["type"], string, string, string][] = [
    ["First term resumes", `${startYear}-09-08`, "ACADEMIC", "All pupils, parents and staff", "Choba campus", "Resumption for the first term; registration opens at 7:45 a.m."],
    ["Independence Day celebration", `${startYear}-10-01`, "CEREMONY", "All pupils and parents", "School assembly ground", "March past by house, cultural displays and a short address by the Head Teacher."],
    ["First term mid-term break", `${startYear}-10-27`, "HOLIDAY", "All pupils", "—", "Pupils resume Monday of the following week."],
    ["Open day and parents' forum", `${startYear}-11-14`, "PTA", "Parents and guardians", "School auditorium", "Class teachers share first-term progress; bursary opens for fee enquiries."],
    ["Inter-house sports", `${startYear}-12-05`, "SPORTS", "All pupils and parents", "School sports field", "Delta, Niger, Bonny and Soku houses compete in track and field events."],
    ["First term examinations begin", `${startYear}-12-08`, "EXAMINATION", "Primary 1 – SSS 3", "Classrooms and exam hall", "Timetable published one week ahead; no pupil sits an exam with unpaid fees without bursary clearance."],
    ["End of year party and prize giving", `${startYear}-12-17`, "CEREMONY", "All pupils and parents", "School auditorium", "Academic prizes, house trophies and the first term closing assembly."],
    ["Second term begins", `${startYear + 1}-01-12`, "ACADEMIC", "All pupils", "Choba campus", "Resumption after the Christmas break."],
    ["SSS 3 mock examinations", `${startYear + 1}-02-09`, "EXAMINATION", "SSS 3", "Examination hall", "WAEC-format papers under timed conditions."],
    ["Cultural day", `${startYear + 1}-02-27`, "CEREMONY", "All pupils and parents", "School assembly ground", "Pupils wear traditional attire from their state of origin."],
    ["Easter break", `${startYear + 1}-04-02`, "HOLIDAY", "All pupils", "—", "School closes for the Easter period."],
    ["Third term begins", `${startYear + 1}-04-20`, "ACADEMIC", "All pupils", "Choba campus", "Shortest term; examinations start early."],
    ["Speech and prize-giving day", `${startYear + 1}-07-10`, "CEREMONY", "Parents, pupils and invited guests", "School auditorium", "Valedictory for SSS 3 and awards for the session."],
  ];

  return seeds.map(([title, date, type, audience, venue, description], index) => ({
    id: `evt-${pad(index + 1, 3)}`,
    title,
    date,
    endDate: "",
    type,
    audience,
    venue,
    description,
  })).filter((event) => {
    // Keep a window around "today" so the calendar always looks current.
    const diff = Math.abs(new Date(event.date).getTime() - today.getTime()) / 86400000;
    return diff < 300;
  });
}

function buildMessages(today: Date): Message[] {
  const seeds: [string, string, Message["channel"], string, Message["status"], number, number][] = [
    ["First term mid-term break notice", "Dear parent, please note that the mid-term break begins Monday and pupils resume the following Monday. Kindly ensure all outstanding fees are cleared before the break.", "SMS_AND_EMAIL", "All parents and guardians", "SENT", 1184, -14],
    ["Outstanding school fees reminder", "Dear parent, our records show an outstanding balance on your ward's invoice for the current term. Kindly visit the bursary or pay through the portal. Thank you.", "SMS", "Parents with a balance", "SENT", 216, -9],
    ["Inter-house sports invitation", "You are warmly invited to our Inter-house Sports at the school field. Events begin at 8:30 a.m. Delta, Niger, Bonny and Soku houses will compete for the coveted trophy.", "EMAIL", "All parents and guardians", "SENT", 1184, -6],
    ["Examination timetable released", "The first term examination timetable is now available on the parent portal. Pupils should arrive by 7:45 a.m. with their examination materials and identity card.", "SMS_AND_EMAIL", "Primary 1 – SSS 3 parents", "SCHEDULED", 962, 3],
    ["Report card collection", "Term reports will be available for collection from the class teacher. Please present your report card PIN where required.", "SMS", "All parents and guardians", "DRAFT", 1184, 9],
    ["Harmattan health advisory", "With the harmattan season here, the school nurse advises parents to pack lip balm, warm clothing and sufficient water for pupils. The sick bay remains open all week.", "EMAIL", "All parents and guardians", "DRAFT", 1184, 12],
    ["PTA general meeting", "The Parent Teachers Association will hold its general meeting in the school auditorium. Agenda: fee adjustment for the next session and the new laboratory project.", "SMS_AND_EMAIL", "PTA members", "SCHEDULED", 486, 6],
  ];

  return seeds.map(([subject, body, channel, audience, status, recipients, dayOffset], index) => ({
    id: `msg-${pad(index + 1, 3)}`,
    subject,
    body,
    channel,
    audience,
    status,
    recipients,
    sentAt: status === "SENT" ? iso(addDays(today, dayOffset)) : "",
  }));
}

/* -------------------------------- settings ------------------------------- */

function buildSettings(session: string, term: TermCode): DemoSettings {
  const dates = termWindow(session, term);
  return {
    schoolName: "UPWA International Group of Schools",
    session,
    currentTerm: term,
    termStartDate: dates.start,
    termEndDate: dates.end,
    nextTermBegins: dates.next,
    caMax: 20,
    examMax: 60,
    attendanceTarget: 92,
    grading: [
      { min: 75, grade: "A1", remark: "Excellent" },
      { min: 70, grade: "B2", remark: "Very good" },
      { min: 65, grade: "B3", remark: "Good" },
      { min: 60, grade: "C4", remark: "Credit" },
      { min: 55, grade: "C5", remark: "Credit" },
      { min: 50, grade: "C6", remark: "Credit" },
      { min: 45, grade: "D7", remark: "Pass" },
      { min: 40, grade: "E8", remark: "Weak pass" },
      { min: 0, grade: "F9", remark: "Fail" },
    ],
    fees: [
      { id: "fee-creche", level: "Crèche / Pre-Nursery", tuition: 95000, levies: 15000, feeding: 45000 },
      { id: "fee-nursery", level: "Nursery 1 – 2", tuition: 105000, levies: 18000, feeding: 45000 },
      { id: "fee-lower", level: "Primary 1 – 3", tuition: 125000, levies: 22000, feeding: 40000 },
      { id: "fee-upper", level: "Primary 4 – 6", tuition: 135000, levies: 25000, feeding: 40000 },
      { id: "fee-jss", level: "JSS 1 – 3", tuition: 165000, levies: 30000, feeding: 0 },
      { id: "fee-sss", level: "SSS 1 – 3", tuition: 195000, levies: 38000, feeding: 0 },
    ],
  };
}

/* ------------------------------- assembler ------------------------------- */

export function buildDemoData(today = new Date()): DemoData {
  const { session, term } = academicContext(today);
  const sessionStartYear = Number(session.split("/")[0]);

  const guardians = buildGuardians();
  const staff = buildStaff();
  const students = buildStudents(guardians, sessionStartYear);
  const subjects = buildSubjects(staff);
  const settings = buildSettings(session, term);
  const scores = buildScores(students, subjects, session, term);
  const days = recentSchoolDays(12, today);
  const attendance = buildAttendance(students, days, "Mrs. Uchenna Aluu (Class Teacher)");
  const invoices = buildInvoices(students, settings);
  const payments = buildPayments(invoices, students, settings, today);
  const applications = buildApplications(session);
  const events = buildEvents(settings, today).sort((a, b) => a.date.localeCompare(b.date));
  const messages = buildMessages(today);

  return {
    students,
    guardians,
    staff,
    subjects,
    attendance,
    scores,
    invoices,
    payments,
    applications,
    events,
    messages,
    settings,
  };
}

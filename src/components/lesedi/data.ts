export type Priority = "Critical" | "High" | "Medium" | "Low";

export type Incident = {
  id: string;
  place: string;
  detail: string;
  priority: Priority;
  people: string;
  age: string;
  lat: number;
  lng: number;
  /** Set when the incident came from a citizen outage report or from the sensor network. */
  source?: "citizen" | "auto";
};

export type Role = "Customer" | "Technician" | "Dispatcher" | "Department manager";
export type MockUser = {
  role: Role;
  name: string;
  email: string;
  /** Demo accounts only. Accounts made on the sign-up page keep a salted hash instead of a password. */
  password?: string;
  /** Where the one-time PIN is sent. */
  phone: string;
  to: "/dashboard/customer" | "/dashboard/technician" | "/dashboard/dispatcher" | "/dashboard/manager";
  /** Customers only: the home suburb. Outage alerts for it follow the resident wherever they are. */
  area?: string;
  /** Customers only: the sensor-network area of that suburb, which drives their home-area alerts. */
  areaId?: string;
  /** Customers only: show the sample past reports (kept to the first demo customer). */
  seedHistory?: boolean;
  /** Staff only: the job title shown under their name. */
  title?: string;
};

/**
 * Field crews. This one list drives the technician logins, the dispatcher's crew board, the manager's
 * workforce view and the map, so a technician the dispatcher can pick is always one who can log in.
 * `lat`/`lng` is where the crew is based (their depot); live GPS replaces it while they are signed in.
 */
type CrewSeed = { name: string; skill: string; depot: string; lat: number; lng: number; email: string; password: string; phone: string };

const crewSeeds: CrewSeed[] = [
  { name: "Thabo Molefe", skill: "High voltage", depot: "Soshanguve depot", lat: -25.505, lng: 28.109, email: "thabo.molefe@lesedilink.co.za", password: "Thabo!HV2026", phone: "083 220 9911" },
  { name: "Mpho Sekhukhune", skill: "Overhead lines", depot: "Soshanguve depot", lat: -25.497, lng: 28.102, email: "mpho.sekhukhune@lesedilink.co.za", password: "Mpho!Lines2026", phone: "083 301 4420" },
  { name: "Maria Dlamini", skill: "Infrastructure", depot: "Pretoria Central depot", lat: -25.741, lng: 28.187, email: "maria.dlamini@lesedilink.co.za", password: "Maria!Infra2026", phone: "082 640 1177" },
  { name: "Fatima Patel", skill: "Emergency response", depot: "Pretoria Central depot", lat: -25.752, lng: 28.192, email: "fatima.patel@lesedilink.co.za", password: "Fatima!Rapid2026", phone: "084 512 3390" },
  { name: "James Nkosi", skill: "Electrical", depot: "Pretoria East depot", lat: -25.746, lng: 28.236, email: "james.nkosi@lesedilink.co.za", password: "James!Elec2026", phone: "071 288 6403" },
  { name: "Sizwe Cele", skill: "Cable faults", depot: "Pretoria East depot", lat: -25.754, lng: 28.244, email: "sizwe.cele@lesedilink.co.za", password: "Sizwe!Cable2026", phone: "073 774 2058" },
  { name: "Ayanda Zulu", skill: "Meters and service connections", depot: "Mamelodi depot", lat: -25.698, lng: 28.352, email: "ayanda.zulu@lesedilink.co.za", password: "Ayanda!Meter2026", phone: "076 419 8862" },
  { name: "Themba Nxumalo", skill: "Cable jointing", depot: "Mamelodi depot", lat: -25.704, lng: 28.347, email: "themba.nxumalo@lesedilink.co.za", password: "Themba!Joint2026", phone: "082 903 5514" },
  { name: "Lindiwe Khumalo", skill: "Protection and control", depot: "Centurion depot", lat: -25.856, lng: 28.187, email: "lindiwe.khumalo@lesedilink.co.za", password: "Lindiwe!Prot2026", phone: "083 655 7301" },
  { name: "Pieter van Wyk", skill: "Overhead lines", depot: "Centurion depot", lat: -25.862, lng: 28.194, email: "pieter.vanwyk@lesedilink.co.za", password: "Pieter!Lines2026", phone: "072 347 9925" },
];

export type Technician = { name: string; skill: string; depot: string; initials: string; lat: number; lng: number };

const initialsOf = (name: string) => name.split(" ").map((part) => part[0]).join("");

export const technicians: Technician[] = crewSeeds.map(({ name, skill, depot, lat, lng }) => ({ name, skill, depot, initials: initialsOf(name), lat, lng }));
export const depotNames = [...new Set(technicians.map((tech) => tech.depot))];

const crewAccounts: MockUser[] = crewSeeds.map((crew) => ({
  role: "Technician",
  name: crew.name,
  email: crew.email,
  password: crew.password,
  phone: crew.phone,
  to: "/dashboard/technician",
  title: `Field technician · ${crew.skill}`,
}));

export const mockUsers: MockUser[] = [
  { role: "Customer", name: "Lerato Sithole", email: "lerato.sithole@gmail.com", password: "Lerato#Mamelodi24", phone: "082 411 2233", to: "/dashboard/customer", area: "Mamelodi East", areaId: "mamelodi", seedHistory: true },
  { role: "Customer", name: "Sipho Ndlovu", email: "sipho.ndlovu@gmail.com", password: "Sipho#Tsamaya25", phone: "082 555 1111", to: "/dashboard/customer", area: "Mamelodi East", areaId: "mamelodi" },
  { role: "Customer", name: "Naomi Botha", email: "naomi.botha@gmail.com", password: "Naomi$Hatfield26", phone: "071 903 4477", to: "/dashboard/customer", area: "Hatfield", areaId: "hatfield" },
  { role: "Customer", name: "Nomsa Mahlangu", email: "nomsa.mahlangu@gmail.com", password: "Nomsa#Soshanguve26", phone: "073 662 1840", to: "/dashboard/customer", area: "Soshanguve Block H", areaId: "soshanguve" },
  { role: "Customer", name: "Bongani Sithebe", email: "bongani.sithebe@gmail.com", password: "Bongani#BlockH26", phone: "076 208 5537", to: "/dashboard/customer", area: "Soshanguve Block H", areaId: "soshanguve" },
  { role: "Customer", name: "Karabo Mokwena", email: "karabo.mokwena@gmail.com", password: "Karabo#Pretoria26", phone: "081 774 6209", to: "/dashboard/customer", area: "Pretoria CBD", areaId: "cbd" },
  { role: "Customer", name: "Zinhle Khoza", email: "zinhle.khoza@gmail.com", password: "Zinhle#Centurion26", phone: "079 130 4468", to: "/dashboard/customer", area: "Centurion", areaId: "centurion" },
  ...crewAccounts,
  { role: "Dispatcher", name: "Naledi Mokoena", email: "naledi.mokoena@lesedilink.co.za", password: "Naledi@Control7", phone: "084 300 1200", to: "/dashboard/dispatcher", title: "Senior dispatcher" },
  { role: "Dispatcher", name: "Tumelo Radebe", email: "tumelo.radebe@lesedilink.co.za", password: "Tumelo@Control8", phone: "084 300 1201", to: "/dashboard/dispatcher", title: "Dispatcher · Northern region" },
  { role: "Dispatcher", name: "Zanele Dube", email: "zanele.dube@lesedilink.co.za", password: "Zanele@Control9", phone: "084 300 1202", to: "/dashboard/dispatcher", title: "Dispatcher · Eastern region" },
  { role: "Department manager", name: "Kagiso Phiri", email: "kagiso.phiri@lesedilink.co.za", password: "Kagiso$Energy2026", phone: "076 118 5540", to: "/dashboard/manager", title: "Department manager · Energy & Electricity" },
];

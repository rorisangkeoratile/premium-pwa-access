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
  /** Set when the incident came from a citizen outage report. */
  source?: "citizen" | "auto";
};

export const primaryIncident: Incident = {
  id: "#LL-4821",
  place: "Soshanguve Block H",
  detail: "Primary transformer failure",
  priority: "Critical",
  people: "5,240",
  age: "8 min",
  lat: -25.488,
  lng: 28.098,
};

export const incidents: Incident[] = [
  primaryIncident,
  { id: "#LL-4819", place: "Pretoria CBD", detail: "Substation trip · Church St", priority: "High", people: "1,860", age: "14 min", lat: -25.7461, lng: 28.1881 },
  { id: "#LL-4814", place: "Hatfield", detail: "Partial supply interruption", priority: "Medium", people: "420", age: "23 min", lat: -25.7487, lng: 28.238 },
  { id: "#LL-4808", place: "Centurion", detail: "Residential feeder fault", priority: "Low", people: "68", age: "37 min", lat: -25.8603, lng: 28.1894 },
];

/** Public status line for the sample incidents (real ones get theirs from the technician's progress). */
export const seedStatus: Record<string, string> = {
  "#LL-4821": "Crew dispatched",
  "#LL-4819": "Technician on site",
  "#LL-4814": "Investigating",
  "#LL-4808": "Report received",
};

export const technicians = [
  { name: "Thabo Molefe", skill: "High voltage", distance: "2.4 km", status: "Available", initials: "TM", lat: -25.505, lng: 28.109 },
  { name: "Maria Dlamini", skill: "Infrastructure", distance: "5.8 km", status: "Available", initials: "MD", lat: -25.71, lng: 28.19 },
  { name: "James Nkosi", skill: "Electrical", distance: "8.1 km", status: "On job", initials: "JN", lat: -25.746, lng: 28.236 },
];

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
  /** Customers only: suburb shown in their profile, and the sensor-network area used for their outage notices. */
  area?: string;
  areaId?: string;
  /** Customers only: show the sample past reports (kept to the first demo customer). */
  seedHistory?: boolean;
};

export const mockUsers: MockUser[] = [
  { role: "Customer", name: "Lerato Sithole", email: "lerato.sithole@gmail.com", password: "Lerato#Mamelodi24", phone: "082 411 2233", to: "/dashboard/customer", area: "Mamelodi East", areaId: "mamelodi", seedHistory: true },
  { role: "Customer", name: "Sipho Ndlovu", email: "sipho.ndlovu@gmail.com", password: "Sipho#Tsamaya25", phone: "082 555 1111", to: "/dashboard/customer", area: "Mamelodi East", areaId: "mamelodi" },
  { role: "Customer", name: "Naomi Botha", email: "naomi.botha@gmail.com", password: "Naomi$Hatfield26", phone: "071 903 4477", to: "/dashboard/customer", area: "Hatfield", areaId: "hatfield" },
  { role: "Technician", name: "Thabo Molefe", email: "thabo.molefe@lesedilink.co.za", password: "Thabo!HV2026", phone: "083 220 9911", to: "/dashboard/technician" },
  { role: "Dispatcher", name: "Naledi Mokoena", email: "naledi.mokoena@lesedilink.co.za", password: "Naledi@Control7", phone: "084 300 1200", to: "/dashboard/dispatcher" },
  { role: "Department manager", name: "Kagiso Phiri", email: "kagiso.phiri@lesedilink.co.za", password: "Kagiso$Energy2026", phone: "076 118 5540", to: "/dashboard/manager" },
];

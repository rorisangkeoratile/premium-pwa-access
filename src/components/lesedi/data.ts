export type Priority = "Critical" | "High" | "Medium" | "Low";

export type Incident = {
  id: string;
  place: string;
  detail: string;
  priority: Priority;
  people: string;
  age: string;
  x: string;
  y: string;
};

export const primaryIncident: Incident = {
  id: "#LL-4821",
  place: "Soshanguve Block H",
  detail: "Primary transformer failure",
  priority: "Critical",
  people: "5,240",
  age: "8 min",
  x: "27%",
  y: "29%",
};

export const incidents: Incident[] = [
  primaryIncident,
  { id: "#LL-4819", place: "Pretoria CBD", detail: "Substation trip · Church St", priority: "High", people: "1,860", age: "14 min", x: "51%", y: "55%" },
  { id: "#LL-4814", place: "Hatfield", detail: "Partial supply interruption", priority: "Medium", people: "420", age: "23 min", x: "67%", y: "45%" },
  { id: "#LL-4808", place: "Centurion", detail: "Residential feeder fault", priority: "Low", people: "68", age: "37 min", x: "57%", y: "78%" },
];

export const technicians = [
  { name: "Thabo Molefe", skill: "High voltage", distance: "2.4 km", status: "Available", initials: "TM" },
  { name: "Maria Dlamini", skill: "Infrastructure", distance: "5.8 km", status: "Available", initials: "MD" },
  { name: "James Nkosi", skill: "Electrical", distance: "8.1 km", status: "On job", initials: "JN" },
];

export const mockUsers = [
  { role: "Customer", name: "Lerato Sithole", email: "lerato.sithole@gmail.com", password: "Lerato#Mamelodi24", to: "/dashboard/customer" },
  { role: "Technician", name: "Thabo Molefe", email: "thabo.molefe@lesedilink.co.za", password: "Thabo!HV2026", to: "/dashboard/technician" },
  { role: "Dispatcher", name: "Naledi Mokoena", email: "naledi.mokoena@lesedilink.co.za", password: "Naledi@Control7", to: "/dashboard/dispatcher" },
  { role: "Department manager", name: "Kagiso Phiri", email: "kagiso.phiri@lesedilink.co.za", password: "Kagiso$Energy2026", to: "/dashboard/manager" },
] as const;

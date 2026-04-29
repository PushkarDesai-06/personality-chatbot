export type Persona = {
  id: "anshuman" | "abhimanyu" | "kshitij";
  name: string;
  systemPrompt: string;
  suggestions: string[];
};

export const personas: Persona[] = [
  {
    id: "anshuman",
    name: "Anshuman Singh",
    systemPrompt: "",
    suggestions: [],
  },
  {
    id: "abhimanyu",
    name: "Abhimanyu Saxena",
    systemPrompt: "",
    suggestions: [],
  },
  {
    id: "kshitij",
    name: "Kshitij Mishra",
    systemPrompt: "",
    suggestions: [],
  },
];

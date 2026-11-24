export const genders = ["Woman", "Man", "Nonbinary", "Other", "Prefer not to say"] as const;
export const matchGenders = ["Women", "Men", "Nonbinary people", "Everyone"] as const;
export const relationships = [
  "Long-term relationship",
  "Short-term dating",
  "Friendship",
  "Still figuring it out",
] as const;

export const interestGroups = {
  Culture: ["Reading", "Film", "Music", "Photography", "Art", "Design"],
  Outdoors: ["Hiking", "Cycling", "Camping", "Running", "Gardening", "Travel"],
  Lifestyle: ["Cooking", "Coffee", "Fitness", "Gaming", "Volunteering", "Pets"],
} as const;
export const interests = Object.values(interestGroups).flat();

export const questions = {
  weekend: "What does your ideal weekend look like?",
  connection: "How do you like to connect with someone new?",
  spontaneity: "How often do you enjoy spontaneous plans?",
} as const;
export const answers = {
  weekend: ["A quiet reset", "An adventure outside", "Time with friends"],
  connection: ["A long conversation", "A shared activity", "A little of both"],
  spontaneity: ["Rarely", "Sometimes", "Often"],
} as const;

export const photoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const photoLimit = 5 * 1024 * 1024;
export const selfieLimit = 1024 * 1024;

import { z } from "zod";
import { ApiError } from "../onboarding/profile.js";
import { dateActivities } from "./options.js";

const types: Record<string, string[]> = {
  Coffee: ["cafe"],
  Bowling: ["bowling_alley"],
  Arcade: ["amusement_center"],
  Museum: ["museum"],
  Mall: ["shopping_mall"],
  Walk: ["park"],
};
const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  formattedAddress: z.string().optional(),
  attributions: z
    .array(z.object({ provider: z.string().optional(), providerUri: z.string().optional() }))
    .optional(),
  businessStatus: z.string().optional(),
});

export async function nearbyVenues(
  key: string,
  activity: string,
  latitude: number,
  longitude: number,
) {
  z.enum(dateActivities).parse(activity);
  if (!key) throw new ApiError(503, "Venue search is unavailable. Try again later.");
  try {
    console.info(JSON.stringify({ event: "venue_search_request" }));
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.attributions,places.businessStatus",
      },
      body: JSON.stringify({
        includedTypes: types[activity],
        maxResultCount: 10,
        locationRestriction: { circle: { center: { latitude, longitude }, radius: 5000 } },
      }),
    });
    if (!response.ok) throw new Error(`Places HTTP ${response.status}`);
    const data = z.object({ places: z.array(placeSchema).optional() }).parse(await response.json());
    return (data.places ?? [])
      .filter((place) => !place.businessStatus?.startsWith("CLOSED_"))
      .map((place) => ({
        id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress ?? "Address unavailable",
        attributions: place.attributions ?? [],
      }));
  } catch (error) {
    console.error("Venue search failed", error instanceof Error ? error.message : "Unknown error");
    throw new ApiError(503, "Venue search is unavailable. Try again later.");
  }
}

import { z } from "zod";

type Point = { latitude: number; longitude: number };
type Venue = { id: string; name: string; address: string };
const element = z.object({
  originIndex: z.number().int().default(0),
  destinationIndex: z.number().int().default(0),
  status: z.object({ code: z.number().optional() }).optional(),
  condition: z.string().optional(),
  duration: z
    .string()
    .regex(/^\d+(?:\.\d+)?s$/)
    .optional(),
});

export async function walkingOptions<T extends Venue>(
  venues: T[],
  origins: [Point, Point],
  key: string,
) {
  if (!key || !venues.length) return venues;
  const shortlist = venues.slice(0, 3);
  const started = performance.now();
  let completePairs = 0;
  let providerSucceeded = false;
  try {
    const response = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        signal: AbortSignal.timeout(3500),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,duration",
        },
        body: JSON.stringify({
          travelMode: "WALK",
          origins: origins.map((latLng) => ({ waypoint: { location: { latLng } } })),
          destinations: shortlist.map((v) => ({ waypoint: { placeId: v.id } })),
        }),
      },
    );
    if (!response.ok) return venues;
    const times = shortlist.map(() => [Infinity, Infinity]);
    for (const row of z.array(element).parse(await response.json())) {
      if (
        row.originIndex < 0 ||
        row.originIndex > 1 ||
        !times[row.destinationIndex] ||
        row.status?.code ||
        row.condition !== "ROUTE_EXISTS" ||
        !row.duration
      )
        continue;
      times[row.destinationIndex][row.originIndex] = Number.parseFloat(row.duration);
    }
    providerSucceeded = true;
    completePairs = times.filter((pair) => pair.every(Number.isFinite)).length;
    const ranked = shortlist
      .map((venue, i) => ({
        venue,
        own: times[i][0],
        longest: Math.max(...times[i]),
        sum: times[i][0] + times[i][1],
      }))
      .sort((a, b) => a.longest - b.longest || a.sum - b.sum);
    return [
      ...ranked.map(({ venue, own, longest }) => ({
        ...venue,
        walkingMinutes: Number.isFinite(own) ? Math.ceil(own / 60) : null,
        balanced: Number.isFinite(longest),
      })),
      ...venues.slice(3),
    ];
  } catch {
    return venues;
  } finally {
    console.info(
      JSON.stringify({
        event: "venue_route_matrix",
        elements: 2 * shortlist.length,
        completePairs,
        providerSucceeded,
        ms: Math.round(performance.now() - started),
      }),
    );
  }
}
export function middleLongitude(a: number, b: number) {
  return ((a + (((b - a + 540) % 360) - 180) / 2 + 540) % 360) - 180;
}

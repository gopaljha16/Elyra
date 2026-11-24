"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { endpoint, message } from "@/lib/onboarding";

type Candidate = { id: string; name: string; age: number; location: string; interests: string[]; activities: string[] };
type Plan = { activity: string | null; location: string; scheduledAt: string | null; status: string; proposalVersion: number } | null;
type Match = { id: string; status: string; person: { id: string; name: string; age: number }; acceptedByMe: boolean; acceptedByThem: boolean; activities: string[]; plan: Plan };
type Venue = { id: string; name: string; address: string };
const options = ["Coffee", "Bowling", "Arcade", "Museum", "Mall", "Walk"];

export function Dating({ initialActivities, initialLocation }: { initialActivities: string[]; initialLocation: string }) {
  const { getToken } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [location, setLocation] = useState(initialLocation);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activity, setActivity] = useState("Coffee");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, { attended: boolean; rating: number; comfort: number; enjoyment: number; wouldMeetAgain: boolean }>>({});

  const request = useCallback(async (path: string, method = "GET", body?: unknown) => {
    const token = await getToken();
    const response = await fetch(`${endpoint}/api/dating${path}`, {
      method, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Request failed. Try again.");
    }
    return response.status === 204 ? null : response.json();
  }, [getToken]);

  const refresh = useCallback(async () => {
    const data = await request("/matches");
    setMatches(data.matches);
    if (activities.length && location) setCandidates((await request("/candidates")).candidates);
  }, [request, activities.length, location]);

  useEffect(() => { void request("/matches").then((data) => setMatches(data.matches)).catch((error) => setNotice(message(error))); }, [request]);

  async function act(operation: () => Promise<void>) {
    setBusy(true); setNotice("");
    try { await operation(); await refresh(); }
    catch (error) { setNotice(message(error)); }
    finally { setBusy(false); }
  }

  function setArea() {
    if (!navigator.geolocation) { setNotice("Location is unavailable in this browser."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      void act(async () => {
        await request("/area", "PUT", { location, latitude: position.coords.latitude, longitude: position.coords.longitude });
        setCandidates((await request("/candidates")).candidates);
      });
    }, () => setNotice("Allow location access to find compatible people nearby."), { enableHighAccuracy: false, timeout: 10000 });
  }

  async function loadVenues(match: Match) {
    setSelected(match.id);
    setVenues([]);
    setVenueId("");
    if (!match.activities.includes(activity)) setActivity(match.activities[0] ?? "Coffee");
    const data = await request(`/matches/${match.id}/venues?activity=${encodeURIComponent(match.activities.includes(activity) ? activity : match.activities[0])}`);
    setVenues(data.venues);
  }

  const current = matches.find((match) => match.id === selected);
  return <section className="dating-panel">
    <h2>Meet someone nearby</h2>
    <p>Choose activities you’d enjoy together, then set your city and approximate area.</p>
    <div className="chips">{options.map((item) => <button type="button" className="chip" aria-pressed={activities.includes(item)} key={item} disabled={busy} onClick={() => setActivities((previous) => previous.includes(item) ? previous.filter((value) => value !== item) : previous.length < 5 ? [...previous, item] : previous)}>{item}</button>)}</div>
    <div className="actions">
      <button className="action" disabled={busy || !activities.length} onClick={() => void act(async () => {
        const token = await getToken();
        const response = await fetch(`${endpoint}/api/onboarding/date-activities`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ activities }) });
        if (!response.ok) throw new Error("Couldn’t save date activities.");
      })}>Save activities</button></div>
    <div className="field"><label htmlFor="area">City</label><input id="area" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Your city" /></div>
    <div className="actions"><button className="outline" disabled={busy || location.trim().length < 2} onClick={setArea}>Use my approximate area</button>
      <button className="action" disabled={busy || !location || !activities.length} onClick={() => void act(async () => { setCandidates((await request("/candidates")).candidates); })}>Find matches</button></div>
    {notice && <p className="notice" role="alert">{notice}</p>}
    {candidates.length > 0 && <div><h2>Compatible people</h2>{candidates.map((person) => <article className="dating-item" key={person.id}><strong>{person.name}, {person.age}</strong><p>{person.location} · Shared interests: {person.interests.join(", ") || "none yet"}</p><p>Shared dates: {person.activities.join(", ") || "choose together"}</p><button className="action" disabled={busy} onClick={() => void act(async () => { await request("/matches", "POST", { userId: person.id }); setCandidates((previous) => previous.filter((item) => item.id !== person.id)); })}>Invite to match</button></article>)}</div>}
    <h2>Your matches</h2>{matches.length === 0 && <p>Invitations and matches will appear here.</p>}
    {matches.map((match) => <article className="dating-item" key={match.id}><strong>{match.person.name}, {match.person.age}</strong><p>{match.status === "PENDING" ? match.acceptedByMe ? "Waiting for their answer" : "Invited you to match" : match.status === "ACTIVE" ? "Matched" : match.status}</p>
      {match.status === "PENDING" && !match.acceptedByMe && <button className="action" disabled={busy} onClick={() => void act(async () => { await request(`/matches/${match.id}/accept`, "POST"); })}>Accept match</button>}
      {match.status === "PENDING" && <button className="quiet" disabled={busy} onClick={() => void act(async () => { await request(`/matches/${match.id}/decline`, "POST"); })}>Decline</button>}
      {match.status === "ACTIVE" && <><p>Shared activities: {match.activities.join(", ") || "none selected"}</p><button className="outline" disabled={busy || !match.activities.length} onClick={() => void act(() => loadVenues(match))}>Plan a date</button></>}
      {match.plan && <p>Plan: {match.plan.activity} at {match.plan.location}, {match.plan.scheduledAt ? new Date(match.plan.scheduledAt).toLocaleString() : "time pending"} · {match.plan.status}</p>}
      {match.plan?.status === "PROPOSED" && <button className="action" disabled={busy} onClick={() => void act(async () => { await request(`/matches/${match.id}/plan/accept`, "POST", { version: match.plan?.proposalVersion }); })}>Accept this plan</button>}
      {match.plan && match.plan.status !== "CANCELLED" && <button className="quiet" disabled={busy} onClick={() => void act(async () => { await request(`/matches/${match.id}/plan/cancel`, "POST"); })}>Cancel plan</button>}
      {match.plan?.scheduledAt && new Date(match.plan.scheduledAt) <= new Date() && <div className="feedback-box"><h3>How was your date?</h3>
        <label><input type="checkbox" checked={feedback[match.id]?.attended ?? false} onChange={(event) => setFeedback((previous) => ({ ...previous, [match.id]: { ...previous[match.id], attended: event.target.checked, rating: previous[match.id]?.rating ?? 3, comfort: previous[match.id]?.comfort ?? 3, enjoyment: previous[match.id]?.enjoyment ?? 3, wouldMeetAgain: previous[match.id]?.wouldMeetAgain ?? false } }))} /> We met in person</label>
        {(["rating", "comfort", "enjoyment"] as const).map((field) => <div className="field" key={field}><label htmlFor={`${match.id}-${field}`}>{field === "rating" ? "Overall" : field === "comfort" ? "Comfort" : "Enjoyment"} (1–5)</label><select id={`${match.id}-${field}`} value={feedback[match.id]?.[field] ?? 3} onChange={(event) => setFeedback((previous) => ({ ...previous, [match.id]: { attended: previous[match.id]?.attended ?? false, wouldMeetAgain: previous[match.id]?.wouldMeetAgain ?? false, rating: previous[match.id]?.rating ?? 3, comfort: previous[match.id]?.comfort ?? 3, enjoyment: previous[match.id]?.enjoyment ?? 3, [field]: Number(event.target.value) } }))}>{[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}</select></div>)}
        <label><input type="checkbox" checked={feedback[match.id]?.wouldMeetAgain ?? false} onChange={(event) => setFeedback((previous) => ({ ...previous, [match.id]: { attended: previous[match.id]?.attended ?? false, rating: previous[match.id]?.rating ?? 3, comfort: previous[match.id]?.comfort ?? 3, enjoyment: previous[match.id]?.enjoyment ?? 3, wouldMeetAgain: event.target.checked } }))} /> I would meet again</label>
        <button className="action" disabled={busy} onClick={() => void act(async () => { await request(`/matches/${match.id}/feedback`, "POST", { attended: feedback[match.id]?.attended ?? false, rating: feedback[match.id]?.rating ?? 3, comfort: feedback[match.id]?.comfort ?? 3, enjoyment: feedback[match.id]?.enjoyment ?? 3, wouldMeetAgain: feedback[match.id]?.wouldMeetAgain ?? false }); setNotice("Your feedback was saved privately."); })}>Save private feedback</button>
      </div>}
      <button className="quiet" disabled={busy} onClick={() => void act(async () => { await request("/blocks", "POST", { userId: match.person.id }); })}>Block</button>
      <button className="quiet" disabled={busy} onClick={() => { const reason = window.prompt("What happened?"); if (reason) void act(async () => { await request("/reports", "POST", { userId: match.person.id, reason }); }); }}>Report</button>
    </article>)}
    {current && <div className="dating-item"><h2>Choose a place</h2><select value={activity} onChange={(event) => { setActivity(event.target.value); void act(async () => { const data = await request(`/matches/${current.id}/venues?activity=${encodeURIComponent(event.target.value)}`); setVenues(data.venues); setVenueId(""); }); }}>{current.activities.map((item) => <option key={item}>{item}</option>)}</select>
      <div className="field"><label htmlFor="venue">Venue</label><select id="venue" value={venueId} onChange={(event) => setVenueId(event.target.value)}><option value="">Choose a venue</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name} — {venue.address}</option>)}</select></div>
      <div className="field"><label htmlFor="date-time">Date and time</label><input id="date-time" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></div>
      <button className="action" disabled={busy || !venueId || !scheduledAt} onClick={() => void act(async () => { await request(`/matches/${current.id}/plan`, "POST", { activity, venueId, scheduledAt: new Date(scheduledAt).toISOString() }); setSelected(null); })}>Propose this date</button>
    </div>}
  </section>;
}

"use client";

import { useAuth } from "@clerk/nextjs";
import { DateFeedback } from "./date-feedback";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  Compass,
  Flag,
  HeartHandshake,
  MapPin,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { endpoint, message } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  name: string;
  age: number;
  location: string;
  interests: string[];
  activities: string[];
};
type Plan = {
  activity: string | null;
  location: string;
  venueId: string | null;
  scheduledAt: string | null;
  status: string;
  proposalVersion: number;
  acceptedByMe: boolean;
} | null;
type Match = {
  id: string;
  status: string;
  person: { id: string; name: string; age: number };
  acceptedByMe: boolean;
  acceptedByThem: boolean;
  activities: string[];
  plan: Plan;
  feedbackSubmitted: boolean;
  bothWantAgain: boolean;
};
type Venue = { id: string; name: string; address: string };
const options = ["Coffee", "Bowling", "Arcade", "Museum", "Mall", "Walk"];

function PersonPhoto({ id, name }: { id: string; name: string }) {
  const { getToken } = useAuth();
  const [source, setSource] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    async function load() {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${endpoint}/api/dating/people/${id}/photo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok || controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (!controller.signal.aborted) setSource(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }
    void load().catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getToken, id]);

  return (
    <div className="size-20 sm:size-24 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted grid place-items-center">
      {source ? (
        <Image
          unoptimized
          className="size-full object-cover"
          src={source}
          alt={`${name}'s profile photo`}
          width={320}
          height={320}
        />
      ) : (
        <UserRound className="size-7 text-muted-foreground/60" aria-hidden="true" />
      )}
    </div>
  );
}

export function Dating({
  initialActivities,
  initialLocation,
}: {
  initialActivities: string[];
  initialLocation: string;
}) {
  const { getToken } = useAuth();
  const [activities, setActivities] = useState(initialActivities);
  const [location, setLocation] = useState(initialLocation);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tab, setTab] = useState("preferences");
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activity, setActivity] = useState("Coffee");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const request = useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      const token = await getToken();
      const response = await fetch(`${endpoint}/api/dating${path}`, {
        method,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed. Try again.");
      }
      return response.status === 204 ? null : response.json();
    },
    [getToken],
  );

  const refresh = useCallback(async () => {
    const data = await request("/matches");
    setMatches(data.matches);
    setRefreshFailed(false);
  }, [request]);

  useEffect(() => {
    void request("/matches")
      .then((data) => setMatches(data.matches))
      .catch((error) => setNotice({ text: message(error), tone: "error" }));
  }, [request]);

  async function act(
    operation: () => Promise<void>,
    successMessage?: string,
    updateMatches = true,
  ) {
    setBusy(true);
    setNotice(null);
    try {
      await operation();
      if (updateMatches) await refresh().catch(() => setRefreshFailed(true));
      if (successMessage) setNotice({ text: successMessage, tone: "success" });
    } catch (error) {
      setNotice({ text: message(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    setTab("discover");
    setSearchState("loading");
    try {
      setCandidates((await request("/candidates")).candidates);
      setSearchState("done");
    } catch (error) {
      setSearchState("error");
      throw error;
    }
  }

  function setArea() {
    if (!navigator.geolocation) {
      setNotice({ text: "Location is unavailable in this browser.", tone: "error" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void act(
          async () => {
            await request("/area", "PUT", {
              location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setSearchState("idle");
            setCandidates([]);
          },
          "Your area has been updated. Choose Find matches to search.",
          false,
        );
      },
      () =>
        setNotice({
          text: "Allow location access to find compatible people nearby.",
          tone: "error",
        }),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function loadVenues(match: Match) {
    setSelected(match.id);
    setVenues([]);
    setVenueId("");
    const nextActivity = match.activities.includes(activity)
      ? activity
      : (match.activities[0] ?? "Coffee");
    setActivity(nextActivity);
    const data = await request(
      `/matches/${match.id}/venues?activity=${encodeURIComponent(nextActivity)}`,
    );
    setVenues(data.venues);
  }

  const current = matches.find((match) => match.id === selected);

  return (
    <section className="dating-dashboard mt-6 space-y-6">
      {notice && (
        <Alert variant={notice.tone === "success" ? "success" : "destructive"}>
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {refreshFailed && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void act(refresh, undefined, false)}
        >
          Reload matches
        </Button>
      )}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="preferences">
            <Compass className="size-4" />
            <span>Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="discover">
            <Sparkles className="size-4" />
            <span>Discover</span>
            {candidates.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[11px]">
                {candidates.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="matches">
            <HeartHandshake className="size-4" />
            <span>Matches</span>
            {matches.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[11px]">
                {matches.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-6 pt-2">
          <div className="rounded-2xl border border-border bg-background/50 p-5 sm:p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-medium text-foreground">
                Meet someone nearby
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose up to 5 date activities you’d enjoy together, then set your city and area.
              </p>
            </div>

            <div className="space-y-3">
              <Label>Date activities</Label>
              <div className="flex flex-wrap gap-2">
                {options.map((item) => {
                  const active = activities.includes(item);
                  return (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={active}
                      disabled={busy}
                      onClick={() =>
                        setActivities((previous) =>
                          previous.includes(item)
                            ? previous.filter((value) => value !== item)
                            : previous.length < 5
                              ? [...previous, item]
                              : previous,
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50",
                        active
                          ? "border-primary bg-secondary text-primary font-semibold shadow-xs"
                          : "border-input bg-card text-foreground hover:bg-secondary/60",
                      )}
                    >
                      {active && <Check className="size-3.5 shrink-0" />}
                      <span>{item}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={busy || !activities.length}
                  onClick={() =>
                    void act(
                      async () => {
                        const token = await getToken();
                        const response = await fetch(`${endpoint}/api/onboarding/date-activities`, {
                          method: "PUT",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({ activities }),
                        });
                        if (!response.ok) throw new Error("Couldn’t save date activities.");
                        setCandidates([]);
                        setSearchState("idle");
                      },
                      "Date activities saved.",
                      false,
                    )
                  }
                >
                  Save activities
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/70">
              <div className="grid gap-1.5">
                <Label htmlFor="area">City</Label>
                <Input
                  id="area"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Your city"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2.5">
                <Button
                  variant="outline"
                  disabled={busy || location.trim().length < 2}
                  onClick={setArea}
                >
                  <MapPin className="size-4" />
                  <span>Use my approximate area</span>
                </Button>
                <Button
                  disabled={busy || !location || !activities.length}
                  onClick={() => void act(search, undefined, false)}
                >
                  <Search className="size-4" />
                  <span>Find matches</span>
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="discover" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-2xl font-medium text-foreground">Compatible people</h2>
              <p className="text-sm text-muted-foreground">
                Invite someone to match if you’d like to plan a date together.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !location || !activities.length}
              onClick={() => void act(search, undefined, false)}
            >
              <Search className="size-4" />
              <span>Refresh</span>
            </Button>
          </div>

          {searchState !== "done" || candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/40 p-8 text-center space-y-2">
              <p className="font-serif text-xl text-foreground">
                {searchState === "loading"
                  ? "Searching nearby..."
                  : searchState === "error"
                    ? "Search interrupted"
                    : searchState === "done"
                      ? "No more people to show"
                      : "Ready to discover?"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchState === "done"
                  ? "Check back as more people join your area."
                  : searchState === "error"
                    ? "Choose Refresh to try again."
                    : searchState === "idle"
                      ? "Set your activities and area, then choose Find matches."
                      : "Checking your mutual preferences."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((person) => (
                <article
                  key={person.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-background/60 p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <PersonPhoto id={person.id} name={person.name} />
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-serif text-xl font-medium text-foreground truncate">
                        {person.name}, {person.age}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{person.location}</span>
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        <span className="font-semibold text-foreground/80">Interests:</span>{" "}
                        {person.interests.join(", ") || "none yet"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground/80">Dates:</span>{" "}
                        {person.activities.join(", ") || "choose together"}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await request("/matches", "POST", { userId: person.id });
                        setCandidates((previous) =>
                          previous.filter((item) => item.id !== person.id),
                        );
                      }, `Invitation sent to ${person.name}.`)
                    }
                  >
                    Invite to match
                  </Button>
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="matches" className="space-y-4 pt-2">
          <div>
            <h2 className="font-serif text-2xl font-medium text-foreground">Your matches</h2>
            <p className="text-sm text-muted-foreground">
              Manage invitations, propose a venue, and share private feedback after your date.
            </p>
          </div>

          {matches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/40 p-8 text-center space-y-2">
              <p className="font-serif text-xl text-foreground">No matches yet</p>
              <p className="text-sm text-muted-foreground">
                Invitations and active matches will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {matches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-2xl border border-border bg-background/60 p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <PersonPhoto id={match.person.id} name={match.person.name} />
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-xl font-medium text-foreground">
                            {match.person.name}, {match.person.age}
                          </h3>
                          <Badge
                            variant={
                              match.status === "ACTIVE"
                                ? "success"
                                : match.status === "PENDING"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {match.status === "PENDING"
                              ? match.acceptedByMe
                                ? "Waiting for their answer"
                                : "Invited you to match"
                              : match.status === "ACTIVE"
                                ? "Matched"
                                : match.status}
                          </Badge>
                        </div>
                        {match.status === "ACTIVE" && (
                          <p className="text-xs text-muted-foreground">
                            Shared activities: {match.activities.join(", ") || "none selected"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {match.status === "PENDING" && !match.acceptedByMe && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              await request(`/matches/${match.id}/accept`, "POST");
                            })
                          }
                        >
                          Accept match
                        </Button>
                      )}
                      {match.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              await request(`/matches/${match.id}/decline`, "POST");
                            })
                          }
                        >
                          Decline
                        </Button>
                      )}
                      {match.status === "ACTIVE" &&
                        (match.plan?.status !== "CONFIRMED" || match.bothWantAgain) && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || !match.activities.length}
                            onClick={() => void act(() => loadVenues(match), undefined, false)}
                          >
                            <Calendar className="size-4" />
                            <span>
                              {match.plan?.status === "PROPOSED"
                                ? "Suggest another plan"
                                : "Propose a date"}
                            </span>
                          </Button>
                        )}
                    </div>
                  </div>

                  {match.plan && (
                    <div className="rounded-xl border border-border/80 bg-card p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5 text-sm">
                        <p className="font-medium text-foreground">
                          {match.plan.activity} at {match.plan.location}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.plan.scheduledAt
                            ? new Date(match.plan.scheduledAt).toLocaleString()
                            : "Time pending"}{" "}
                          ·{" "}
                          {match.plan.status === "PROPOSED"
                            ? match.plan.acceptedByMe
                              ? "Waiting for their answer"
                              : "Review your invitation"
                            : match.plan.status === "CONFIRMED"
                              ? "Date confirmed"
                              : "Plan cancelled"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {match.plan.status === "CONFIRMED" && (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.plan.location)}&query_place_id=${encodeURIComponent(match.plan.venueId ?? "")}`}
                            >
                              <MapPin className="size-3.5" />
                              <span>Directions</span>
                            </a>
                          </Button>
                        )}
                        {match.plan.status === "PROPOSED" && !match.plan.acceptedByMe && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void act(async () => {
                                await request(`/matches/${match.id}/plan/accept`, "POST", {
                                  version: match.plan?.proposalVersion,
                                });
                              })
                            }
                          >
                            Accept this plan
                          </Button>
                        )}
                        {match.plan.status !== "CANCELLED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void act(async () => {
                                await request(`/matches/${match.id}/plan/cancel`, "POST");
                              })
                            }
                          >
                            Cancel plan
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {match.bothWantAgain && (
                    <Alert variant="success">
                      <Sparkles className="size-4 shrink-0 mt-0.5" />
                      <AlertDescription>
                        You are both interested in meeting again. You can propose another date.
                      </AlertDescription>
                    </Alert>
                  )}

                  {match.plan?.status === "CONFIRMED" &&
                    match.plan.scheduledAt &&
                    new Date(match.plan.scheduledAt) <= new Date() &&
                    !match.feedbackSubmitted && (
                      <DateFeedback
                        key={match.plan.proposalVersion}
                        busy={busy}
                        onSubmit={(answers) =>
                          void act(async () => {
                            await request(`/matches/${match.id}/feedback`, "POST", {
                              ...answers,
                              formVersion: 2,
                              version: match.plan?.proposalVersion,
                            });
                          }, "Your feedback was saved privately.")
                        }
                      />
                    )}

                  {match.feedbackSubmitted && (
                    <p className="text-xs text-muted-foreground">
                      Your feedback was saved privately.
                    </p>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/60">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setBlockTarget({ id: match.person.id, name: match.person.name })
                      }
                    >
                      <Ban className="size-3.5" />
                      <span>Block</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setReportReason("");
                        setReportTarget({ id: match.person.id, name: match.person.name });
                      }}
                    >
                      <Flag className="size-3.5" />
                      <span>Report</span>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan a date Dialog */}
      <Dialog open={Boolean(current)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose a place</DialogTitle>
            <DialogDescription>
              Propose an activity, local venue, and time to meet {current?.person.name}.
            </DialogDescription>
          </DialogHeader>
          {current && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="plan-activity">Activity</Label>
                <Select
                  value={activity}
                  onValueChange={(value) => {
                    setActivity(value);
                    void act(async () => {
                      const data = await request(
                        `/matches/${current.id}/venues?activity=${encodeURIComponent(value)}`,
                      );
                      setVenues(data.venues);
                      setVenueId("");
                    });
                  }}
                >
                  <SelectTrigger id="plan-activity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {current.activities.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="venue">Venue</Label>
                <Select value={venueId} onValueChange={setVenueId}>
                  <SelectTrigger id="venue">
                    <SelectValue placeholder="Choose a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name} — {venue.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="date-time">Date and time</Label>
                <Input
                  id="date-time"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !venueId || !scheduledAt || !current}
              onClick={() => {
                if (!current) return;
                void act(async () => {
                  await request(`/matches/${current.id}/plan`, "POST", {
                    activity,
                    venueId,
                    scheduledAt: new Date(scheduledAt).toISOString(),
                  });
                  setSelected(null);
                }, "Date proposal sent.");
              }}
            >
              Propose this date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block confirmation */}
      <AlertDialog
        open={Boolean(blockTarget)}
        onOpenChange={(open) => !open && setBlockTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {blockTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to see your profile, match with you, or send date plans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!blockTarget) return;
                const targetId = blockTarget.id;
                setBlockTarget(null);
                void act(async () => {
                  await request("/blocks", "POST", { userId: targetId });
                }, "User blocked.");
              }}
            >
              Block user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <Dialog open={Boolean(reportTarget)} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {reportTarget?.name}</DialogTitle>
            <DialogDescription>
              Tell our moderation team what happened. Reports are reviewed privately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Textarea
              id="report-reason"
              rows={3}
              placeholder="Describe what happened..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !reportReason.trim()}
              onClick={() => {
                if (!reportTarget || !reportReason.trim()) return;
                const targetId = reportTarget.id;
                const reason = reportReason.trim();
                setReportTarget(null);
                void act(async () => {
                  await request("/reports", "POST", { userId: targetId, reason });
                }, "Report submitted.");
              }}
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

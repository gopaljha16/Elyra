import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DateFeedback({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (answers: Record<string, boolean | number>) => void;
}) {
  const [attendance, setAttendance] = useState("");
  return (
    <form
      className="rounded-xl border border-border bg-card p-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (attendance === "no") return onSubmit({ attended: false });
        onSubmit({
          attended: true,
          rating: Number(data.get("rating")),
          comfort: Number(data.get("comfort")),
          enjoyment: Number(data.get("enjoyment")),
          wouldMeetAgain: data.get("again") === "yes",
        });
      }}
    >
      <h4 className="font-serif text-lg">How was your date?</h4>
      <label className="grid gap-1">
        Did you meet in person?
        <select required value={attendance} onChange={(e) => setAttendance(e.target.value)}>
          <option value="">Choose an answer</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      {attendance === "yes" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["rating", "comfort", "enjoyment", "again"] as const).map((key) => (
            <label className="grid gap-1" key={key}>
              {
                {
                  rating: "Overall rating",
                  comfort: "Comfort",
                  enjoyment: "Enjoyment",
                  again: "Would you meet again?",
                }[key]
              }
              <select name={key} required defaultValue="">
                <option value="">Choose an answer</option>
                {key === "again" ? (
                  <>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </>
                ) : (
                  [1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)
                )}
              </select>
            </label>
          ))}
        </div>
      )}
      <Button disabled={busy || !attendance}>Save private feedback</Button>
    </form>
  );
}

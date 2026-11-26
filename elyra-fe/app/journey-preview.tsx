"use client";

import { useId, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "./landing.module.css";

const activities = [
  {
    label: "Coffee",
    shared: "coffee",
    title: "Coffee on Saturday.",
    venue: "A neighborhood café",
    time: "Saturday, 11:00 AM",
  },
  {
    label: "Museum",
    shared: "a museum visit",
    title: "A museum date.",
    venue: "A local art museum",
    time: "Sunday, 2:00 PM",
  },
  {
    label: "Walk",
    shared: "a walk",
    title: "A walk in the park.",
    venue: "The park entrance",
    time: "Saturday, 4:00 PM",
  },
] as const;

const steps = [
  { value: "discover", label: "Discover" },
  { value: "match", label: "Match" },
  { value: "plan", label: "Plan a date" },
] as const;

export function JourneyPreview() {
  const activityGroup = useId();
  const [activity, setActivity] = useState<(typeof activities)[number]>(activities[0]);
  const [step, setStep] = useState("discover");
  const matchTab = useRef<HTMLButtonElement>(null);
  const planTab = useRef<HTMLButtonElement>(null);

  function advance(value: "match" | "plan") {
    setStep(value);
    (value === "match" ? matchTab : planTab).current?.focus();
  }

  return (
    <section id="preview" className={styles.preview} aria-labelledby="preview-title">
      <div className={styles.previewIntro}>
        <p className={styles.eyebrow}>INTERACTIVE PREVIEW</p>
        <h2 id="preview-title">
          Try the Elyra <em>experience.</em>
        </h2>
        <p>Choose an activity and follow an example match from invitation to first date.</p>
        <fieldset className={styles.activityPicker}>
          <legend>What sounds like a good first date?</legend>
          <div className={styles.activityOptions}>
            {activities.map((option) => (
              <label className={styles.activityOption} key={option.label}>
                <input
                  type="radio"
                  name={activityGroup}
                  value={option.label}
                  checked={option.label === activity.label}
                  onChange={() => setActivity(option)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <Tabs value={step} onValueChange={setStep} className={styles.demoTabs}>
        <TabsList className={styles.demoTabList} aria-label="Explore the dating journey">
          {steps.map(({ value, label }) => (
            <TabsTrigger
              className={styles.demoTab}
              key={value}
              value={value}
              ref={value === "match" ? matchTab : value === "plan" ? planTab : undefined}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="discover" className={styles.demoPanel}>
          <div key={activity.label} className={styles.demoCopy}>
            <h3>You both picked {activity.shared}.</h3>
            <p>Maya shows up in Discover because you’re nearby and share a date interest.</p>
          </div>
          <button type="button" onClick={() => advance("match")} className={styles.demoButton}>
            Send sample invitation
          </button>
        </TabsContent>
        <TabsContent value="match" className={styles.demoPanel}>
          <div key={activity.label} className={styles.demoCopy}>
            <h3>It’s a match.</h3>
            <p>Maya accepted the sample invitation. Now you can suggest {activity.shared}.</p>
          </div>
          <button type="button" onClick={() => advance("plan")} className={styles.demoButton}>
            See the date plan
          </button>
        </TabsContent>
        <TabsContent value="plan" className={styles.demoPanel}>
          <div key={activity.label} className={styles.demoCopy}>
            <h3>{activity.title}</h3>
            <p>
              {activity.venue} · {activity.time}
            </p>
          </div>
          <p className={styles.demoStatus}>Date confirmed</p>
        </TabsContent>
      </Tabs>
    </section>
  );
}

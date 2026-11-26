"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  answers,
  genders,
  interestGroups,
  matchGenders,
  questions,
  relationships,
} from "../../../../elyra-be/src/onboarding/options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export type Form = Omit<Profile, "age" | "preferences"> & {
  age: string;
  preferences: Omit<Profile["preferences"], "minAge" | "maxAge" | "maxDistance"> & {
    minAge: string;
    maxAge: string;
    maxDistance: string;
  };
};
export const blankForm: Form = {
  name: "",
  age: "",
  gender: "",
  location: "",
  bio: "",
  interests: [],
  personalityAnswers: { weekend: "", connection: "", spontaneity: "" },
  preferences: { minAge: "", maxAge: "", gender: "", maxDistance: "", relationship: "" },
};

export function formFromProfile(profile: Profile): Form {
  return {
    ...profile,
    age: String(profile.age),
    preferences: {
      ...profile.preferences,
      minAge: String(profile.preferences.minAge),
      maxAge: String(profile.preferences.maxAge),
      maxDistance: String(profile.preferences.maxDistance),
    },
  };
}

function integer(value: string, min: number, max: number) {
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
}

const headings = ["Basic info", "Your interests", "Your personality", "Matching preferences"];
const descriptions = [
  "Start with the details that introduce you.",
  "Pick 3 to 10 things you enjoy.",
  "Choose the answers that feel most like you.",
  "Tell us who you’d like to meet.",
];

export function ProfileForm({
  step,
  form,
  update,
  onNext,
  onBack,
  busy,
}: {
  step: number;
  form: Form;
  update: (form: Form) => void;
  onNext: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [touched, setTouched] = useState<string[]>([]);
  const pref = form.preferences;
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (form.name.trim().length < 2 || form.name.trim().length > 50)
      errors.name = "Enter a name between 2 and 50 characters.";
    if (!integer(form.age, 18, 100)) errors.age = "Enter an age between 18 and 100.";
    if (!form.gender) errors.gender = "Select your gender.";
    if (!form.location.trim() || form.location.trim().length > 120)
      errors.location = "Enter a location of up to 120 characters.";
    if ((form.bio?.length ?? 0) > 500) errors.bio = "Keep your bio to 500 characters.";
  }
  if (step === 1 && (form.interests.length < 3 || form.interests.length > 10))
    errors.interests = "Choose 3 to 10 interests.";
  if (step === 2 && Object.values(form.personalityAnswers).some((answer) => !answer))
    errors.personality = "Answer every question.";
  if (step === 3) {
    if (!integer(pref.minAge, 18, 100)) errors.minAge = "Enter a minimum age from 18 to 100.";
    if (!integer(pref.maxAge, 18, 100)) errors.maxAge = "Enter a maximum age from 18 to 100.";
    if (!errors.minAge && !errors.maxAge && Number(pref.minAge) > Number(pref.maxAge))
      errors.maxAge = "Maximum age must be at least the minimum.";
    if (!pref.gender) errors.matchGender = "Select who you’d like to meet.";
    if (!integer(pref.maxDistance, 1, 20000))
      errors.maxDistance = "Enter a distance from 1 to 20,000 km.";
    if (!pref.relationship) errors.relationship = "Select a relationship type.";
  }

  function markTouched(name: string) {
    setTouched((previous) => (previous.includes(name) ? previous : [...previous, name]));
  }

  function field(name: string, label: string, input: ReactNode) {
    const error = touched.includes(name) ? errors[name] : undefined;
    return (
      <div className="grid gap-1.5 min-w-0">
        <Label htmlFor={name}>{label}</Label>
        {input}
        {error && (
          <span id={`${name}-error`} className="text-xs font-medium text-destructive">
            {error}
          </span>
        )}
      </div>
    );
  }

  function attributes(name: string) {
    const invalid = touched.includes(name) && Boolean(errors[name]);
    return {
      id: name,
      name,
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${name}-error` : undefined,
      onBlur: () => markTouched(name),
    };
  }

  function preferences(key: keyof Form["preferences"], value: string) {
    update({ ...form, preferences: { ...pref, [key]: value } });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Profile · Step {step + 1} of 4
        </p>
        <h1 className="font-serif text-3xl sm:text-5xl font-medium leading-[1.06] tracking-tight text-foreground">
          {headings[step]}
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">{descriptions[step]}</p>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !Object.keys(errors).length) onNext();
        }}
      >
        <fieldset className="grid gap-4 min-w-0" disabled={busy} aria-label={headings[step]}>
          {step === 0 && (
            <>
              {field(
                "name",
                "Name",
                <Input
                  {...attributes("name")}
                  autoComplete="given-name"
                  maxLength={50}
                  placeholder="Your first name"
                  value={form.name}
                  onChange={(e) => update({ ...form, name: e.target.value })}
                  required
                />,
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(
                  "age",
                  "Age",
                  <Input
                    {...attributes("age")}
                    type="number"
                    min={18}
                    max={100}
                    placeholder="25"
                    value={form.age}
                    onChange={(e) => update({ ...form, age: e.target.value })}
                    required
                  />,
                )}
                {field(
                  "gender",
                  "Gender",
                  <Select
                    value={form.gender}
                    onValueChange={(value) => {
                      markTouched("gender");
                      update({ ...form, gender: value });
                    }}
                  >
                    <SelectTrigger
                      id="gender"
                      aria-invalid={touched.includes("gender") && Boolean(errors.gender)}
                    >
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                )}
              </div>
              {field(
                "location",
                "Location",
                <Input
                  {...attributes("location")}
                  placeholder="City or neighborhood"
                  maxLength={120}
                  value={form.location}
                  onChange={(e) => update({ ...form, location: e.target.value })}
                  required
                />,
              )}
              <div className="space-y-1.5">
                {field(
                  "bio",
                  "Bio (optional)",
                  <Textarea
                    {...attributes("bio")}
                    maxLength={500}
                    rows={3}
                    placeholder="A quick note on what you're into or what a great weekend looks like..."
                    value={form.bio ?? ""}
                    onChange={(e) => update({ ...form, bio: e.target.value })}
                  />,
                )}
                <p className="text-xs text-muted-foreground text-right">
                  {form.bio?.length ?? 0} / 500
                </p>
              </div>
            </>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {Object.entries(interestGroups).map(([category, options]) => (
                <fieldset className="space-y-2.5" key={category}>
                  <legend className="text-sm font-semibold text-foreground">{category}</legend>
                  <div className="flex flex-wrap gap-2">
                    {options.map((interest) => {
                      const selected = form.interests.includes(interest);
                      return (
                        <button
                          type="button"
                          key={interest}
                          aria-pressed={selected}
                          disabled={!selected && form.interests.length >= 10}
                          onClick={() =>
                            update({
                              ...form,
                              interests: selected
                                ? form.interests.filter((value) => value !== interest)
                                : [...form.interests, interest],
                            })
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all cursor-pointer active:scale-[0.97] disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                            selected
                              ? "border-primary bg-secondary text-primary font-semibold shadow-xs"
                              : "border-input bg-card/60 text-foreground hover:bg-secondary/60 hover:border-primary/40",
                          )}
                        >
                          {selected && <Check className="size-3.5 shrink-0" />}
                          <span>{interest}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
              <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
                {form.interests.length} selected
                {form.interests.length < 3 ? " · Choose at least 3" : " · Up to 10"}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {(Object.keys(questions) as (keyof typeof questions)[]).map((key) => (
                <fieldset className="space-y-2.5" key={key}>
                  <legend className="text-sm font-semibold text-foreground">
                    {questions[key]}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {answers[key].map((answer) => {
                      const checked = form.personalityAnswers[key] === answer;
                      return (
                        <label
                          key={answer}
                          className={cn(
                            "relative inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all cursor-pointer active:scale-[0.97] focus-within:ring-3 focus-within:ring-ring/40",
                            checked
                              ? "border-primary bg-secondary text-primary font-semibold shadow-xs"
                              : "border-input bg-card/60 text-foreground hover:bg-secondary/60 hover:border-primary/40",
                          )}
                        >
                          <input
                            type="radio"
                            name={key}
                            value={answer}
                            checked={checked}
                            className="sr-only"
                            onChange={() =>
                              update({
                                ...form,
                                personalityAnswers: { ...form.personalityAnswers, [key]: answer },
                              })
                            }
                          />
                          {checked && <Check className="size-3.5 shrink-0" />}
                          <span>{answer}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field(
                  "minAge",
                  "Minimum age",
                  <Input
                    {...attributes("minAge")}
                    type="number"
                    min={18}
                    max={100}
                    placeholder="21"
                    value={pref.minAge}
                    onChange={(e) => preferences("minAge", e.target.value)}
                    required
                  />,
                )}
                {field(
                  "maxAge",
                  "Maximum age",
                  <Input
                    {...attributes("maxAge")}
                    type="number"
                    min={18}
                    max={100}
                    placeholder="35"
                    value={pref.maxAge}
                    onChange={(e) => preferences("maxAge", e.target.value)}
                    required
                  />,
                )}
              </div>
              {field(
                "matchGender",
                "Who you’d like to meet",
                <Select
                  value={pref.gender}
                  onValueChange={(value) => {
                    markTouched("matchGender");
                    preferences("gender", value);
                  }}
                >
                  <SelectTrigger
                    id="matchGender"
                    aria-invalid={touched.includes("matchGender") && Boolean(errors.matchGender)}
                  >
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {matchGenders.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "maxDistance",
                "Maximum distance (km)",
                <Input
                  {...attributes("maxDistance")}
                  type="number"
                  min={1}
                  max={20000}
                  placeholder="25"
                  value={pref.maxDistance}
                  onChange={(e) => preferences("maxDistance", e.target.value)}
                  required
                />,
              )}
              {field(
                "relationship",
                "Looking for",
                <Select
                  value={pref.relationship}
                  onValueChange={(value) => {
                    markTouched("relationship");
                    preferences("relationship", value);
                  }}
                >
                  <SelectTrigger
                    id="relationship"
                    aria-invalid={touched.includes("relationship") && Boolean(errors.relationship)}
                  >
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
            </>
          )}
        </fieldset>

        <div className="mt-7 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
            <ArrowLeft className="size-4" />
            <span>Back</span>
          </Button>
          <Button type="submit" disabled={busy || Boolean(Object.keys(errors).length)}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { answers, genders, interestGroups, matchGenders, questions, relationships } from "../../../../elyra-be/src/onboarding/options";
import type { Profile } from "@/lib/onboarding";

export type Form = Omit<Profile, "age" | "preferences"> & {
  age: string;
  preferences: Omit<Profile["preferences"], "minAge" | "maxAge" | "maxDistance"> & {
    minAge: string; maxAge: string; maxDistance: string;
  };
};
export const blankForm: Form = {
  name: "", age: "", gender: "", location: "", bio: "", interests: [],
  personalityAnswers: { weekend: "", connection: "", spontaneity: "" },
  preferences: { minAge: "", maxAge: "", gender: "", maxDistance: "", relationship: "" },
};

export function formFromProfile(profile: Profile): Form {
  return {
    ...profile, age: String(profile.age),
    preferences: { ...profile.preferences, minAge: String(profile.preferences.minAge),
      maxAge: String(profile.preferences.maxAge), maxDistance: String(profile.preferences.maxDistance) },
  };
}

function integer(value: string, min: number, max: number) {
  return /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
}

const headings = ["Basic info", "Your interests", "Your personality", "Matching preferences"];
const descriptions = ["Start with the details that introduce you.", "Pick 3 to 10 things you enjoy.", "Choose the answers that feel most like you.", "Tell us who you’d like to meet."];

export function ProfileForm({ step, form, update, onNext, onBack, busy }: {
  step: number; form: Form; update: (form: Form) => void; onNext: () => void; onBack: () => void; busy: boolean;
}) {
  const [touched, setTouched] = useState<string[]>([]);
  const pref = form.preferences;
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (form.name.trim().length < 2 || form.name.trim().length > 50) errors.name = "Enter a name between 2 and 50 characters.";
    if (!integer(form.age, 18, 100)) errors.age = "Enter an age between 18 and 100.";
    if (!form.gender) errors.gender = "Select your gender.";
    if (!form.location.trim() || form.location.trim().length > 120) errors.location = "Enter a location of up to 120 characters.";
    if ((form.bio?.length ?? 0) > 500) errors.bio = "Keep your bio to 500 characters.";
  }
  if (step === 1 && (form.interests.length < 3 || form.interests.length > 10)) errors.interests = "Choose 3 to 10 interests.";
  if (step === 2 && Object.values(form.personalityAnswers).some((answer) => !answer)) errors.personality = "Answer every question.";
  if (step === 3) {
    if (!integer(pref.minAge, 18, 100)) errors.minAge = "Enter a minimum age from 18 to 100.";
    if (!integer(pref.maxAge, 18, 100)) errors.maxAge = "Enter a maximum age from 18 to 100.";
    if (!errors.minAge && !errors.maxAge && Number(pref.minAge) > Number(pref.maxAge)) errors.maxAge = "Maximum age must be at least the minimum.";
    if (!pref.gender) errors.matchGender = "Select who you’d like to meet.";
    if (!integer(pref.maxDistance, 1, 20000)) errors.maxDistance = "Enter a distance from 1 to 20,000 km.";
    if (!pref.relationship) errors.relationship = "Select a relationship type.";
  }

  function field(name: string, label: string, input: ReactNode) {
    const error = touched.includes(name) ? errors[name] : undefined;
    return <div className="field">
      <label htmlFor={name}>{label}</label>{input}
      {error && <span id={`${name}-error`} className="field-error">{error}</span>}
    </div>;
  }

  function attributes(name: string) {
    const invalid = touched.includes(name) && Boolean(errors[name]);
    return {
      id: name, name, "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${name}-error` : undefined,
      onBlur: () => setTouched((previous) => previous.includes(name) ? previous : [...previous, name]),
    };
  }

  function preferences(key: keyof Form["preferences"], value: string) {
    update({ ...form, preferences: { ...pref, [key]: value } });
  }

  function selectOptions(options: readonly string[]) {
    return <><option value="">Select an option</option>{options.map((option) => <option key={option}>{option}</option>)}</>;
  }

  return <>
    <p className="step-label">Profile · Step {step + 1} of 4</p>
    <h1>{headings[step]}</h1><p>{descriptions[step]}</p>
    <form noValidate onSubmit={(event) => { event.preventDefault(); if (!busy && !Object.keys(errors).length) onNext(); }}>
      <fieldset className="form-fields" disabled={busy} aria-label={headings[step]}>
        {step === 0 && <>
          {field("name", "Name", <input {...attributes("name")} autoComplete="given-name" maxLength={50} value={form.name} onChange={(e) => update({ ...form, name: e.target.value })} required />)}
          <div className="field-row">
            {field("age", "Age", <input {...attributes("age")} type="number" min={18} max={100} value={form.age} onChange={(e) => update({ ...form, age: e.target.value })} required />)}
            {field("gender", "Gender", <select {...attributes("gender")} value={form.gender} onChange={(e) => update({ ...form, gender: e.target.value })} required>{selectOptions(genders)}</select>)}
          </div>
          {field("location", "Location", <input {...attributes("location")} placeholder="City or town" maxLength={120} value={form.location} onChange={(e) => update({ ...form, location: e.target.value })} required />)}
          {field("bio", "Bio (optional)", <textarea {...attributes("bio")} maxLength={500} rows={3} value={form.bio ?? ""} onChange={(e) => update({ ...form, bio: e.target.value })} />)}
          <small>{form.bio?.length ?? 0} / 500</small>
        </>}
        {step === 1 && <>
          {Object.entries(interestGroups).map(([category, options]) => <fieldset className="interest-group" key={category}>
            <legend>{category}</legend>
            <div className="chips">{options.map((interest) => {
              const selected = form.interests.includes(interest);
              return <button type="button" key={interest} className="chip" aria-pressed={selected} disabled={!selected && form.interests.length >= 10}
                onClick={() => update({ ...form, interests: selected ? form.interests.filter((value) => value !== interest) : [...form.interests, interest] })}>{interest}</button>;
            })}</div>
          </fieldset>)}
          <small aria-live="polite">{form.interests.length} selected{form.interests.length < 3 ? " · Choose at least 3" : " · Up to 10"}</small>
        </>}
        {step === 2 && (Object.keys(questions) as (keyof typeof questions)[]).map((key) => (
          <fieldset className="interest-group" key={key}><legend>{questions[key]}</legend>
            <div className="chips">{answers[key].map((answer) => (
              <label className="radio-chip" key={answer}>
                <input type="radio" name={key} value={answer} checked={form.personalityAnswers[key] === answer}
                  onChange={() => update({ ...form, personalityAnswers: { ...form.personalityAnswers, [key]: answer } })} />
                <span>{answer}</span>
              </label>
            ))}</div>
          </fieldset>
        ))}
        {step === 3 && <>
          <div className="field-row">
            {field("minAge", "Minimum age", <input {...attributes("minAge")} type="number" min={18} max={100} value={pref.minAge} onChange={(e) => preferences("minAge", e.target.value)} required />)}
            {field("maxAge", "Maximum age", <input {...attributes("maxAge")} type="number" min={18} max={100} value={pref.maxAge} onChange={(e) => preferences("maxAge", e.target.value)} required />)}
          </div>
          {field("matchGender", "Who you’d like to meet", <select {...attributes("matchGender")} value={pref.gender} onChange={(e) => preferences("gender", e.target.value)} required>{selectOptions(matchGenders)}</select>)}
          {field("maxDistance", "Maximum distance (km)", <input {...attributes("maxDistance")} type="number" min={1} max={20000} value={pref.maxDistance} onChange={(e) => preferences("maxDistance", e.target.value)} required />)}
          {field("relationship", "Looking for", <select {...attributes("relationship")} value={pref.relationship} onChange={(e) => preferences("relationship", e.target.value)} required>{selectOptions(relationships)}</select>)}
        </>}
      </fieldset>
      <div className="actions"><button type="button" className="quiet" disabled={busy} onClick={onBack}>Back</button>
        <button type="submit" className="action" disabled={busy || Boolean(Object.keys(errors).length)}>{busy ? "Saving…" : "Continue"}</button>
      </div>
    </form>
  </>;
}

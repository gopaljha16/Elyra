import { auth } from "@clerk/nextjs/server";
import { BadgeCheck, CalendarHeart, Check, ChevronDown, Coffee, ScanFace } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ElyraWordmark } from "@/components/elyra-wordmark";
import { JourneyPreview } from "./journey-preview";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Elyra | Dating made for real life",
  description:
    "Meet verified people who share your interests, match by mutual invitation, and make a plan to meet with Elyra.",
};

const sections = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#safety", label: "Safety" },
  { href: "#faq", label: "FAQs" },
];

const questions = [
  {
    question: "Who can join Elyra?",
    answer:
      "Elyra is for adults aged 18 and over. To get started, create an account, fill out your profile, add photos, and complete the live camera check.",
  },
  {
    question: "How does verification work?",
    answer:
      "During setup, Elyra checks your selfie against your main profile photo. A separate live camera check in your dashboard unlocks matching.",
  },
  {
    question: "How do matches and date plans work?",
    answer:
      "Choose your area and the activities you’d enjoy on a date. When you’re interested in someone, send a match invitation. Once they accept, you can suggest a venue and time for an activity you both picked. The plan is confirmed when you both agree.",
  },
  {
    question: "Can I block or report someone?",
    answer:
      "Yes. Use the block or report options in your matches. Blocking prevents further matching with that person. Reporting sends your concern to Elyra for review.",
  },
  {
    question: "What happens after a date?",
    answer:
      "You can leave private feedback and say whether you’d like to meet again. When both of you want another date, you can make a new plan together.",
  },
];

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/onboarding");

  return (
    <div className={styles.landing}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <ElyraWordmark />
          <nav className={styles.navigation} aria-label="Main navigation">
            {sections.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.signIn} href="/sign-in">
              Sign in
            </Link>
            <Link className={styles.headerButton} href="/sign-up">
              Join Elyra
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>DATING WITH INTENTION</p>
            <h1 id="hero-title">
              Dating made
              <br /> for <em>real life.</em>
            </h1>
            <p className={styles.heroDescription}>
              Meet verified people who share your interests. Match over something you’d both love to
              do, then make a plan to meet.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/sign-up">
                Create an account
              </Link>
              <a className={styles.textButton} href="#how-it-works">
                See how it works <ChevronDown size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <figure className={styles.heroVisual}>
            <div className={styles.heroImage}>
              <Image
                src="/landing/first-date.webp"
                alt="Two people laughing together over coffee on a date"
                fill
                preload
                sizes="(max-width: 760px) 95vw, (max-width: 1260px) 52vw, 620px"
              />
            </div>
            <figcaption className={styles.dateToast}>
              <span className={styles.toastIcon}>
                <CalendarHeart size={21} aria-hidden="true" />
              </span>
              <span>
                <strong>Coffee date confirmed</strong>
                <small>Saturday · 11:00 AM</small>
              </span>
              <Check className={styles.toastCheck} size={16} aria-hidden="true" />
            </figcaption>
          </figure>
        </section>

        <div className={styles.promise} aria-label="What to expect">
          <div className={styles.promiseInner}>
            <span>Live-verified profiles</span>
            <span>Shared date interests</span>
            <span>In-app date planning</span>
          </div>
        </div>

        <section id="how-it-works" className={styles.features} aria-labelledby="features-title">
          <header className={styles.sectionIntro}>
            <p className={styles.eyebrow}>HOW IT WORKS</p>
            <h2 id="features-title">
              From first hello
              <br className={styles.mobileBreak} /> <em>to first date.</em>
            </h2>
            <p>
              Show up as yourself, find someone you click with, and pick something to do together.
            </p>
          </header>
          <div className={styles.bento}>
            <article className={`${styles.tile} ${styles.profileTile}`}>
              <div className={styles.tileCopy}>
                <h3>Make it personal.</h3>
                <p>
                  Add a few photos, share what you’re into, and pick the things you’d love to do on
                  a date.
                </p>
              </div>
              <div className={styles.profileExample} aria-label="Example profile">
                <Image
                  src="/landing/example-profile.webp"
                  alt=""
                  fill
                  sizes="(max-width: 460px) 128px, 220px"
                />
                <div className={styles.profileCaption}>
                  <small>Example profile</small>
                  <strong>
                    Maya, 28 <BadgeCheck size={17} aria-label="Verified" />
                  </strong>
                </div>
              </div>
            </article>

            <article className={`${styles.tile} ${styles.verifyTile}`}>
              <div className={styles.tileCopy}>
                <h3>Show up as you.</h3>
                <p>Complete a live camera check before you start matching.</p>
              </div>
              <div className={styles.scanArt} aria-hidden="true">
                <div>
                  <ScanFace size={57} strokeWidth={1.1} />
                </div>
                <span>
                  <Check size={14} /> Verified
                </span>
              </div>
            </article>

            <article className={`${styles.tile} ${styles.matchTile}`}>
              <div className={styles.tileCopy}>
                <h3>Find common ground.</h3>
                <p>
                  Discover people nearby who share your date interests. A match starts when you both
                  say yes.
                </p>
              </div>
              <a className={styles.previewLink} href="#preview">
                Try a sample match <ChevronDown size={16} aria-hidden="true" />
              </a>
            </article>

            <article className={`${styles.tile} ${styles.planTile}`}>
              <div className={styles.tileCopy}>
                <h3>Make a plan.</h3>
                <p>
                  Pick a shared activity, suggest a spot and a time, and confirm the date together.
                </p>
              </div>
              <div className={styles.planExample} aria-label="Example date plan">
                <span className={styles.planCoffee}>
                  <Coffee size={23} aria-hidden="true" />
                </span>
                <div>
                  <strong>Coffee for two</strong>
                  <small>Saturday, 11:00 AM</small>
                </div>
                <span className={styles.planStatus}>
                  <Check size={14} aria-hidden="true" /> Confirmed
                </span>
              </div>
            </article>
          </div>
        </section>

        <JourneyPreview />

        <section id="safety" className={styles.safety} aria-labelledby="safety-title">
          <div className={styles.safetyIntro}>
            <p className={styles.eyebrow}>SAFETY ON ELYRA</p>
            <h2 id="safety-title">
              Date at <em>your pace.</em>
            </h2>
          </div>
          <div className={styles.safetyItems}>
            <div>
              <div>
                <h3>Live verification</h3>
                <p>
                  Members complete a camera check against their main profile photo before matching.
                </p>
              </div>
            </div>
            <div>
              <div>
                <h3>Block and report</h3>
                <p>Block a match or report a concern for review from inside Elyra.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className={styles.faq} aria-labelledby="faq-title">
          <header className={styles.faqIntro}>
            <p className={styles.eyebrow}>GOOD TO KNOW</p>
            <h2 id="faq-title">
              A few things
              <br /> <em>before you join.</em>
            </h2>
          </header>
          <div className={styles.questions}>
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={19} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="join-title">
          <h2 id="join-title">
            Who will you <em>meet?</em>
          </h2>
          <Link className={styles.primaryButton} href="/sign-up">
            Get started
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <ElyraWordmark />
          <nav aria-label="Footer navigation">
            {sections.map((section) => (
              <a key={section.href} href={section.href}>
                {section.label}
              </a>
            ))}
          </nav>
          <p>© {new Date().getFullYear()} Elyra · 18+</p>
        </div>
      </footer>
    </div>
  );
}

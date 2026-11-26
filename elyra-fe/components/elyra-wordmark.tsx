import { Heart } from "lucide-react";
import Link from "next/link";
import styles from "./elyra-wordmark.module.css";

export function ElyraWordmark() {
  return (
    <Link className={styles.wordmark} href="/" aria-label="Elyra home">
      <Heart className={styles.heart} size={23} fill="currentColor" aria-hidden="true" />
      elyra<span className={styles.period}>.</span>
    </Link>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { SHEET_COMPANY_INFO } from "@/lib/sheetTemplateConstants";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.grid} aria-hidden />
      <div className={`${styles.orb} ${styles.orbA}`} aria-hidden />
      <div className={`${styles.orb} ${styles.orbB}`} aria-hidden />

      <div className={styles.shell}>
        <header className={`${styles.header} ${styles.fadeIn}`}>
          <div className={styles.brandRow}>
            <Image
              src="/images/logo.png"
              alt="DMS Logo"
              width={56}
              height={36}
              priority
              className={styles.logo}
              style={{ height: "auto" }}
            />
            <div className={styles.brandMeta}>
              <p className={styles.brandCode}>{SHEET_COMPANY_INFO.logoText}</p>
              <p className={styles.brandTag}>{SHEET_COMPANY_INFO.tagline}</p>
            </div>
          </div>

          <p className={styles.accessLabel}>External access</p>
        </header>

        <section className={styles.hero}>
          <div>
            <p className={`${styles.eyebrow} ${styles.fadeIn} ${styles.delay1}`}>
              Document Management Services
            </p>

            <h1 className={`${styles.title} ${styles.fadeIn} ${styles.delay2}`}>
              DMS
            </h1>

            <p className={`${styles.headline} ${styles.fadeIn} ${styles.delay3}`}>
              Create an account and place orders or requests online.
            </p>

            <p className={`${styles.support} ${styles.fadeIn} ${styles.delay4}`}>
              Choose the portal that matches how you work with us — as a company
              or as an individual.
            </p>
          </div>

          <div className={`${styles.actions} ${styles.fadeIn} ${styles.delay5}`}>
            <Link
              href="/Subpoenaupload"
              className={`${styles.cta} ${styles.ctaPrimary}`}
            >
              <span className={styles.sheen} aria-hidden />
              <span>
                <span className={styles.ctaLabel}>Company portal</span>
                <span className={styles.ctaHint}>
                  For law firms and organizations
                </span>
              </span>
              <span className={styles.ctaArrow} aria-hidden>
                →
              </span>
            </Link>

            <Link
              href="/personal-request-portal"
              className={`${styles.cta} ${styles.ctaSecondary}`}
            >
              <span className={`${styles.sheen} ${styles.sheenLight}`} aria-hidden />
              <span>
                <span className={styles.ctaLabel}>Personal request portal</span>
                <span className={styles.ctaHint}>
                  For individual record requests
                </span>
              </span>
              <span className={styles.ctaArrow} aria-hidden>
                →
              </span>
            </Link>
          </div>
        </section>

        <footer className={`${styles.footer} ${styles.fadeIn} ${styles.delay6}`}>
          <p className={styles.footerName}>{SHEET_COMPANY_INFO.companyName}</p>
          <p className={styles.footerLine}>
            {SHEET_COMPANY_INFO.addressLine1} · {SHEET_COMPANY_INFO.cityStateZip}
          </p>
          <p className={styles.footerLine}>
            {SHEET_COMPANY_INFO.officePhone} · {SHEET_COMPANY_INFO.email}
          </p>
        </footer>
      </div>
    </main>
  );
}

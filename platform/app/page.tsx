import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import carte from "@/public/landing/carte-3d.png";
import zoom from "@/public/landing/carte-zoom.png";
import SiteChrome, { ctaClass } from "@/components/site/SiteChrome";
import { PLANS } from "@/features/billing/plans";
import { fr } from "@/lib/i18n/fr";
import { landingTexts, signupHref, staticSite } from "@/lib/site/mode";

export const metadata: Metadata = {
  title: `${fr.app.name} — ${fr.app.homeTitle}`,
  description: fr.app.description,
};

const t = fr.landing;
// Site vitrine statique : boutons vers un e-mail de contact au lieu de l'inscription
const signup = signupHref(t.static.mailSubject);
const texts = landingTexts();
const cta = texts.cta;
const ctaNote = texts.ctaNote;

export default function Home() {
  return (
    <SiteChrome>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-5">
          <span className="bg-brand-50 text-brand-800 w-fit rounded-full px-3 py-1 text-xs font-medium">
            {t.badge}
          </span>
          <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
            {fr.app.homeTitle}
          </h1>
          <p className="text-lg text-slate-700">{fr.app.description}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={signup} className={ctaClass}>
              {cta}
            </a>
            <Link
              href="/#tarifs"
              className="focus-visible:outline-brand-600 rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-50 focus-visible:outline-2"
            >
              {t.secondary}
            </Link>
          </div>
          <p className="text-sm text-slate-600">{ctaNote}</p>
        </div>
        <Image
          unoptimized={staticSite}
          src={carte}
          alt={t.screenshotAlt}
          priority
          className="rounded-2xl border border-slate-200 shadow-2xl"
          sizes="(min-width: 1024px) 640px, 100vw"
        />
      </section>

      <section id="fonctionnalites" className="scroll-mt-20 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">
            {t.featuresTitle}
          </h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.features.map((feature) => (
              <li
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <h3 className="mb-1 font-semibold">{feature.title}</h3>
                <p className="text-sm text-slate-700">{feature.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="rgpd"
        className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-10 px-4 py-16 lg:grid-cols-2"
      >
        <Image
          unoptimized={staticSite}
          src={zoom}
          alt={t.zoomAlt}
          className="rounded-2xl border border-slate-200 shadow-xl"
          sizes="(min-width: 1024px) 560px, 100vw"
        />
        <div>
          <h2 className="mb-4 text-3xl font-bold">{t.privacyTitle}</h2>
          <ul className="flex flex-col gap-3">
            {t.privacyPoints.map((point) => (
              <li key={point} className="flex gap-3 text-slate-700">
                <span aria-hidden="true" className="text-brand-600 font-bold">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="tarifs" className="scroll-mt-20 bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">
            {t.pricingTitle}
          </h2>
          <p className="mb-10 text-center text-sm text-slate-600">
            {texts.pricingNote}
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {Object.values(PLANS).map((plan) => (
              <section
                key={plan.key}
                aria-labelledby={`tarif-${plan.key}`}
                data-testid="pricing-plan"
                className={`relative flex flex-col gap-4 rounded-2xl border bg-white p-6 ${plan.key === "pro" ? "border-brand-500 shadow-lg" : "border-slate-200"}`}
              >
                {plan.key === "pro" && (
                  <span className="bg-brand-600 absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-medium text-white">
                    {t.popular}
                  </span>
                )}
                <h3 id={`tarif-${plan.key}`} className="text-xl font-semibold">
                  {plan.name}
                </h3>
                <p>
                  <span className="text-4xl font-bold">
                    {plan.monthlyPrice}
                  </span>{" "}
                  <span className="text-sm text-slate-600">{t.perMonth}</span>
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {plan.highlights.map((line) => (
                    <li key={line}>✓ {line}</li>
                  ))}
                </ul>
                <a href={signup} className={`${ctaClass} mt-auto`}>
                  {texts.choose}
                </a>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold">{t.finalTitle}</h2>
        <a href={signup} className={ctaClass}>
          {cta}
        </a>
        <p className="mt-2 text-sm text-slate-600">{ctaNote}</p>
      </section>
    </SiteChrome>
  );
}

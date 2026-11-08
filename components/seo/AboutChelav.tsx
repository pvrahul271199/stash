/**
 * The /about/ page body (server-rendered, so it is in the static HTML). The FAQ list also feeds the FAQPage JSON-LD on that page:
 * keep what is shown and what is marked up the same.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does Chelav work out how much I can spend today?',
    a: 'You enter your monthly income, bills and savings once. Chelav takes what is left, your money to live on, and divides it by the days remaining in the month. Spend less than that today and every later day gets a little more; spend more and the extra is spread across the days that remain.',
  },
  {
    q: 'Do I need an account or to link my bank?',
    a: 'No. You can use Chelav as a guest and your data stays on your own device. Signing in with Google is optional and only backs your data up so you can see it on your other devices. Chelav never asks for bank details.',
  },
  {
    q: 'Does Chelav work offline?',
    a: 'Yes. It is a web app you can install on your phone, and it keeps working without a connection. Your spends are saved on the device first and synced when you are signed in and back online.',
  },
  {
    q: 'Can I track a trip or a special event separately?',
    a: 'Yes. Create an event such as a Goa trip, log spends into it, and see everything you spent on it together.',
  },
  {
    q: 'Which currency does Chelav use?',
    a: 'You pick the currency symbol you want to see, such as the rupee. Chelav shows amounts in whole units and does not convert between currencies.',
  },
];

export function AboutChelav() {
  return (
    <main className="h-full overflow-y-auto px-6 pb-12 pt-6 text-ink">
      <a href="/" className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-soft">
        &larr; Back to Chelav
      </a>
      <h1 className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight">
        Chelav: a daily spending limit and expense tracker
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-soft">
        Chelav is a calm expense tracker built around one question: <strong>how much can I spend today?</strong> Tell it
        what comes in and what goes out once, and every day you get a single number you can still spend. No guilt, no
        points, no bank linking.
      </p>

      <h2 className="mt-8 font-display text-[20px] font-semibold tracking-tight">How it works</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-soft">
        <li>Enter your monthly income, your bills and what you want to save.</li>
        <li>Chelav divides the money left over by the days remaining in the month, giving you today&rsquo;s allowance.</li>
        <li>Log a spend in a few seconds. Under-spend and every future day gets more; over-spend and the extra is spread over the remaining days.</li>
        <li>Close the day when you are done, and see how the month is going in Insights.</li>
      </ol>

      <h2 className="mt-8 font-display text-[20px] font-semibold tracking-tight">What you can do</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-soft">
        <li>See your daily spending limit change as you spend, so one big day never ruins the month.</li>
        <li>Log earlier days you missed, and spends planned for upcoming days.</li>
        <li>Group spends by category and by event, such as a weekend trip.</li>
        <li>Review each month by category, by day and against your plan.</li>
        <li>Install it on your phone and use it offline. Guests keep data on their own device; Google sign-in is optional.</li>
        <li>Try it first with sample data, with nothing to set up.</li>
      </ul>

      <h2 className="mt-8 font-display text-[20px] font-semibold tracking-tight">Frequently asked questions</h2>
      <dl className="mt-3 space-y-5">
        {FAQ.map((f) => (
          <div key={f.q}>
            <dt className="text-[15px] font-semibold">{f.q}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-soft">{f.a}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-10 text-[14px] text-faint">
        <a href="/privacy/" className="underline">
          Privacy policy
        </a>{' '}
        ·{' '}
        <a href="/terms/" className="underline">
          Terms of use
        </a>
      </p>
    </main>
  );
}

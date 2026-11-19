"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-semibold">Couldn’t open the prep book</h1>
      <p className="my-5">
        Check your connection and try again. Your saved dishes are stored
        securely in the database.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

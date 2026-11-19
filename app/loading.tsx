export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-4xl p-8" role="status">
      <p className="eyebrow">Kitchen Prep</p>
      <h1 className="text-3xl font-semibold mt-5">Opening the prep book…</h1>
      <div className="mt-8 h-28 rounded-xl bg-stone-200 motion-safe:animate-pulse" />
    </main>
  );
}

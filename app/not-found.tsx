import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl p-8">
      <h1 className="text-3xl font-semibold">Dish not found</h1>
      <p className="my-5">It may have been removed from the prep book.</p>
      <Link className="button primary" href="/">
        Return to lookup
      </Link>
    </main>
  );
}

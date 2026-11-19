import { loadData } from "@/lib/actions";
import { originalCatalog } from "@/lib/catalog";
import { Kitchen } from "@/components/kitchen";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await loadData();
  return (
    <Kitchen
      initial={
        result.ok
          ? result.data
          : { dishes: originalCatalog(), favorites: [], hidden: [] }
      }
      initialError={
        result.ok
          ? ""
          : "Showing the original 56-dish reference. " + result.error
      }
    />
  );
}

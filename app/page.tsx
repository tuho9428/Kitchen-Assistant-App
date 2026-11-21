import { loadData } from "@/lib/actions";
import { originalCatalog } from "@/lib/catalog";
import { MainTabs } from "@/components/main-tabs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const result = await loadData();
  return (
    <MainTabs
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

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 xl:border-x xl:border-line 3xl:max-w-8xl">
      <div className="pb-8 pt-10">
        <Label className="mb-3 block">Loading</Label>
        <Skeleton className="h-10 w-72 max-w-full" />
      </div>
      <div className="border-t border-line pt-6">
        <Skeleton className="h-14 w-56 max-w-full" />
        <div className="mt-8 grid gap-px bg-line sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </div>
  );
}

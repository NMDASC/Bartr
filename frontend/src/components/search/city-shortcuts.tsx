import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const cities = [
  ["Pittsburgh", "PA"], ["New York City", "NY"], ["Miami", "FL"],
  ["Chicago", "IL"], ["San Francisco", "CA"], ["Los Angeles", "CA"],
  ["Boston", "MA"], ["Seattle", "WA"],
];

export function CityShortcuts() {
  return (
    <nav aria-label="Explore cities" className="mt-4 flex flex-wrap items-center gap-3">
      <Label>Explore</Label>
      <div className="flex flex-wrap gap-2">
        {cities.map(([city, state]) => (
          <Button key={city} size="sm" variant="ghost" className="!px-1.5 !py-1 !text-[10px]" href={`/search?q=${encodeURIComponent(`laundromat in ${city}, ${state}`)}`}>
            {city}
          </Button>
        ))}
      </div>
    </nav>
  );
}

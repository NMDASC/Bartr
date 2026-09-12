import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/** Kept to what fits the hero column on one line. Adding a ninth wraps it. */
const cities = [
  ["Pittsburgh", "PA"], ["New York", "NY"], ["Miami", "FL"],
  ["Chicago", "IL"], ["San Francisco", "CA"], ["Los Angeles", "CA"], ["Boston", "MA"],
];

export function CityShortcuts() {
  return (
    <nav aria-label="Explore cities" className="mt-5">
      <Label className="mb-2 block">Explore cities</Label>
      <div className="flex flex-wrap gap-2">
        {cities.map(([city, state]) => (
          <Button key={city} size="sm" className="px-2.5" href={`/search?q=${encodeURIComponent(`laundromat in ${city}, ${state}`)}`}>
            {city}
          </Button>
        ))}
      </div>
    </nav>
  );
}

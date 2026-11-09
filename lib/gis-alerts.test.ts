import { describe, expect, it } from "vitest";
import { matchGisAlerts, parseGisFeed } from "@/lib/gis-alerts";
import type { FoodProduct } from "@/lib/food-products-types";

const rss = `<rss><channel>
<item><title>Ostrzeżenie: wycofanie napoju Monte Drink z partii 123</title><link>https://www.gov.pl/web/gis/monte</link><pubDate>Mon, 03 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Wycofanie sera</title><link>http://evil.example/x</link></item>
</channel></rss>`;

const prod = (over: Partial<FoodProduct>): FoodProduct => ({
  id: "x", barcode: null, name: "Monte Drink", brand: "Monte", servingLabel: "", calories: 0,
  proteinG: 0, fatG: 0, carbsG: 0, source: "local", ...over,
});

describe("gis-alerts", () => {
  it("parsuje RSS i odrzuca obce domeny", () => {
    const a = parseGisFeed(rss);
    expect(a).toHaveLength(1);
    expect(a[0]!.publishedAt).toContain("2026-11-03");
  });
  it("parsuje HTML gov.pl", () => {
    const html = `<a href="/web/gis/ostrzezenie-przed-produktem-x">Ostrzeżenie publiczne dotyczące produktu X</a><a href="/web/gis/kontakt">Kontakt z nami tutaj</a>`;
    expect(parseGisFeed(html)).toHaveLength(1);
  });
  it("dopasowuje markę + nazwę, nie dopasowuje obcych", () => {
    const alerts = parseGisFeed(rss);
    expect(matchGisAlerts(alerts, prod({}))).toHaveLength(1);
    expect(matchGisAlerts(alerts, prod({ name: "Banan", brand: "Inna" }))).toHaveLength(0);
  });
});

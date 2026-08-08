import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PUBLIC_HOLIDAYS } from "@/lib/holidays";
import { CompanySettingsStore } from "@/lib/companySettingsStore";

export function HolidayCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [country, setCountry] = useState(CompanySettingsStore.get().country);
  const holidays = PUBLIC_HOLIDAYS[country] ?? [];

  const grouped = holidays.reduce((acc, date) => {
    const month = date.slice(5, 2); // MM
    if (!acc[month]) acc[month] = [];
    acc[month].push(date);
    return acc;
  }, {} as Record<string, string[]>);

  const monthNames = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
  ];

  const handleCountryChange = (c: keyof typeof PUBLIC_HOLIDAYS) => {
    setCountry(c);
    CompanySettingsStore.update({ country: c });
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">Public Holidays ({country})</h4>
        <div className="flex items-center gap-2">
          <Select value={country} onValueChange={handleCountryChange}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ZA">South Africa</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="w-20 border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
      <div className="space-y-3">
        {Object.entries(grouped).map(([mm, dates]) => (
          <div key={mm}>
            <div className="font-medium text-sm mb-1">{monthNames[parseInt(mm) - 1]} {year}</div>
            <div className="flex flex-wrap gap-1">
              {dates.map((d) => (
                <Badge key={d} variant="secondary" className="text-xs">
                  {d.slice(8)} {/* DD */}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { publicHolidays } from "@/lib/holidays";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function HolidayCalendar() {
  const [year, setYear] = useState(() => new Date().getFullYear());

  // Grouped by month. The previous version grouped on date.slice(5, 2), which
  // returns an empty string because the end index precedes the start, so every
  // holiday landed in a single unlabelled group.
  const byMonth = useMemo(() => {
    const groups = new Map<number, { date: string; name: string; observed?: boolean }[]>();
    for (const holiday of publicHolidays(year)) {
      const month = Number(holiday.date.slice(5, 7)) - 1;
      const list = groups.get(month) ?? [];
      list.push(holiday);
      groups.set(month, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [year]);

  const total = byMonth.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <Card className="mt-4 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h4 className="font-semibold text-foreground">Public holidays</h4>
          <p className="text-xs text-muted-foreground">
            South Africa · {total} days in {year}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="tabular w-12 text-center text-sm font-medium">{year}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {byMonth.map(([month, holidays]) => (
          <div key={month} className="flex flex-col gap-1.5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {MONTHS[month]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {holidays.map((h) => (
                <Badge
                  key={h.date}
                  variant={h.observed ? "outline" : "secondary"}
                  className="text-xs font-normal"
                  title={h.date}
                >
                  <span className="tabular mr-1.5 font-medium">{h.date.slice(8)}</span>
                  {h.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

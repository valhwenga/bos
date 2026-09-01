import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator } from "lucide-react";
import { computeTax, type TaxResult } from "@/lib/taxEngine";

type Props = {
  grossSalary: number;
  allowances: number;
};

export function TaxDeductionsPanel({ grossSalary, allowances }: Props) {
  // South Africa only. The selector here offered seven countries; four of them
  // returned a flat 20% placeholder as though it were a real calculation, and
  // the US option used a bracket table that disagreed with the payroll module's.
  const [result, setResult] = useState<TaxResult | null>(null);

  useEffect(() => {
    const annualGross = (grossSalary + allowances) * 12;
    try {
      setResult(computeTax(annualGross, "ZA"));
    } catch {
      setResult(null);
    }
  }, [grossSalary, allowances]);

  if (!result) {
    return (
      <Card className="p-4 mt-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Tax & Deductions
        </h4>
        <div className="text-sm text-muted-foreground">Could not calculate deductions for this salary.</div>
      </Card>
    );
  }

  const monthlyNet = result.netPay / 12;

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5" />
        Tax &amp; Deductions (South Africa)
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Gross Annual:</span>
          <span>{((grossSalary + allowances) * 12).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Income Tax:</span>
          <span>{result.incomeTax.toLocaleString()}</span>
        </div>
        {Object.entries(result.statutoryDeductions).map(([key, val]) => (
          <div key={key} className="flex justify-between">
            <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
            <span>{val?.toLocaleString() ?? "—"}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Total Deductions:</span>
          <span>{result.totalDeductions.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Net Annual:</span>
          <span>{result.netPay.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-lg">
          <span>Net Monthly:</span>
          <span>{monthlyNet.toLocaleString()}</span>
        </div>
      </div>
    </Card>
  );
}

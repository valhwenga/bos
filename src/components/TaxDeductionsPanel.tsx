import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign } from "lucide-react";
import { CompanySettingsStore } from "@/lib/companySettingsStore";
import { computeTax, type TaxCountry, type TaxResult } from "@/lib/taxEngine";

type Props = {
  grossSalary: number;
  allowances: number;
};

export function TaxDeductionsPanel({ grossSalary, allowances }: Props) {
  const [country, setCountry] = useState<TaxCountry>(CompanySettingsStore.get().country as TaxCountry);
  const [result, setResult] = useState<TaxResult | null>(null);

  useEffect(() => {
    const annualGross = (grossSalary + allowances) * 12;
    try {
      setResult(computeTax(annualGross, country));
    } catch {
      setResult(null);
    }
  }, [grossSalary, allowances, country]);

  const handleCountryChange = (c: TaxCountry) => {
    setCountry(c);
    CompanySettingsStore.update({ country: c as any });
  };

  if (!result) {
    return (
      <Card className="p-4 mt-4">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Tax & Deductions
        </h4>
        <div className="text-sm text-muted-foreground">Tax engine not available for {country}.</div>
      </Card>
    );
  }

  const monthlyNet = result.netPay / 12;

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5" />
        Tax & Deductions ({country})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-muted-foreground">Tax Country</label>
          <Select value={country} onValueChange={handleCountryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ZA">South Africa</SelectItem>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="FR">France</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button size="sm" variant="outline">
            <DollarSign className="w-4 h-4 mr-2" />
            Recalculate
          </Button>
        </div>
      </div>
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

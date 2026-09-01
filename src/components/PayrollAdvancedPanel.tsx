import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Calculator } from "lucide-react";
import { CompanySettingsStore } from "@/lib/companySettingsStore";
import { toast } from "@/components/ui/use-toast";
import { COUNTRY_TO_CURRENCY, CURRENCY_SYMBOLS, computeTaxUS, generateACH, generateBACS } from "@/lib/payrollAdvanced";

type PayrollRow = {
  employee: string;
  id: string; // treated as employeeId
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: string;
};

type Props = {
  data: PayrollRow[];
};

export function PayrollAdvancedPanel({ data }: Props) {
  const [country, setCountry] = useState(CompanySettingsStore.get().country);
  const [taxMethod, setTaxMethod] = useState<"us" | "gb">("us");
  const currency = CURRENCY_SYMBOLS[COUNTRY_TO_CURRENCY[country] ?? "USD"];

  const handleCountryChange = (c: string) => {
    setCountry(c);
    CompanySettingsStore.update({ country: c as any });
  };

  // Compute estimated tax for demo (US only)
  const estimatedTax = taxMethod === "us" ? data.reduce((sum, r) => sum + computeTaxUS(r.basicSalary + r.allowances), 0) : 0;

  const handleExportBank = () => {
    const enriched = data.map(r => ({
      employeeId: r.id,
      employeeName: r.employee,
      netSalary: r.netSalary,
      bankAccount: "000000000", // placeholder
      routingNumber: "000000000", // placeholder
      sortCode: "000000", // placeholder
      accountNumber: "00000000", // placeholder
    }));
    let content: string;
    try {
      content = country === "US" ? generateACH(enriched) : generateBACS(enriched);
    } catch (err) {
      // Bank details are not captured against employees yet, so the export
      // cannot produce a usable file. Say so rather than downloading one full
      // of zeros that looks valid.
      toast({
        title: "Bank export unavailable",
        description: err instanceof Error ? err.message : "Could not build the bank file.",
        variant: "destructive",
      });
      return;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank_export_${country}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5" />
        Advanced Payroll
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="text-xs text-muted-foreground">Country (for currency & holidays)</label>
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
              <SelectItem value="DE">Germany (EUR)</SelectItem>
              <SelectItem value="FR">France (EUR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tax Method (demo)</label>
          <Select value={taxMethod} onValueChange={(v) => setTaxMethod(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">US Tax Brackets</SelectItem>
              <SelectItem value="gb">UK PAYE (placeholder)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={handleExportBank}>
            <Download className="w-4 h-4 mr-2" />
            Export Bank File
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div>Currency: <Badge variant="secondary">{currency}</Badge></div>
        {taxMethod === "us" && (
          <div>Estimated Annual Tax (US): <Badge variant="outline">{currency}{estimatedTax.toLocaleString()}</Badge></div>
        )}
      </div>
    </Card>
  );
}

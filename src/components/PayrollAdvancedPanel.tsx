import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Download, Calculator } from "lucide-react";
import { CompanySettingsStore } from "@/lib/companySettingsStore";
import { toast } from "@/components/ui/use-toast";
import { CURRENCY_SYMBOLS, generateBACS } from "@/lib/payrollAdvanced";
import { computeTax } from "@/lib/taxEngine";

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
  // South Africa only, so there is no country or tax-method choice to make.
  // The picker previously offered seven countries, four of which returned a
  // flat 20% placeholder presented as a real figure.
  const currency = CURRENCY_SYMBOLS.ZAR;

  const estimatedTax = data.reduce(
    (sum, r) => sum + computeTax(r.basicSalary + r.allowances, "ZA").incomeTax,
    0,
  );

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
      content = generateBACS(enriched);
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
    a.download = `bank_export_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-4 mt-4">
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <Calculator className="w-5 h-5" />
        Advanced Payroll
      </h4>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>Currency: <Badge variant="secondary">{currency}</Badge></div>
          <div>
            Estimated annual PAYE:{" "}
            <Badge variant="outline">
              {currency}{estimatedTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Badge>
          </div>
        </div>
        <Button size="sm" onClick={handleExportBank}>
          <Download className="w-4 h-4 mr-2" />
          Export Bank File
        </Button>
      </div>
    </Card>
  );
}

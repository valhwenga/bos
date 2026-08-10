import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, Send, Eye, UserCheck, Calculator, Play, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CompanySettingsStore } from "@/lib/companySettings";
import { generatePayslipPdf } from "@/lib/payslipPdf";
import { batchGeneratePayslips, emailPayslips } from "@/lib/payslipBatch";
import { PayrollAdvancedPanel } from "@/components/PayrollAdvancedPanel";
import { TaxDeductionsPanel } from "@/components/TaxDeductionsPanel";
import ProfessionalPayslipPreview from "@/components/ProfessionalPayslipPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEED = [
  {
    employee: "John Anderson",
    id: "SPI001",
    department: "Engineering",
    basicSalary: 85000,
    allowances: 5000,
    deductions: 8500,
    netSalary: 81500,
    status: "Paid",
    paymentDate: "01 Oct 2025",
  },
  {
    employee: "Sarah Williams",
    id: "SPI002",
    department: "Marketing",
    basicSalary: 75000,
    allowances: 4500,
    deductions: 7500,
    netSalary: 72000,
    status: "Paid",
    paymentDate: "01 Oct 2025",
  },
  {
    employee: "Michael Chen",
    id: "SPI003",
    department: "Engineering",
    basicSalary: 70000,
    allowances: 4000,
    deductions: 7000,
    netSalary: 67000,
    status: "Pending",
    paymentDate: "-",
  },
  {
    employee: "Emily Davis",
    id: "SPI004",
    department: "Human Resources",
    basicSalary: 72000,
    allowances: 4200,
    deductions: 7200,
    netSalary: 69000,
    status: "Paid",
    paymentDate: "01 Oct 2025",
  },
  {
    employee: "Robert Johnson",
    id: "SPI005",
    department: "Sales",
    basicSalary: 65000,
    allowances: 3500,
    deductions: 6500,
    netSalary: 62000,
    status: "Pending",
    paymentDate: "-",
  },
  {
    employee: "Lisa Martinez",
    id: "SPI006",
    department: "Finance",
    basicSalary: 68000,
    allowances: 3800,
    deductions: 6800,
    netSalary: 65000,
    status: "Paid",
    paymentDate: "01 Oct 2025",
  },
];

const payrollStats = [
  {
    title: "Total Payroll",
    value: 416500,
    change: "+5.2%",
    icon: DollarSign,
    color: "bg-info",
  },
  {
    title: "Paid This Month",
    value: 269500,
    change: "4 employees",
    icon: DollarSign,
    color: "bg-success",
  },
  {
    title: "Pending Payments",
    value: 129000,
    change: "2 employees",
    icon: DollarSign,
    color: "bg-warning",
  },
  {
    title: "Total Deductions",
    value: 43500,
    change: "10.5%",
    icon: DollarSign,
    color: "bg-primary",
  },
];

const statusColors = {
  Paid: "bg-primary text-primary-foreground",
  Pending: "bg-warning text-warning-foreground",
  Failed: "bg-danger text-danger-foreground",
};

const HRMPayroll = () => {
  const [payrollData, setPayrollData] = useState(SEED);
  const cs = CompanySettingsStore.get();
  const [processingPayroll, setProcessingPayroll] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [selectedPeriod, setSelectedPeriod] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">("pdf");
  const [reviewMode, setReviewMode] = useState(false);
  const [selectedReviewEmployee, setSelectedReviewEmployee] = useState("");
  const [reviewEmployeeId, setReviewEmployeeId] = useState("");
  const [showPayslipPreview, setShowPayslipPreview] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const printPayslip = (r: { employee: string; id: string; department: string; basicSalary: number; allowances: number; deductions: number; netSalary: number; status: string; paymentDate: string }) => {
    // Use the new PDF generator instead of window.print
    generatePayslipPdf({
      employee: r.employee,
      employeeId: r.id,
      department: r.department,
      basicSalary: r.basicSalary,
      allowances: r.allowances,
      deductions: r.deductions,
      netSalary: r.netSalary,
      paymentDate: r.paymentDate,
      status: r.status,
    });
  };

  const emailPayslip = (r: { employee: string; id: string; department: string; basicSalary: number; allowances: number; deductions: number; netSalary: number; status: string; paymentDate: string }) => {
    const subject = encodeURIComponent(`Payslip for ${r.employee}`);
    const sym = cs.currencySymbol || "R";
    const body = encodeURIComponent(
      `Dear ${r.employee},%0D%0A%0D%0APlease find your payslip details below.%0D%0ANet Salary: ${sym}${r.netSalary.toLocaleString()}%0D%0APayment Date: ${r.paymentDate}.%0D%0A%0D%0ARegards,%0DPayroll`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleReviewEmployeeChange = (employeeName: string) => {
    setSelectedReviewEmployee(employeeName);
    const emp = payrollData.find(r => r.employee === employeeName);
    setReviewEmployeeId(emp ? emp.id : "");
  };

  const getSelectedReviewEmployeeData = () => payrollData.find(r => r.employee === selectedReviewEmployee);

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  const getPeriodLabel = (period: string) => {
    const [yy, mm] = period.split("-");
    const idx = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    return monthNames[idx] + " " + yy;
  };

  /**
   * Payroll rows key the employee as `id`; the payslip helpers expect
   * `employeeId`. Bridge the two rather than reshaping either side.
   */
  const toPayslipRows = <T extends { id: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, employeeId: r.id }));

  const displayedData = payrollData.filter((r) => {
    const [yy, mm] = selectedPeriod.split("-");
    const idx = Math.max(0, Math.min(11, parseInt(mm, 10) - 1));
    const monShort = monthNames[idx].slice(0, 3);
    const year = yy;
    const now = new Date();
    const cur = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    if (selectedPeriod === cur) {
      return true;
    }
    return r.paymentDate.includes(monShort) && r.paymentDate.includes(year);
  });

  const processPayroll = async () => {
    setProcessingPayroll(true);
    try {
      // Get all pending payroll entries
      const pendingEntries = displayedData.filter(r => r.status === 'Pending');
      
      if (pendingEntries.length === 0) {
        alert('No pending payroll entries to process');
        return;
      }

      // Simulate processing
      for (let i = 0; i < pendingEntries.length; i++) {
        // Update status to 'Paid'
        const updatedData = payrollData.map(r => 
          r.id === pendingEntries[i].id ? { ...r, status: 'Paid' } : r
        );
        setPayrollData(updatedData);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      alert(`Successfully processed ${pendingEntries.length} payroll entries`);
    } catch (error) {
      console.error('Error processing payroll:', error);
      alert('Error processing payroll. Please try again.');
    } finally {
      setProcessingPayroll(false);
    }
  };

  const exportReport = (format: "csv" | "json" | "pdf") => {
    const headers = [
      "Employee","ID","Department","Basic Salary","Allowances",
      "Deductions","Net Salary","Status","Payment Date",
    ];

    if (format === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      const title = "Payroll Report - " + getPeriodLabel(selectedPeriod);
      const sym = cs.currencySymbol || "R";
      const rows = displayedData.map(r => [
        r.employee, r.id, r.department, r.basicSalary, r.allowances, r.deductions, r.netSalary, r.status, r.paymentDate
      ]);
      const withCurrency = (colIndex: number, value: unknown) => {
        if (typeof value === "number" && [3, 4, 5, 6].includes(colIndex)) return `${sym}${value.toLocaleString()}`;
        return String(value);
      };
      const tableRows = rows.map(row => "<tr>" + row.map((col, idx) => "<td style=\"padding:8px;border-bottom:1px solid #e5e7eb;text-align:left\">" + withCurrency(idx, col) + "</td>").join("") + "</tr>").join("");
      win.document.write("<html><head><title>" + title + "</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px} h1{margin:0 0 16px 0} table{width:100%;border-collapse:collapse;margin-top:8px} th{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left} </style></head><body>" +
        "<h1>" + title + "</h1>" +
        "<table><thead><tr>" + headers.map(h => "<th>" + h + "</th>").join("") + "</tr></thead><tbody>" + tableRows + "</tbody></table>" +
        "</body></html>");
      win.document.close();
      win.focus();
      win.print();
      return;
    }

    if (format === "json") {
      const blob = new Blob([JSON.stringify(displayedData, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "payroll-" + selectedPeriod + ".json";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const rows = displayedData.map((r) => [
      r.employee, r.id, r.department, r.basicSalary, r.allowances,
      r.deductions, r.netSalary, r.status, r.paymentDate,
    ]);

    const escapeCSV = (val: string | number) => {
      const s = String(val ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll-" + selectedPeriod + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payroll Management</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Dashboard</span>
            <span>›</span>
            <span>HRM System</span>
            <span>›</span>
            <span className="text-primary">Payroll</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            className="border rounded h-9 px-3 text-sm"
            value={selectedDate}
            onChange={(e) => {
              const v = e.target.value; // yyyy-mm-dd
              setSelectedDate(v);
              if (v && v.length >= 7) {
                const y = v.slice(0,4);
                const m = v.slice(5,7);
                setSelectedPeriod(`${y}-${m}`);
              }
            }}
          />
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "json" | "pdf")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => exportReport(exportFormat)}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/hrm/payroll/manage'}>
            <Calculator className="w-4 h-4 mr-2" />
            Manage Payroll
          </Button>
          <Button size="sm" onClick={processPayroll} disabled={processingPayroll}>
            <Play className="w-4 h-4 mr-2" />
            {processingPayroll ? 'Processing...' : 'Process Payroll'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => batchGeneratePayslips(toPayslipRows(displayedData))}>
            <Download className="w-4 h-4 mr-2" />
            Batch PDF
          </Button>
          <Button size="sm" variant={reviewMode ? "default" : "outline"} onClick={() => setReviewMode(!reviewMode)}>
            <UserCheck className="w-4 h-4 mr-2" />
            Review
          </Button>
          <Button size="sm" variant="outline" onClick={() => emailPayslips(toPayslipRows(displayedData))}>
            <Send className="w-4 h-4 mr-2" />
            Email All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {payrollStats.map((stat, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-success">{stat.change}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-2xl font-bold">{cs.currencySymbol}{Number(stat.value).toLocaleString()}</p>
          </Card>
        ))}
      </div>

      {/* Compact Add Review in Performance */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UserCheck className="w-4 h-4" />
            Add Review
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Select value={selectedReviewEmployee} onValueChange={handleReviewEmployeeChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select employee to review" />
              </SelectTrigger>
              <SelectContent>
                {payrollData.map((emp) => (
                  <SelectItem key={emp.id} value={emp.employee}>
                    {emp.employee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="text"
              className="border rounded px-3 py-2 w-32 text-sm"
              value={reviewEmployeeId}
              readOnly
              placeholder="Employee #"
            />
            <Button size="sm" disabled={!selectedReviewEmployee}>
              Add Review
            </Button>
          </div>
        </div>
      </Card>

      {reviewMode && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Employee Review
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Employee</label>
              <Select value={selectedReviewEmployee} onValueChange={handleReviewEmployeeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee" />
                </SelectTrigger>
                <SelectContent>
                  {payrollData.map((emp) => (
                    <SelectItem key={emp.id} value={emp.employee}>
                      {emp.employee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employee Number</label>
              <input
                type="text"
                className="border rounded px-3 py-2 w-full"
                value={reviewEmployeeId}
                readOnly
                placeholder="Auto-filled"
              />
            </div>
            <div className="flex items-end">
              <Button size="sm" disabled={!selectedReviewEmployee}>
                Start Review
              </Button>
            </div>
          </div>

          {getSelectedReviewEmployeeData() && (
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Review Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><strong>Employee:</strong> {getSelectedReviewEmployeeData()?.employee}</div>
                <div><strong>ID:</strong> {getSelectedReviewEmployeeData()?.id}</div>
                <div><strong>Department:</strong> {getSelectedReviewEmployeeData()?.department}</div>
                <div><strong>Status:</strong> {getSelectedReviewEmployeeData()?.status}</div>
                <div><strong>Basic Salary:</strong> {cs.currencySymbol}{getSelectedReviewEmployeeData()?.basicSalary.toLocaleString()}</div>
                <div><strong>Allowances:</strong> {cs.currencySymbol}{getSelectedReviewEmployeeData()?.allowances.toLocaleString()}</div>
                <div><strong>Deductions:</strong> {cs.currencySymbol}{getSelectedReviewEmployeeData()?.deductions.toLocaleString()}</div>
                <div><strong>Net Salary:</strong> {cs.currencySymbol}{getSelectedReviewEmployeeData()?.netSalary.toLocaleString()}</div>
                <div className="md:col-span-2"><strong>Payment Date:</strong> {getSelectedReviewEmployeeData()?.paymentDate}</div>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Select defaultValue="10">
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries per page</span>
          </div>

          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 font-semibold text-sm">EMPLOYEE</th>
                <th className="text-left p-4 font-semibold text-sm">BASIC SALARY</th>
                <th className="text-left p-4 font-semibold text-sm">ALLOWANCES</th>
                <th className="text-left p-4 font-semibold text-sm">DEDUCTIONS</th>
                <th className="text-left p-4 font-semibold text-sm">NET SALARY</th>
                <th className="text-left p-4 font-semibold text-sm">STATUS</th>
                <th className="text-left p-4 font-semibold text-sm">PAYMENT DATE</th>
                <th className="text-right p-4 font-semibold text-sm">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((record, index) => (
                <tr key={index} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                          {record.employee.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{record.employee}</p>
                        <p className="text-xs text-muted-foreground">{record.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium">{cs.currencySymbol}{record.basicSalary.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-success">+{cs.currencySymbol}{record.allowances.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-danger">-{cs.currencySymbol}{record.deductions.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-bold">{cs.currencySymbol}{record.netSalary.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <Badge className={statusColors[record.status as keyof typeof statusColors]}>
                      {record.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{record.paymentDate}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 text-info hover:text-info hover:bg-info-soft" 
                        onClick={() => {
                          setSelectedEmployee(record);
                          setShowPayslipPreview(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-success hover:text-success hover:bg-success-soft" onClick={()=> emailPayslip(record)}>
                        <Send className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={()=> printPayslip(record)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing 1 to 6 of 6 entries</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">
              1
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Advanced Payroll Panel */}
      <PayrollAdvancedPanel data={displayedData} />
      <TaxDeductionsPanel grossSalary={displayedData[0]?.basicSalary || 0} allowances={displayedData[0]?.allowances || 0} />

      {/* Professional Payslip Preview Dialog */}
      {showPayslipPreview && selectedEmployee && (
        <div className="fixed inset-0 bg-foreground bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-card border-b p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Payslip Preview</h2>
              <div className="flex gap-2">
                <Button onClick={() => generatePayslipPdf({
                  employee: selectedEmployee.employee,
                  employeeId: selectedEmployee.id,
                  department: selectedEmployee.department,
                  basicSalary: selectedEmployee.basicSalary,
                  allowances: selectedEmployee.allowances,
                  deductions: selectedEmployee.deductions,
                  netSalary: selectedEmployee.netSalary,
                  paymentDate: selectedEmployee.paymentDate,
                  status: selectedEmployee.status
                })}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={() => setShowPayslipPreview(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="p-4">
              <ProfessionalPayslipPreview 
                payroll={{
                  employee: selectedEmployee.employee,
                  employeeId: selectedEmployee.id,
                  department: selectedEmployee.department,
                  basicSalary: selectedEmployee.basicSalary,
                  allowances: selectedEmployee.allowances,
                  deductions: selectedEmployee.deductions,
                  netSalary: selectedEmployee.netSalary,
                  paymentDate: selectedEmployee.paymentDate,
                  status: selectedEmployee.status
                }} 
                showActions={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRMPayroll;

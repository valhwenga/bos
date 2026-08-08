import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, Send, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    id: "EMP001",
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
    id: "EMP002",
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
    id: "EMP003",
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
    id: "EMP004",
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
    id: "EMP005",
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
    id: "EMP006",
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
    value: "$416,500",
    change: "+5.2%",
    icon: DollarSign,
    color: "bg-blue-500",
  },
  {
    title: "Paid This Month",
    value: "$269,500",
    change: "4 employees",
    icon: DollarSign,
    color: "bg-green-500",
  },
  {
    title: "Pending Payments",
    value: "$129,000",
    change: "2 employees",
    icon: DollarSign,
    color: "bg-orange-500",
  },
  {
    title: "Total Deductions",
    value: "$43,500",
    change: "10.5%",
    icon: DollarSign,
    color: "bg-purple-500",
  },
];

const statusColors = {
  Paid: "bg-primary text-white",
  Pending: "bg-orange-500 text-white",
  Failed: "bg-red-500 text-white",
};

const HRMPayroll = () => {
  const [payrollData] = useState(SEED);

  const printPayslip = (r: any) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const gross = r.basicSalary + r.allowances;
    win.document.write(`
      <html><head><title>Payslip - ${r.employee}</title>
      <style>
        body{font-family: Inter, Arial, sans-serif; padding:24px}
        h1{margin:0 0 8px 0}
        table{width:100%; border-collapse:collapse; margin-top:16px}
        th,td{padding:8px; border-bottom:1px solid #e5e7eb; text-align:left}
      </style></head><body>
      <h1>Payslip</h1>
      <div>${r.employee} (${r.id}) • ${r.department}</div>
      <div>Date: ${r.paymentDate}</div>
      <table>
        <thead><tr><th>Item</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td>$${r.basicSalary.toLocaleString()}</td></tr>
          <tr><td>Allowances</td><td>$${r.allowances.toLocaleString()}</td></tr>
          <tr><td>Deductions</td><td>-$${r.deductions.toLocaleString()}</td></tr>
          <tr><td><strong>Gross</strong></td><td><strong>$${gross.toLocaleString()}</strong></td></tr>
          <tr><td><strong>Net Salary</strong></td><td><strong>$${r.netSalary.toLocaleString()}</strong></td></tr>
        </tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const emailPayslip = (r: any) => {
    const subject = encodeURIComponent(`Payslip for ${r.employee}`);
    const body = encodeURIComponent(
      `Dear ${r.employee},%0D%0A%0D%0APlease find your payslip details below.%0D%0ANet Salary: $${r.netSalary.toLocaleString()}%0D%0APayment Date: ${r.paymentDate}.%0D%0A%0D%0ARegards,%0DPayroll`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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
          <Select defaultValue="oct2025">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oct2025">October 2025</SelectItem>
              <SelectItem value="sep2025">September 2025</SelectItem>
              <SelectItem value="aug2025">August 2025</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {payrollStats.map((stat, index) => (
          <Card key={index} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-medium text-green-600">{stat.change}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

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
              {payrollData.map((record, index) => (
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
                    <span className="text-sm font-medium">${record.basicSalary.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-green-600">+${record.allowances.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-red-600">-${record.deductions.toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-bold">${record.netSalary.toLocaleString()}</span>
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
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={()=> printPayslip(record)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={()=> emailPayslip(record)}>
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
    </div>
  );
};

export default HRMPayroll;

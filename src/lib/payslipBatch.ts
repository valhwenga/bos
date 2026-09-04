import { generatePayslipPdf } from "./payslipPdf";

/**
 * Batch generate payslips for multiple employees and optionally trigger email downloads.
 */
export function batchGeneratePayslips(payrolls: Array<{
  employee: string;
  employeeId: string;
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: string;
}>) {
  for (const p of payrolls) {
    generatePayslipPdf(p);
  }
}

/**
 * Simulate sending payslip emails (mailto: fallback).
 * In production, replace with backend email service.
 */
export function emailPayslips(payrolls: Array<{
  employee: string;
  employeeId: string;
  netSalary: number;
  paymentDate: string;
}>) {
  const subject = encodeURIComponent("Your Payslip");
  for (const p of payrolls) {
    const body = encodeURIComponent(
      `Dear ${p.employee},\n\nPlease find your payslip attached.\nNet Salary: $${p.netSalary.toLocaleString()}\nPayment Date: ${p.paymentDate}\n\nRegards,\nPayroll`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }
}

/**
 * Generate a payslip PDF using jsPDF.
 * Returns a Blob for download.
 */
import { CompanySettingsStore } from "./companySettings";

export function generatePayslipPdf(payroll: {
  employee: string;
  employeeId: string;
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  status: string;
}) {
  import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF();
    const cs = CompanySettingsStore.get();
    const primaryColor = cs.primaryColor || "#2563eb";
    const secondaryColor = cs.secondaryColor || "#64748b";

    // Professional header with watermark
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 210, 297, "F");
    
    // Company branding header
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, 210, 45, "F");
    
    // Add logo with white background if available
    if (cs.logoDataUrl) {
      try {
        // White background for logo area (25% smaller)
        doc.setFillColor(255, 255, 255);
        doc.rect(3, 1, 44, 44, "F");
        
        // Add subtle border around white area
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.rect(3, 1, 44, 44);
        
        // Add logo to the center of white background (25% smaller)
        doc.addImage(cs.logoDataUrl, "PNG", 5, 5, 36, 36);
      } catch (error) {
        console.log("Could not add logo to PDF:", error);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text("PAYSLIP", cs.logoDataUrl ? 135 : 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("CONFIDENTIAL - EMPLOYEE PAYMENT RECORD", cs.logoDataUrl ? 135 : 105, 30, { align: "center" });
    
    // Company info in header
    doc.setFontSize(10);
    doc.text(cs.name || "Company Name", cs.logoDataUrl ? 135 : 105, 38, { align: "center" });
    
    // Payslip period and date
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(`Pay Period: ${payroll.paymentDate}`, 140, 55);
    doc.text(`Status: ${payroll.status.toUpperCase()}`, 140, 62);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 140, 69);

    // Employee details box
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(0.5);
    doc.rect(15, 80, 180, 40);
    
    doc.setFillColor(250, 250, 250);
    doc.rect(15, 80, 180, 10, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(primaryColor);
    doc.rect(15, 80, 180, 10, "F");
    doc.text("EMPLOYEE DETAILS", 105, 87, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Name: ${payroll.employee}`, 20, 100);
    doc.text(`Employee ID: ${payroll.employeeId}`, 20, 108);
    doc.text(`Department: ${payroll.department}`, 20, 116);
    doc.text(`Payment Date: ${payroll.paymentDate}`, 110, 100);
    doc.text(`Tax Year: ${new Date().getFullYear()}`, 110, 108);
    doc.text(`Pay Method: Bank Transfer`, 110, 116);

    // Earnings section
    doc.setDrawColor(primaryColor);
    doc.rect(15, 130, 85, 60);
    
    doc.setFillColor(primaryColor);
    doc.rect(15, 130, 85, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("EARNINGS", 57, 137, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("Basic Salary", 20, 150);
    doc.text(`${cs.currencySymbol || "R"}${payroll.basicSalary.toLocaleString()}`, 20, 157);
    doc.text("Allowances", 20, 165);
    doc.text(`${cs.currencySymbol || "R"}${payroll.allowances.toLocaleString()}`, 20, 172);
    
    const gross = payroll.basicSalary + payroll.allowances;
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(1);
    doc.line(20, 178, 95, 178);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Gross Pay", 20, 183);
    doc.text(`${cs.currencySymbol || "R"}${gross.toLocaleString()}`, 20, 190);

    // Deductions section
    doc.setDrawColor(secondaryColor);
    doc.rect(110, 130, 85, 60);
    
    doc.setFillColor(secondaryColor);
    doc.rect(110, 130, 85, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("DEDUCTIONS", 152, 137, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.text("PAYE Tax", 115, 150);
    doc.text(`${cs.currencySymbol || "R"}${Math.round(payroll.deductions * 0.7).toLocaleString()}`, 115, 157);
    doc.text("UIF Contributions", 115, 165);
    doc.text(`${cs.currencySymbol || "R"}${Math.round(payroll.deductions * 0.1).toLocaleString()}`, 115, 172);
    doc.text("Other Deductions", 115, 180);
    doc.text(`${cs.currencySymbol || "R"}${Math.round(payroll.deductions * 0.2).toLocaleString()}`, 115, 187);
    
    doc.setDrawColor(secondaryColor);
    doc.setLineWidth(1);
    doc.line(115, 192, 190, 192);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("Total Deductions", 115, 197);
    doc.text(`${cs.currencySymbol || "R"}${payroll.deductions.toLocaleString()}`, 115, 204);

    // Net Pay highlight
    doc.setFillColor(34, 197, 94);
    doc.rect(15, 200, 180, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("NET PAY", 105, 212, { align: "center" });
    doc.text(`${cs.currencySymbol || "R"}${payroll.netSalary.toLocaleString()}`, 105, 220, { align: "center" });

    // Footer with company details
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8);
    doc.text(`${cs.name || "Company Name"}`, 20, 240);
    if (cs.address) doc.text(cs.address, 20, 245);
    if (cs.phone) doc.text(`Tel: ${cs.phone}`, 20, 250);
    if (cs.email) doc.text(`Email: ${cs.email}`, 20, 255);
    if (cs.taxId) doc.text(`Tax ID: ${cs.taxId}`, 20, 260);

    // Legal disclaimer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("This document contains confidential financial information. Unauthorized distribution is prohibited.", 105, 280, { align: "center" });
    doc.text("This is a computer-generated payslip and does not require a physical signature.", 105, 285, { align: "center" });

    // Save and download
    const pdfBlob = doc.output("blob");
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip_${payroll.employeeId}_${payroll.paymentDate.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

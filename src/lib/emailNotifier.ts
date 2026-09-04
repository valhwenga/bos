/**
 * Simple email notifier using mailto: fallback.
 * In production, replace with a backend email service (SendGrid, SES, etc.).
 */
export function sendEmail(to: string, subject: string, body: string) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const mailto = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
  window.open(mailto, "_blank");
}

/**
 * Notify manager of a new leave request.
 */
export function notifyManagerOfLeaveRequest(leave: {
  employee: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  appliedOn: string;
}, managerEmail?: string) {
  const subject = `Leave Request: ${leave.employee} - ${leave.type}`;
  const body = `Hi,

A new leave request has been submitted:

Employee: ${leave.employee} (${leave.employeeId})
Type: ${leave.type}
Dates: ${leave.startDate} to ${leave.endDate}
Days: ${leave.days}
Reason: ${leave.reason}
Applied On: ${new Date(leave.appliedOn).toLocaleDateString()}

Please review and approve/reject in the HRM system.

Thanks,
HRM System`;
  if (managerEmail) {
    sendEmail(managerEmail, subject, body);
  } else {
    // Fallback: open mailto without recipient
    sendEmail("", subject, body);
  }
}

/**
 * Notify employee of leave approval/rejection.
 */
export function notifyEmployeeOfLeaveDecision(leave: {
  employee: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  status: "Approved" | "Rejected";
  managerNote?: string;
}, employeeEmail?: string) {
  const subject = `Leave Request ${leave.status}: ${leave.type}`;
  const body = `Hi ${leave.employee},

Your leave request has been ${leave.status.toLowerCase()}:

Type: ${leave.type}
Dates: ${leave.startDate} to ${leave.endDate}
Days: ${leave.days}${leave.managerNote ? `\n\nManager Note: ${leave.managerNote}` : ""}

Please check the HRM system for details.

Thanks,
HRM System`;
  if (employeeEmail) {
    sendEmail(employeeEmail, subject, body);
  } else {
    sendEmail("", subject, body);
  }
}

import { MailList } from "@/components/email/MailList";

const Sent = () => (
  <MailList
    folder="sent"
    title="Sent"
    description="Mail you've sent"
    peopleHeader="To"
    emptyTitle="Nothing sent yet"
    emptyDescription="Messages you send — including emailed invoices — will be listed here."
  />
);

export default Sent;

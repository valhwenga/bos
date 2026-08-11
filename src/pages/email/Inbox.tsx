import { MailList } from "@/components/email/MailList";

const Inbox = () => (
  <MailList
    folder="inbox"
    title="Inbox"
    description="Mail you've received"
    peopleHeader="From"
    emptyTitle="Your inbox is empty"
    emptyDescription="Incoming mail will appear here once SMTP is configured."
  />
);

export default Inbox;

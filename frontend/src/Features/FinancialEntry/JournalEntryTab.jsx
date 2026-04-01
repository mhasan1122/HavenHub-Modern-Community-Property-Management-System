import BaseVoucherEntryWithAccountSelect from "./BaseVoucherEntryWithAccountSelect";

const JournalEntryTab = () => {
  return (
    <div className="space-y-4">
      <BaseVoucherEntryWithAccountSelect
        title="Journal Entry"
        onSaved={() => window.location.reload()}
        voucherType="journal"
      />
    </div>
  );
};

export default JournalEntryTab;

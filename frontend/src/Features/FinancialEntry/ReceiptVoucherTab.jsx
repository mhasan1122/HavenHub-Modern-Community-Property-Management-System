import SpecializedReceiptVoucher from "./SpecializedReceiptVoucher";

const ReceiptVoucherTab = () => {
  return (
    <div className="space-y-4">
      <SpecializedReceiptVoucher
        title="Receipt Voucher (Income)"
        onSaved={() => window.location.reload()}
        voucherType="receipt"
      />
    </div>
  );
};

export default ReceiptVoucherTab;

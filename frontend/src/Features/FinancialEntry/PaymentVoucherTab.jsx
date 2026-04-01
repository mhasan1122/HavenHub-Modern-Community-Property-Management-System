import SpecializedPaymentVoucher from "./SpecializedPaymentVoucher";

const PaymentVoucherTab = () => {
  return (
    <div className="space-y-4">
      <SpecializedPaymentVoucher
        title="Payment Voucher (Expense)"
        onSaved={() => window.location.reload()}
        voucherType="payment"
      />
    </div>
  );
};

export default PaymentVoucherTab;
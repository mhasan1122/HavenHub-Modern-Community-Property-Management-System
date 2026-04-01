import React from 'react';

export default function CancelPaymentModal({ visible, onClose }: any) {
  return visible ? React.createElement('View', { testID: 'cancel-modal' }) : null;
}


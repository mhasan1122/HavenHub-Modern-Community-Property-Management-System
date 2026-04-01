import React from 'react';

export default function SuccessPopup({ visible, onClose }: any) {
  return visible ? React.createElement('View', { testID: 'success-popup' }) : null;
}


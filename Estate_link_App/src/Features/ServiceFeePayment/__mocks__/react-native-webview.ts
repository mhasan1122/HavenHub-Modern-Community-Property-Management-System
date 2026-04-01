import React from 'react';

export const WebView = jest.fn((props) => {
  return React.createElement('View', { testID: 'webview-mock', ...props });
});


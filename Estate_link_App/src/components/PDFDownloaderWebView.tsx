import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

interface PDFDownloaderWebViewProps {
  pdfUri: string;
  fileName: string;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
}

export const PDFDownloaderWebView: React.FC<PDFDownloaderWebViewProps> = ({
  pdfUri,
  fileName,
  title = "PDF Document",
  size = 'medium',
  variant = 'primary'
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: 'px-3 py-2',
          text: 'text-sm',
          icon: 16
        };
      case 'large':
        return {
          container: 'px-6 py-4',
          text: 'text-lg',
          icon: 24
        };
      default:
        return {
          container: 'px-4 py-3',
          text: 'text-base',
          icon: 20
        };
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: 'bg-gray-500',
          text: 'text-white'
        };
      case 'outline':
        return {
          container: 'bg-white border-2 border-primary-500',
          text: 'text-primary-500'
        };
      default:
        return {
          container: 'bg-primary-500',
          text: 'text-white'
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const downloadPDF = () => {
    setIsDownloading(true);
    setShowWebView(true);
  };

  const handleWebViewLoad = () => {
    // WebView loaded, download should start automatically
    setTimeout(() => {
      setIsDownloading(false);
      setShowWebView(false);
      Alert.alert(
        'Download Started',
        `${title} download has been initiated. Check your downloads folder.`,
        [{ text: 'OK' }]
      );
    }, 2000);
  };

  const handleWebViewError = () => {
    setIsDownloading(false);
    setShowWebView(false);
    Alert.alert(
      'Download Failed',
      'Unable to download the PDF. Please try again.',
      [{ text: 'OK' }]
    );
  };

  // Create a download HTML page
  const downloadHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Downloading PDF</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background-color: #f5f5f5;
        }
        .container {
          text-align: center;
          padding: 20px;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3C9D9B;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 2s linear infinite;
          margin: 0 auto 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>Downloading PDF...</h2>
        <p>Your download should start automatically.</p>
        <a href="${pdfUri}" download="${fileName}" id="downloadLink" style="display: none;">Download</a>
      </div>
      <script>
        // Automatically trigger download
        setTimeout(function() {
          document.getElementById('downloadLink').click();
        }, 1000);
      </script>
    </body>
    </html>
  `;

  return (
    <>
      <TouchableOpacity
        className={`flex-row items-center justify-center rounded-lg ${sizeStyles.container} ${variantStyles.container} ${isDownloading ? 'opacity-70' : ''}`}
        onPress={downloadPDF}
        disabled={isDownloading}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={isDownloading ? "hourglass" : "download"} 
          size={sizeStyles.icon} 
          color={variant === 'outline' ? '#3C9D9B' : 'white'} 
        />
        <Text className={`ml-2 font-semibold ${sizeStyles.text} ${variantStyles.text}`}>
          {isDownloading ? 'Downloading...' : 'Download PDF'}
        </Text>
      </TouchableOpacity>

      {/* WebView Modal for Download */}
      <Modal
        visible={showWebView}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowWebView(false);
          setIsDownloading(false);
        }}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center">
          <View className="bg-white rounded-lg p-4 m-4 w-80">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold">Downloading PDF</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowWebView(false);
                  setIsDownloading(false);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <WebView
              source={{ html: downloadHTML }}
              style={{ height: 200 }}
              onLoad={handleWebViewLoad}
              onError={handleWebViewError}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

// Compact version for inline use
export const PDFDownloadButtonWebView: React.FC<Omit<PDFDownloaderWebViewProps, 'size' | 'variant'>> = (props) => {
  return <PDFDownloaderWebView {...props} size="small" variant="outline" />;
};
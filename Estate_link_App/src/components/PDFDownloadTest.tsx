import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { PDFDownloader, PDFDownloadButton } from './PDFDownloader';

export const PDFDownloadTest: React.FC = () => {
  // Test PDF URLs (you can replace these with actual PDF URLs from your backend)
  const testPDFs = [
    {
      uri: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileName: 'test-document.pdf',
      title: 'Test PDF Document'
    },
    {
      uri: 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
      fileName: 'tracemonkey-paper.pdf',
      title: 'TraceMonkey Research Paper'
    },
    {
      uri: 'https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf',
      fileName: 'adobe-sample.pdf',
      title: 'Adobe Sample PDF'
    }
  ];

  return (
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-2xl font-bold text-center mb-6">PDF Download Test</Text>
      
      <Text className="text-lg font-semibold mb-4">Large Download Buttons:</Text>
      {testPDFs.map((pdf, index) => (
        <View key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <Text className="text-base font-medium mb-2">{pdf.title}</Text>
          <PDFDownloader
            pdfUri={pdf.uri}
            fileName={pdf.fileName}
            title={pdf.title}
            size="large"
            variant="primary"
          />
        </View>
      ))}
      
      <Text className="text-lg font-semibold mb-4 mt-6">Small Download Buttons:</Text>
      {testPDFs.map((pdf, index) => (
        <View key={index} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <Text className="text-base font-medium mb-2">{pdf.title}</Text>
          <PDFDownloadButton
            pdfUri={pdf.uri}
            fileName={pdf.fileName}
            title={pdf.title}
          />
        </View>
      ))}
      
      <Text className="text-lg font-semibold mb-4 mt-6">Different Variants:</Text>
      <View className="mb-4 p-4 bg-gray-50 rounded-lg">
        <Text className="text-base font-medium mb-2">Secondary Variant</Text>
        <PDFDownloader
          pdfUri={testPDFs[0].uri}
          fileName={testPDFs[0].fileName}
          title={testPDFs[0].title}
          size="medium"
          variant="secondary"
        />
      </View>
      
      <View className="mb-4 p-4 bg-gray-50 rounded-lg">
        <Text className="text-base font-medium mb-2">Outline Variant</Text>
        <PDFDownloader
          pdfUri={testPDFs[0].uri}
          fileName={testPDFs[0].fileName}
          title={testPDFs[0].title}
          size="medium"
          variant="outline"
        />
      </View>
    </ScrollView>
  );
};
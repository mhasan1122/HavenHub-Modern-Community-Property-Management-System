import React, { useState } from "react";
import { View, Button, StyleSheet, Dimensions, Text, TouchableOpacity } from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from '@expo/vector-icons';
import { PDFDownloader } from './PDFDownloader';

interface PDFPreviewProps {
  visible: boolean;
  onClose: () => void;
  pdfUri: string;
  title?: string;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  visible,
  onClose,
  pdfUri,
  title = "PDF Document"
}) => {

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      backdropOpacity={0.8}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* PDF Content */}
        <View style={styles.pdfContainer}>
          <View style={styles.pdfInfoContainer}>
            <Ionicons name="document-text" size={80} color="#3C9D9B" />
            <Text style={styles.pdfTitle}>PDF Document</Text>
            <Text style={styles.pdfFileName} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.pdfDescription}>
              Tap the download button to save this PDF to your Downloads folder and open it.
            </Text>
            
            {/* Download Button */}
            <View style={styles.downloadContainer}>
              <PDFDownloader
                pdfUri={pdfUri}
                fileName={title}
                title={title}
                size="large"
                variant="primary"
              />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.pageInfo}>
            Download will open sharing options to save the PDF
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Example usage component
export const PDFPreviewExample: React.FC = () => {
  const [isModalVisible, setModalVisible] = useState(false);

  const pdfSource = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

  return (
    <View style={styles.exampleContainer}>
      <Button title="Open PDF Preview" onPress={() => setModalVisible(true)} />
      
      <PDFPreview
        visible={isModalVisible}
        onClose={() => setModalVisible(false)}
        pdfUri={pdfSource}
        title="Sample PDF Document"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: "center",
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 10,
    height: Dimensions.get("window").height * 0.85,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  pdfInfoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  pdfTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3C9D9B",
    marginTop: 16,
    textAlign: "center",
  },
  pdfFileName: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  pdfDescription: {
    fontSize: 14,
    color: "#888",
    marginTop: 16,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  downloadContainer: {
    marginTop: 32,
    width: "100%",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#f8f9fa",
    alignItems: "center",
  },
  pageInfo: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#3C9D9B",
    marginTop: 12,
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#3C9D9B",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryText: {
    color: "white",
    fontWeight: "600",
  },
  exampleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
});
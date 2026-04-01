// handleDownload.js
export const handleDownload = async (imageUrl, filename) => {
    try {
      // Fetch the image as a blob from the URL.
      const response = await fetch(imageUrl, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const blob = await response.blob();
  
      // Create a temporary URL for the blob.
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename; // Set the desired file name.
      document.body.appendChild(link);
      link.click(); // Programmatically click the link to trigger the download.
      
      // Clean up: remove the link and revoke the object URL.
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading the image:", error);
    }
  };
  
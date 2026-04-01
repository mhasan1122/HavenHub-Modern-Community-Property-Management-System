/**
 * Resize an image file to specified dimensions
 * @param {File} file - The image file to resize
 * @param {number} targetWidth - Target width in pixels
 * @param {number} targetHeight - Target height in pixels
 * @param {number} quality - Image quality (0-1), default 0.9
 * @returns {Promise<File>} - Resized image as a File object
 */
export const resizeImage = (file, targetWidth, targetHeight, quality = 0.9) => {
  return new Promise((resolve, reject) => {
    // SVG files cannot be resized using canvas, return as-is
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions to target size
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Calculate scaling to cover the entire canvas (crop to fit)
        const scale = Math.max(
          targetWidth / img.width,
          targetHeight / img.height
        );
        
        // Calculate the source rectangle to crop from center
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (scaledWidth - targetWidth) / 2;
        const y = (scaledHeight - targetHeight) / 2;
        
        // Draw the image on canvas (this will crop and resize)
        ctx.drawImage(
          img,
          -x / scale,
          -y / scale,
          scaledWidth / scale,
          scaledHeight / scale
        );
        
        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to resize image'));
              return;
            }
            
            // Create a new File object with the same name and type
            const resizedFile = new File(
              [blob],
              file.name,
              {
                type: file.type,
                lastModified: Date.now()
              }
            );
            
            resolve(resizedFile);
          },
          file.type,
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

/**
 * Get dimensions from an active logo image
 * @param {Array} images - Array of company images
 * @returns {Object|null} - Object with width and height, or null if no active logo
 */
export const getActiveLogoDimensions = async (images) => {
  // Find the active logo
  const activeLogo = images?.find(
    img => img.image_type === 'logo' && img.is_active
  );
  
  if (!activeLogo || !activeLogo.image_url) {
    return null;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Construct full URL if image_url is relative
    let imageUrl = activeLogo.image_url;
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      const BASE_URL = import.meta.env.VITE_BASE_API || "http://127.0.0.1:8000";
      imageUrl = imageUrl.startsWith('/') 
        ? `${BASE_URL}${imageUrl}` 
        : `${BASE_URL}/${imageUrl}`;
    }
    
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    
    img.onerror = () => {
      resolve(null);
    };
    
    img.src = imageUrl;
  });
};

/**
 * Get default dimensions (used when no active logo exists)
 * @returns {Object} - Default dimensions (square)
 */
export const getDefaultDimensions = () => {
  // Default to 512x512 square for logos
  return { width: 512, height: 512 };
};


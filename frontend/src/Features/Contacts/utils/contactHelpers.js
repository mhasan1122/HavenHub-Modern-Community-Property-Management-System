export const mapContactToFormValues = (contact) => {
  if (!contact) {
    return null;
  }

  return {
    name: contact.name ?? "",
    phoneNumber: contact.phone_number ?? contact.phoneNumber ?? "",
    email: contact.email ?? "",
    designation: contact.designation ?? "",
    photo: contact.photo_url || contact.photo || null,
    member: contact.org_member ?? contact.member ?? null, // Support both old and new field names
  };
};

export const buildContactPayload = (values) => {
  // New simplified payload - only send org_member, all other data comes from member table
  const payload = {};
  
  // Include org_member ID (required)
  if (values.member) {
    payload.org_member = values.member;
  } else {
    // This should not happen due to validation, but handle it gracefully
    throw new Error("Organization member is required");
  }
  
  return payload;
};

export const formatContactDate = (isoDate) => {
  if (!isoDate) {
    return "—";
  }

  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return parsedDate.toLocaleString();
};

/**
 * Fetch an image from a URL and convert it to a File object
 * @param {string} imageUrl - The URL of the image
 * @param {string} fileName - Optional filename for the File object
 * @returns {Promise<File|null>} - The File object or null if fetch fails
 */
export const urlToFile = async (imageUrl, fileName = "member-photo.jpg") => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error("Failed to fetch image:", response.statusText);
      return null;
    }
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
    return file;
  } catch (error) {
    console.error("Error converting URL to File:", error);
    return null;
  }
};



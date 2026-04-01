const sanitizeSegment = (segment) => {
  if (!segment) return "file";

  return segment
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "file";
};

export const DEFAULT_COMPANY_NAME = "EstateLink";

export const generateFileName = (companyOrPage, maybePageName) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);

  const hasExplicitPage = typeof maybePageName === "string" && maybePageName.trim().length > 0;

  const companyName = hasExplicitPage ? companyOrPage : DEFAULT_COMPANY_NAME;
  const pageName = hasExplicitPage ? maybePageName : companyOrPage;

  const companySegment = sanitizeSegment(companyName);
  const pageSegment = sanitizeSegment(pageName);

  return `${companySegment}_${pageSegment}_${day}${month}${year}`;
};

export const withExtension = (fileName, extension) => {
  if (!extension) return fileName;

  const normalizedExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;

  return fileName.endsWith(normalizedExtension)
    ? fileName
    : `${fileName}${normalizedExtension}`;
};



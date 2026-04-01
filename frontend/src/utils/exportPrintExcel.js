import { utils, write, writeFile } from "xlsx";
import { saveAs } from "file-saver";
import html2pdf from "html2pdf.js";
import banglaFontUrl from "../assets/NotoSansBengali-Regular.ttf";
import latinFontUrl from "../assets/NotoSans-Regular.ttf";

export const exportToExcel = (
  data,
  fileName = "export",
  customHeader = "Member List"
) => {
  // 1 Create worksheet from data, starting from A3 (3rd row)
  const worksheet = utils.json_to_sheet(data, { origin: "A3" });

  // 2 Add custom header at A1
  utils.sheet_add_aoa(worksheet, [[customHeader]], { origin: "A1" });

  // 3 Merge A1 to last column of data for header
  const colCount = Object.keys(data[0] || {}).length;
  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 }, // A1
      e: { r: 0, c: colCount - 1 } // e.g., C1 if 3 columns
    }
  ];

  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = write(workbook, {
    bookType: "xlsx",
    type: "array"
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  saveAs(blob, `${fileName} ${new Date().toISOString().split("T")[0]}.xlsx`);
};

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const arrayBufferToBase64 = (buffer) => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(binary);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(binary, "binary").toString("base64");
  }

  throw new Error("No available base64 encoder for the current environment.");
};

const fontDataCache = new Map();

const loadFontData = (cacheKey, fontUrl) => {
  if (!fontDataCache.has(cacheKey)) {
    const fontPromise = fetch(fontUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch font: ${response.status} ${response.statusText}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBufferToBase64);

    fontDataCache.set(cacheKey, fontPromise);
  }

  return fontDataCache.get(cacheKey);
};

const ensurePdfFonts = async (doc) => {
  const fontStatus = {
    latin: false,
    bangla: false
  };

  try {
    const [latinFontData, banglaFontData] = await Promise.allSettled([
      loadFontData("NotoSans-Regular", latinFontUrl),
      loadFontData("NotoSansBengali-Regular", banglaFontUrl)
    ]);

    if (latinFontData.status === "fulfilled") {
      doc.addFileToVFS("NotoSans-Regular.ttf", latinFontData.value);
      doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
      fontStatus.latin = true;
    }

    if (banglaFontData.status === "fulfilled") {
      doc.addFileToVFS("NotoSansBengali-Regular.ttf", banglaFontData.value);
      doc.addFont("NotoSansBengali-Regular.ttf", "NotoSansBengali", "normal");
      fontStatus.bangla = true;
    }
  } catch (error) {
    console.error("Error loading PDF fonts:", error);
  }

  if (fontStatus.latin) {
    doc.setFont("NotoSans", "normal");
  } else {
    doc.setFont("helvetica", "normal");
  }

  return fontStatus;
};

export const printTable = async (
  members,
  columns,
  title,
  logoUrl = "",
  fileName = "document.pdf"
) => {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  const fontStatus = await ensurePdfFonts(doc);
  const defaultFont = fontStatus.latin ? "NotoSans" : "helvetica";
  const banglaFont = fontStatus.bangla ? "NotoSansBengali" : defaultFont;

  // Add title
  doc.setFontSize(14);
  doc.setFont(defaultFont, "normal");
  doc.text(title, pageWidth / 2, 15, { align: "center" });

  // Add printed date
  doc.setFontSize(8);
  doc.setFont(defaultFont, "normal");
  doc.text(
    `Printed on: ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  // Optional: add logo (if provided)
  // You must convert logoUrl to base64 before calling this function
  // doc.addImage(logoUrl, "JPEG", 10, 10, 30, 15);

  // Build autoTable headers
  const tableHeaders = columns.map((col) => col.header);

  // Build table rows
  const tableRows = members.map((member) =>
    columns.map((col) => {
      const value = col.accessor(member);
      return value != null ? String(value) : "";
    })
  );

  // Create the table
  autoTable(doc, {
    startY: 30,
    margin: {
      top: 30,
      right: 10,
      bottom: 20,
      left: 10
    },
    head: [tableHeaders],
    body: tableRows,
    theme: "grid",
    styles: {
      font: defaultFont,
      fontSize: 8,
      cellPadding: 3,
      valign: "middle",
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    headStyles: {
      font: defaultFont,
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      // example: center-align last column if needed
      // [columns.length - 1]: { halign: "center" }
    },
    didParseCell: (data) => {
      if (!fontStatus.bangla) {
        return;
      }

      const hasCurrencySymbol =
        Array.isArray(data.cell.text) &&
        data.cell.text.some((text) => text && text.includes("৳"));

      if (hasCurrencySymbol) {
        data.cell.styles.font = banglaFont;
      }
    },
    didDrawPage: () => {
      // header is automatically repeated
    }
  });

  // Save the PDF
  doc.save(fileName);
};

// src/utils/printGroupDetails.js

// src/utils/printGroupDetailsPdf.js

function safeText(text) {
  if (text === null || text === undefined) return "";
  return String(text);
}

export function printGroupDetails(groupList, logoUrl = "", fileName) {
  const title = "Group List";
  const resolvedFileName =
    fileName ||
    `EstateLink_Group_List_${new Date().toISOString().split("T")[0]}.pdf`;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 15;

  // Document main title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14); // slightly smaller title
  doc.text(title, pageWidth / 2, currentY, { align: "center" });
  currentY += 7;

  // Printed date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Printed on: ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    currentY,
    { align: "center" }
  );
  currentY += 10;

  groupList.forEach((group, groupIndex) => {
    const roles = group.roles.map((r) => safeText(r.role_name)).join(", ");
    const status = group.is_active ? "Active" : "Inactive";

    // Estimate height needed for group info: 4 lines x 7mm
    const neededHeightForGroupInfo = 7 * 4;
    if (
      currentY + neededHeightForGroupInfo >
      doc.internal.pageSize.getHeight() - 20
    ) {
      doc.addPage();
      currentY = 15;
    }

    // Group info lines with bold labels
    const groupInfoLines = [
      `${groupIndex + 1}. Group Name: ${safeText(group.group_name)}`,
      `Description: ${safeText(group.group_description)}`,
      `Roles: ${roles}`,
      `Status: ${status}`
    ];

    // groupInfoLines.forEach((line) => {
    //   const splitIndex = line.indexOf(":");
    //   if (splitIndex !== -1) {
    //     const titlePart = line.substring(0, splitIndex + 1);
    //     const valuePart = line.substring(splitIndex + 1);

    //     doc.setFont("helvetica", "bold");
    //     doc.setFontSize(9);
    //     doc.text(titlePart, 14, currentY);

    //     doc.setFont("helvetica", "normal");
    //     doc.text(
    //       valuePart.trim(),
    //       14 + doc.getTextWidth(titlePart) + 2,
    //       currentY
    //     );
    //   } else {
    //     doc.setFont("helvetica", "normal");
    //     doc.setFontSize(9);
    //     doc.text(line, 14, currentY);
    //   }
    //   currentY += 7;
    // });
groupInfoLines.forEach((line) => {
  const splitIndex = line.indexOf(":");
  if (splitIndex !== -1) {
    const titlePart = line.substring(0, splitIndex + 1);
    const valuePart = line.substring(splitIndex + 1).trim();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(titlePart, 14, currentY);

    doc.setFont("helvetica", "normal");
    const textX = 14 + doc.getTextWidth(titlePart) + 2;
    const maxWidth = pageWidth - textX - 10;

    const valueLines = doc.splitTextToSize(valuePart, maxWidth);
    doc.text(valueLines, textX, currentY);

    // increase currentY based on number of lines
    currentY += 6 * valueLines.length;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(line, 14, currentY);
    currentY += 6;
  }
});

    // Prepare table rows with safe text
    const tableData = group.members.map((member, idx) => [
      idx + 1,
      safeText(member.full_name),
      safeText(member.general_contact),
      safeText(member.general_email),
      safeText(member.member_type_name),
      member.is_org_member ? "Active" : "Inactive"
    ]);

    // Estimate height for table, add page if needed
    const approxRowHeight = 7;
    const rowsHeight = tableData.length * approxRowHeight + 10; // header approx 10mm
    if (currentY + rowsHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 15;
    }

    autoTable(doc, {
      startY: currentY,
      head: [["#", "Full Name", "Contact", "Email", "Member Type", "Status"]],
      body: tableData,
      theme: "grid", // This ensures all cell borders appear
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.5,
        valign: "middle",
        lineWidth: 0.1, // Needed for visible borders
        lineColor: [0, 0, 0] // Black border
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: "bold",
        halign: "left",
        lineWidth: 0.1,
        lineColor: [0, 0, 0] // Ensure header border is shown
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 },
        4: { cellWidth: 30 },
        5: { halign: "center", cellWidth: 20 }
      },
      pageBreak: "avoid",
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
          doc.text(title, pageWidth / 2, 15, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(
            `Printed on: ${new Date().toLocaleDateString()}`,
            pageWidth / 2,
            22,
            { align: "center" }
          );
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 10; // space before next group
  });

  doc.save(resolvedFileName);
}

export function printCommunityMemberList(
  members,
  title = "Community Member List",
  logoUrl = "",
  fileName
) {
  const dateStr = new Date().toISOString().split("T")[0];
  const pdfFileName = fileName || `EstateLink_Member_List_${dateStr}.pdf`;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 15, { align: "center" });

  // Print Date
  doc.setFontSize(8);
  doc.text(
    `Printed on: ${new Date().toLocaleDateString()}`,
    pageWidth / 2,
    22,
    { align: "center" }
  );

  // Prepare table rows
  const rows = [];

  // Grouping
  const groupedMembers = members.reduce((acc, member) => {
    if (!acc[member.id]) {
      acc[member.id] = {
        id: member.id,
        full_name: member.full_name || "",
        general_contact: member.general_contact || "N/A",
        general_email: member.general_email || "N/A",
        status:
          member.status ||
          (Number(member.is_org_member) === 1 ? "Active" : "Inactive"),
        locations: []
      };
    }
    acc[member.id].locations.push({
      type: member.type,
      tower: member.tower,
      unit: member.unit
    });
    return acc;
  }, {});

  // Format for autoTable
  Object.values(groupedMembers).forEach((member) => {
    const rowSpan = member.locations.length || 1;

    member.locations.forEach((loc, index) => {
      const typeStr = loc?.type
        ? loc.type.charAt(0).toUpperCase() + loc.type.slice(1).toLowerCase()
        : "--";

      const row = [];

      if (index === 0) {
        row.push({
          content: member.full_name,
          rowSpan: rowSpan
        });
        row.push({
          content: member.general_contact,
          rowSpan: rowSpan
        });
        row.push({
          content: member.general_email,
          rowSpan: rowSpan
        });
      }

      row.push(typeStr || "--");
      row.push(loc?.tower || "--");
      row.push(loc?.unit || "--");

      if (index === 0) {
        row.push({
          content: member.status,
          rowSpan: rowSpan
        });
      }

      rows.push(row);
    });

    // If no locations at all, still add one row
    if (member.locations.length === 0) {
      rows.push([
        member.full_name,
        member.general_contact,
        member.general_email,
        "--",
        "--",
        "--",
        member.status
      ]);
    }
  });

  autoTable(doc, {
    startY: 30,
    margin: {
      top: 30,
      right: 10,
      bottom: 20,
      left: 10
    },
    head: [["Name", "Contact", "Email", "Type", "Tower", "Unit", "Status"]],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: "middle",
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      6: { halign: "center" } // Status column center aligned
    },
    willDrawCell: (data) => {
      // Optional: dynamic row color or custom logic
    },
    didDrawPage: (data) => {
      // Header repeat on each page is handled automatically
    }
  });

  doc.save(pdfFileName);
}

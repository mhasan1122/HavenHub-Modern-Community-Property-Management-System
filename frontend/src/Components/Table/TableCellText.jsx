import { useState, useEffect, useRef } from "react";

const TableTextCell = ({ data }) => {
  const [displayText, setDisplayText] = useState("");
  const [hiddenCount, setHiddenCount] = useState(0);
  const cellRef = useRef(null);

  useEffect(() => {
    const truncateText = () => {
      if (!data || !cellRef.current) return;

      const text = Array.isArray(data) ? data.join(", ") : data;
      const cellWidth = cellRef.current.clientWidth; // Get actual <td> width
      const avgCharWidth = 8; // Reduce character width estimate to be more conservative
      const safePaddingFactor = 0.8; // Ensures early truncation before wrapping

      const maxChars = Math.floor(
        (cellWidth / avgCharWidth) * safePaddingFactor
      ); // Adjusted char limit

      if (text.length > maxChars) {
        const truncatedText = text.slice(0, maxChars);
        const words = truncatedText.split(", ");
        setDisplayText(`${truncatedText}...`);
        setHiddenCount(text.split(", ").length - words.length);
      } else {
        setDisplayText(text);
        setHiddenCount(0);
      }
    };

    truncateText();
    window.addEventListener("resize", truncateText);
    return () => window.removeEventListener("resize", truncateText);
  }, [data]);

  return (
    <td
      ref={cellRef}
      className="px-2 py-2 text-sm whitespace-nowrap overflow-hidden"
    >
      {displayText}
      {hiddenCount > 0 && Array.isArray(data) && (
        <span className="text-gray-500"> +{hiddenCount} more</span>
      )}
    </td>
  );
};

export default TableTextCell;

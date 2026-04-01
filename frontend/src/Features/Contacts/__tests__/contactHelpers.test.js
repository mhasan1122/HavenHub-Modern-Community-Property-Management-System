import {
  buildContactPayload,
  formatContactDate,
  mapContactToFormValues,
} from "../utils/contactHelpers";

describe("contactHelpers", () => {
  describe("mapContactToFormValues", () => {
    it("maps API contact fields to form values", () => {
      const contact = {
        id: 7,
        name: "Jane Smith",
        phone_number: "+12025550123",
        email: "jane@example.com",
        designation: "Security Lead",
      };

      expect(mapContactToFormValues(contact)).toEqual({
        name: "Jane Smith",
        phoneNumber: "+12025550123",
        email: "jane@example.com",
        designation: "Security Lead",
      });
    });

    it("falls back to alternative phone field and empty strings", () => {
      const contact = {
        name: null,
        phoneNumber: "+441234567890",
        email: undefined,
        designation: null,
      };

      expect(mapContactToFormValues(contact)).toEqual({
        name: "",
        phoneNumber: "+441234567890",
        email: "",
        designation: "",
      });
    });

    it("returns null when contact is falsy", () => {
      expect(mapContactToFormValues()).toBeNull();
      expect(mapContactToFormValues(null)).toBeNull();
    });
  });

  describe("buildContactPayload", () => {
    it("builds payload with trimmed fields", () => {
      const values = {
        name: "  Jane Smith ",
        phoneNumber: " +12025550123 ",
        email: " jane@example.com ",
        designation: " Security Lead ",
      };

      expect(buildContactPayload(values)).toEqual({
        name: "Jane Smith",
        phone_number: "+12025550123",
        email: "jane@example.com",
        designation: "Security Lead",
      });
    });
  });

  describe("formatContactDate", () => {
    it("formats valid ISO date strings", () => {
      const isoDate = "2024-03-12T10:15:30.000Z";
      const formatted = formatContactDate(isoDate);

      expect(formatted).not.toBe("—");
      expect(formatted).toContain("2024");
    });

    it("returns em dash for invalid or missing dates", () => {
      expect(formatContactDate("invalid-date")).toBe("—");
      expect(formatContactDate()).toBe("—");
      expect(formatContactDate(null)).toBe("—");
    });
  });
});



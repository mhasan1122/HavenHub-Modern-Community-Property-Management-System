import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import React from "react";

import ImportantContacts from "../ImportantContacts";

jest.mock("../hooks/useImportantContacts", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseImportantContacts = jest.requireMock(
  "../hooks/useImportantContacts"
).default;

const defaultHookState = ({
  items = [],
  isLoading = false,
  error = null,
  createStatus = "idle",
  createError = null,
  updateStatus = "idle",
  updateError = null,
  deleteStatus = "idle",
  deleteError = null,
  lastMessage = "",
  createContact = jest.fn(),
  editContact = jest.fn(),
  removeContact = jest.fn(),
  resetMutations = jest.fn(),
} = {}) => ({
  items,
  isLoading,
  error,
  createStatus,
  createError,
  updateStatus,
  updateError,
  deleteStatus,
  deleteError,
  lastMessage,
  createContact,
  editContact,
  removeContact,
  resetMutations,
});

describe("ImportantContacts integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseImportantContacts.mockReturnValue(defaultHookState());
  });

  it("submits new contact through createContact action", async () => {
    const user = userEvent.setup();
    const createContact = jest.fn();

    mockUseImportantContacts.mockReturnValue(
      defaultHookState({
        createContact,
      })
    );

    render(<ImportantContacts />);

    await user.type(screen.getByPlaceholderText(/enter name/i), "  Jane Doe ");
    await user.type(
      screen.getByPlaceholderText(/\+8801xxxxxxxxx/i),
      " +12025550123 "
    );
    await user.type(
      screen.getByPlaceholderText(/contact@example.com/i),
      " jane@example.com "
    );
    await user.type(
      screen.getByPlaceholderText(/security supervisor/i),
      " Community Manager "
    );

    await user.click(screen.getByRole("button", { name: /add contact/i }));

    expect(createContact).toHaveBeenCalledWith({
      name: "Jane Doe",
      phone_number: "+12025550123",
      email: "jane@example.com",
      designation: "Community Manager",
    });
  });

  it("allows editing a contact and calls editContact", async () => {
    const user = userEvent.setup();
    const editContact = jest.fn();
    const removeContact = jest.fn();
    const items = [
      {
        id: 1,
        name: "Jane Doe",
        phone_number: "+12025550123",
        email: "jane@example.com",
        designation: "Security Lead",
        created_at: "2024-04-18T09:00:00.000Z",
      },
    ];

    mockUseImportantContacts.mockReturnValue(
      defaultHookState({
        items,
        editContact,
        removeContact,
      })
    );

    render(<ImportantContacts />);

    await user.click(screen.getByRole("button", { name: /edit/i }));

    expect(
      screen.getByRole("button", { name: /update contact/i })
    ).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/enter name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Jane Updated");

    const designationInput = screen.getByPlaceholderText(
      /security supervisor/i
    );
    await user.clear(designationInput);
    await user.type(designationInput, "Operations Manager");

    await user.click(
      screen.getByRole("button", { name: /update contact/i })
    );

    expect(editContact).toHaveBeenCalledWith(1, {
      name: "Jane Updated",
      phone_number: "+12025550123",
      email: "jane@example.com",
      designation: "Operations Manager",
    });
  });

  it("confirms deletion and surfaces error states through message box", async () => {
    const user = userEvent.setup();
    const removeContact = jest.fn();
    const resetMutations = jest.fn();
    const items = [
      {
        id: 1,
        name: "Jane Doe",
        phone_number: "+12025550123",
        email: "jane@example.com",
        designation: "Security Lead",
        created_at: "2024-04-18T09:00:00.000Z",
      },
    ];

    const initialState = defaultHookState({
      items,
      removeContact,
      resetMutations,
    });

    const failureState = defaultHookState({
      items,
      removeContact,
      resetMutations,
      deleteStatus: "failed",
      deleteError: "Unable to delete contact",
    });

    mockUseImportantContacts.mockReturnValue(initialState);

    const { rerender } = render(<ImportantContacts />);

    await user.click(screen.getByRole("button", { name: /delete/i }));

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirmButton);

    expect(removeContact).toHaveBeenCalledWith(1);

    mockUseImportantContacts.mockReturnValue(failureState);
    rerender(<ImportantContacts />);

    const errorMessage = await screen.findByText(/unable to delete contact/i);
    expect(errorMessage).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^ok$/i }));

    await waitFor(() => {
      expect(resetMutations).toHaveBeenCalled();
    });
  });
});



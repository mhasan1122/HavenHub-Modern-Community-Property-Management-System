import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import ContactTable from "../components/ContactTable";

const baseContacts = [
  {
    id: 1,
    name: "Jane Doe",
    designation: "Security Lead",
    phone_number: "+12025550123",
    email: "jane@example.com",
    created_at: "2024-04-18T09:00:00.000Z",
  },
  {
    id: 2,
    name: "John Smith",
    designation: "Facility Manager",
    phone_number: "+441234567890",
    email: "john@example.com",
    created_at: "2024-04-17T12:00:00.000Z",
  },
];

describe("ContactTable", () => {
  it("renders contacts and triggers edit/delete handlers", async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <ContactTable
        contacts={baseContacts}
        isLoading={false}
        onEdit={onEdit}
        onDelete={onDelete}
        pendingDeleteId={null}
      />
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(baseContacts[0]);

    await user.click(screen.getAllByRole("button", { name: /delete/i })[1]);
    expect(onDelete).toHaveBeenCalledWith(baseContacts[1]);
  });

  it("shows empty state when no contacts", () => {
    render(
      <ContactTable
        contacts={[]}
        isLoading={false}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        pendingDeleteId={null}
      />
    );

    expect(
      screen.getByText(/no contacts yet\. add your first important contact\./i)
    ).toBeInTheDocument();
  });

  it("disables delete button when contact is pending deletion", () => {
    render(
      <ContactTable
        contacts={[baseContacts[0]]}
        isLoading={false}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        pendingDeleteId={baseContacts[0].id}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /deleting/i });
    expect(deleteButton).toBeDisabled();
  });
});



import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

import ContactForm from "../components/ContactForm";

const createDefaultProps = (overrides = {}) => ({
  mode: "create",
  initialValues: {
    name: "",
    phoneNumber: "",
    email: "",
    designation: "",
  },
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
  isSubmitting: false,
  ...overrides,
});

describe("ContactForm", () => {
  it("renders create mode with disabled submit until form is valid", () => {
    const props = createDefaultProps();
    render(<ContactForm {...props} />);

    const submitButton = screen.getByRole("button", { name: /add contact/i });
    expect(submitButton).toBeDisabled();
  });

  it("submits trimmed values when form is valid", async () => {
    const user = userEvent.setup();
    const props = createDefaultProps();
    render(<ContactForm {...props} />);

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

    const submitButton = screen.getByRole("button", { name: /add contact/i });
    await user.click(submitButton);

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    expect(props.onSubmit).toHaveBeenCalledWith({
      name: "Jane Doe",
      phoneNumber: "+12025550123",
      email: "jane@example.com",
      designation: "Community Manager",
    });
  });

  it("renders edit mode and invokes cancel handler", async () => {
    const user = userEvent.setup();
    const props = createDefaultProps({
      mode: "edit",
      initialValues: {
        name: "Existing Contact",
        phoneNumber: "+12025550123",
        email: "existing@example.com",
        designation: "Operations Lead",
      },
    });

    render(<ContactForm {...props} />);

    expect(
      screen.getByRole("button", { name: /update contact/i })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing Contact")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows validation message when email is invalid", async () => {
    const user = userEvent.setup();
    const props = createDefaultProps();
    render(<ContactForm {...props} />);

    await user.type(screen.getByPlaceholderText(/enter name/i), "Jane Doe");
    await user.type(
      screen.getByPlaceholderText(/\+8801xxxxxxxxx/i),
      "+12025550123"
    );
    await user.type(
      screen.getByPlaceholderText(/contact@example.com/i),
      "invalid-email"
    );
    await user.type(
      screen.getByPlaceholderText(/security supervisor/i),
      "Community Manager"
    );

    const errorMessage = await screen.findByText(/enter a valid email address/i);
    expect(errorMessage).toBeInTheDocument();

    const submitButton = screen.getByRole("button", { name: /add contact/i });
    expect(submitButton).toBeDisabled();
  });
});



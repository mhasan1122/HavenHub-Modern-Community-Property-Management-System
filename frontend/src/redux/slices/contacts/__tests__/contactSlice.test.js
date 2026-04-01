import reducer, {
  addImportantContact,
  deleteImportantContact,
  loadImportantContacts,
  resetContactsMutationState,
  updateImportantContact,
} from "../contactSlice";

const createInitialState = () =>
  reducer(undefined, {
    type: "@@INIT",
  });

describe("contactSlice reducer", () => {
  it("returns the initial state", () => {
    const initialState = createInitialState();

    expect(initialState).toMatchObject({
      items: [],
      isLoading: false,
      error: null,
      createStatus: "idle",
      updateStatus: "idle",
      deleteStatus: "idle",
      lastMessage: null,
    });
  });

  it("handles loadImportantContacts lifecycle", () => {
    let state = createInitialState();

    state = reducer(state, { type: loadImportantContacts.pending.type });
    expect(state.isLoading).toBe(true);
    expect(state.error).toBeNull();

    const contacts = [{ id: 1, name: "Jane Doe" }];
    state = reducer(
      state,
      loadImportantContacts.fulfilled(contacts, "request-id")
    );
    expect(state.isLoading).toBe(false);
    expect(state.items).toEqual(contacts);

    const errorAction = loadImportantContacts.rejected(
      new Error("Failed"),
      "request-id",
      undefined,
      "Server error"
    );
    state = reducer(state, errorAction);
    expect(state.error).toBe("Server error");
  });

  it("handles addImportantContact lifecycle", () => {
    let state = createInitialState();

    state = reducer(state, { type: addImportantContact.pending.type });
    expect(state.createStatus).toBe("loading");

    const payload = {
      message: "Created",
      contact: { id: 2, name: "John Smith" },
    };
    state = reducer(
      state,
      addImportantContact.fulfilled(payload, "request-id", payload.contact)
    );

    expect(state.createStatus).toBe("succeeded");
    expect(state.items[0]).toEqual(payload.contact);
    expect(state.lastCreated).toEqual(payload.contact);
    expect(state.lastMessage).toBe("Created");

    state = reducer(
      state,
      addImportantContact.rejected(
        new Error("Failure"),
        "request-id",
        payload.contact,
        "Unable to create"
      )
    );
    expect(state.createStatus).toBe("failed");
    expect(state.createError).toBe("Unable to create");
  });

  it("handles updateImportantContact lifecycle", () => {
    const initial = {
      ...createInitialState(),
      items: [{ id: 1, name: "Jane", designation: "Lead" }],
    };

    let state = reducer(initial, { type: updateImportantContact.pending.type });
    expect(state.updateStatus).toBe("loading");

    const updatedContact = { id: 1, name: "Jane", designation: "Manager" };
    state = reducer(
      state,
      updateImportantContact.fulfilled(
        { contact: updatedContact },
        "request-id",
        { contactId: 1, payload: updatedContact }
      )
    );

    expect(state.updateStatus).toBe("succeeded");
    expect(state.items[0]).toEqual(updatedContact);
    expect(state.lastUpdated).toEqual(updatedContact);

    state = reducer(
      state,
      updateImportantContact.rejected(
        new Error("Failure"),
        "request-id",
        { contactId: 1, payload: updatedContact },
        "Unable to update"
      )
    );
    expect(state.updateStatus).toBe("failed");
    expect(state.updateError).toBe("Unable to update");
  });

  it("handles deleteImportantContact lifecycle", () => {
    const initial = {
      ...createInitialState(),
      items: [
        { id: 1, name: "Jane Doe" },
        { id: 2, name: "John Smith" },
      ],
    };

    let state = reducer(initial, { type: deleteImportantContact.pending.type });
    expect(state.deleteStatus).toBe("loading");

    state = reducer(
      state,
      deleteImportantContact.fulfilled(null, "request-id", 1)
    );
    expect(state.deleteStatus).toBe("succeeded");
    expect(state.items).toEqual([{ id: 2, name: "John Smith" }]);
    expect(state.lastDeletedId).toBe(1);

    state = reducer(
      state,
      deleteImportantContact.rejected(
        new Error("Failure"),
        "request-id",
        2,
        "Unable to delete"
      )
    );
    expect(state.deleteStatus).toBe("failed");
    expect(state.deleteError).toBe("Unable to delete");
  });

  it("resets mutation state", () => {
    const mutatedState = {
      ...createInitialState(),
      createStatus: "succeeded",
      updateStatus: "failed",
      deleteStatus: "succeeded",
      createError: "error",
      updateError: "error",
      deleteError: "error",
      lastCreated: { id: 1 },
      lastUpdated: { id: 1 },
      lastDeletedId: 1,
      lastMessage: "Done",
    };

    const state = reducer(mutatedState, resetContactsMutationState());

    expect(state.createStatus).toBe("idle");
    expect(state.updateStatus).toBe("idle");
    expect(state.deleteStatus).toBe("idle");
    expect(state.createError).toBeNull();
    expect(state.updateError).toBeNull();
    expect(state.deleteError).toBeNull();
    expect(state.lastCreated).toBeNull();
    expect(state.lastUpdated).toBeNull();
    expect(state.lastDeletedId).toBeNull();
    expect(state.lastMessage).toBeNull();
  });
});



import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  addImportantContact,
  deleteImportantContact,
  loadImportantContacts,
  resetContactsMutationState,
  updateImportantContact,
} from "../../../redux/slices/contacts/contactSlice";

const selectContactsState = (state) => state.contacts;

const useImportantContacts = () => {
  const dispatch = useDispatch();
  const contactsState = useSelector(selectContactsState);

  useEffect(() => {
    dispatch(loadImportantContacts());
  }, [dispatch]);

  useEffect(() => {
    return () => {
      dispatch(resetContactsMutationState());
    };
  }, [dispatch]);

  const createContact = useCallback(
    (payload) => dispatch(addImportantContact(payload)),
    [dispatch]
  );

  const editContact = useCallback(
    (contactId, payload) =>
      dispatch(updateImportantContact({ contactId, payload })),
    [dispatch]
  );

  const removeContact = useCallback(
    (contactId) => dispatch(deleteImportantContact(contactId)),
    [dispatch]
  );

  const resetMutations = useCallback(
    () => dispatch(resetContactsMutationState()),
    [dispatch]
  );

  return {
    ...contactsState,
    createContact,
    editContact,
    removeContact,
    resetMutations,
  };
};

export default useImportantContacts;



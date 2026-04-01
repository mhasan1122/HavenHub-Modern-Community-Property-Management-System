export const updateChangedFields = (setIsFormChanged, field, value) => {
  setIsFormChanged((prevState) => {
    const updatedChanges = { ...prevState };

    // Check if value is a File instance
    const isFile = value instanceof File;

    // Check if empty: string, null, undefined, empty array, empty object (except File)
    const isEmpty =
      value === "" ||
      value === null ||
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (
        typeof value === "object" &&
        !isFile && // **exclude File here**
        Object.keys(value).length === 0
      );

    if (isEmpty) {
      delete updatedChanges[field];
    } else {
      updatedChanges[field] = value;
    }

    return updatedChanges;
  });
};

from rest_framework.utils.serializer_helpers import ReturnDict
def flatten_errors(errors):
    """
    Extracts only the error messages from DRF errors, ignoring field names.
    """
    if isinstance(errors, dict) or isinstance(errors, ReturnDict):
        messages = []
        for val in errors.values():
            if isinstance(val, list):
                messages.extend(map(str, val))  # flatten list of messages
            else:
                messages.append(str(val))
        return " | ".join(messages)
    return str(errors)

